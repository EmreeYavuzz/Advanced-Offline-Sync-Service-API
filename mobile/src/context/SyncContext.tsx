import { AppState, type AppStateStatus } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useTransition,
  type PropsWithChildren,
} from 'react';

import { registerBackgroundSyncTaskAsync } from '@/src/services/backgroundTask';
import {
  canSyncWithNetwork,
  getCurrentNetworkSnapshot,
  subscribeToNetworkChanges,
} from '@/src/services/networkService';
import { configureNotifications, syncPendingReminder } from '@/src/services/notificationService';
import { loadPersistedSyncSnapshot, savePersistedSyncSnapshot } from '@/src/services/storage';
import {
  checkServerHealth,
  createHistoryEntry,
  syncQueuedRequest,
} from '@/src/services/syncService';
import { createId } from '@/src/utils/format';
import type {
  NetworkSnapshot,
  QueuedRequest,
  ServerConnectionState,
  ServiceRequestDraft,
  SyncState,
} from '@/src/types/sync';

type SyncAction =
  | {
      type: 'HYDRATE';
      payload: {
        queue: QueuedRequest[];
        history: SyncState['history'];
        lastSyncAt: string | null;
        network: NetworkSnapshot;
      };
    }
  | { type: 'UPSERT_QUEUE_ITEM'; payload: QueuedRequest }
  | { type: 'REMOVE_QUEUE_ITEM'; payload: { localId: string } }
  | { type: 'APPEND_HISTORY'; payload: SyncState['history'][number] }
  | { type: 'SET_NETWORK'; payload: NetworkSnapshot }
  | { type: 'SET_SERVER_CONNECTION'; payload: ServerConnectionState }
  | { type: 'SET_LAST_SYNC'; payload: string | null }
  | { type: 'SET_IS_SYNCING'; payload: boolean };

const initialState: SyncState = {
  queue: [],
  history: [],
  lastSyncAt: null,
  network: {
    isConnected: null,
    isInternetReachable: null,
    type: 'unknown',
  },
  serverConnection: 'offline',
  isHydrated: false,
  isSyncing: false,
};

const ERROR_RETRY_COOLDOWN_MS = 15_000;
const SERVER_HEALTH_POLL_MS = 3_000;

function upsertQueueItem(queue: QueuedRequest[], item: QueuedRequest) {
  const index = queue.findIndex((entry) => entry.localId === item.localId);

  if (index === -1) {
    return [item, ...queue];
  }

  const next = [...queue];
  next[index] = item;
  return next;
}

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        queue: action.payload.queue,
        history: action.payload.history,
        lastSyncAt: action.payload.lastSyncAt,
        network: action.payload.network,
        isHydrated: true,
      };
    case 'UPSERT_QUEUE_ITEM':
      return {
        ...state,
        queue: upsertQueueItem(state.queue, action.payload),
      };
    case 'REMOVE_QUEUE_ITEM':
      return {
        ...state,
        queue: state.queue.filter((item) => item.localId !== action.payload.localId),
      };
    case 'APPEND_HISTORY':
      return {
        ...state,
        history: [action.payload, ...state.history].slice(0, 100),
      };
    case 'SET_NETWORK':
      return {
        ...state,
        network: action.payload,
      };
    case 'SET_SERVER_CONNECTION':
      return {
        ...state,
        serverConnection: action.payload,
      };
    case 'SET_LAST_SYNC':
      return {
        ...state,
        lastSyncAt: action.payload,
      };
    case 'SET_IS_SYNCING':
      return {
        ...state,
        isSyncing: action.payload,
      };
    default:
      return state;
  }
}

function selectPendingCount(queue: QueuedRequest[]) {
  return queue.filter((item) => ['pending', 'error', 'conflict'].includes(item.syncStatus)).length;
}

function selectConflictItems(queue: QueuedRequest[]) {
  return queue.filter((item) => item.syncStatus === 'conflict' && item.conflict);
}

function selectSortedQueue(queue: QueuedRequest[]) {
  return [...queue].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function canRetryItem(item: QueuedRequest) {
  if (item.autoRetryEnabled === false) {
    return false;
  }

  if (item.syncStatus === 'pending') {
    return true;
  }

  if (item.syncStatus !== 'error') {
    return false;
  }

  if (!item.lastAttemptAt) {
    return true;
  }

  return Date.now() - new Date(item.lastAttemptAt).getTime() >= ERROR_RETRY_COOLDOWN_MS;
}

interface SyncContextValue extends SyncState {
  pendingCount: number;
  conflictCount: number;
  isMutating: boolean;
  sortedQueue: QueuedRequest[];
  addDraft: (draft: ServiceRequestDraft) => Promise<void>;
  resolveConflict: (localId: string, mode: 'overwrite' | 'skip') => Promise<void>;
  removeQueuedRequest: (localId: string) => void;
  getQueuedRequest: (localId?: string) => QueuedRequest | undefined;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const [state, reactDispatch] = useReducer(syncReducer, initialState);
  const [isMutating] = useTransition();
  const stateRef = useRef(initialState);
  const persistChainRef = useRef(Promise.resolve());
  const isSyncingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dispatch = (action: SyncAction) => {
    const nextState = syncReducer(stateRef.current, action);
    stateRef.current = nextState;
    reactDispatch(action);

    if (nextState.isHydrated) {
      const snapshot = {
        queue: nextState.queue,
        history: nextState.history,
        lastSyncAt: nextState.lastSyncAt,
      };

      persistChainRef.current = persistChainRef.current
        .catch(() => undefined)
        .then(() => savePersistedSyncSnapshot(snapshot));
    }
  };

  async function hydrateFromStorage(networkOverride?: NetworkSnapshot) {
    const snapshot = await loadPersistedSyncSnapshot();
    const network = networkOverride ?? stateRef.current.network;

    dispatch({
      type: 'HYDRATE',
      payload: {
        queue: snapshot.queue,
        history: snapshot.history,
        lastSyncAt: snapshot.lastSyncAt,
        network,
      },
    });
  }

  async function refreshServerConnection() {
    const network = stateRef.current.network;

    if (!canSyncWithNetwork(network)) {
      if (stateRef.current.serverConnection !== 'offline') {
        dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'offline' });
      }
      return false;
    }

    const isHealthy = await checkServerHealth();

    if (isHealthy && stateRef.current.serverConnection !== 'online') {
      dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'online' });
    }

    if (!isHealthy && stateRef.current.serverConnection !== 'offline') {
      dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'offline' });
    }

    return isHealthy;
  }

  async function requestSync(reason: string) {
    const snapshot = stateRef.current;

    if (!snapshot.isHydrated || isSyncingRef.current || !canSyncWithNetwork(snapshot.network)) {
      return;
    }

    const serverReady =
      snapshot.serverConnection === 'online' ? true : await refreshServerConnection();

    if (!serverReady) {
      return;
    }

    const candidates = stateRef.current.queue.filter(canRetryItem);

    if (candidates.length === 0) {
      return;
    }

    isSyncingRef.current = true;
    dispatch({ type: 'SET_IS_SYNCING', payload: true });

    try {
      for (const candidate of candidates) {
        const liveItem = stateRef.current.queue.find((entry) => entry.localId === candidate.localId);

        if (!liveItem || !['pending', 'error'].includes(liveItem.syncStatus)) {
          continue;
        }

        const syncingItem: QueuedRequest = {
          ...liveItem,
          syncStatus: 'syncing',
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
          updatedAt: new Date().toISOString(),
        };

        dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: syncingItem });

        const result = await syncQueuedRequest(syncingItem);

        if (result.kind === 'success') {
          const syncedItem: QueuedRequest = {
            ...syncingItem,
            syncStatus: 'synced',
            retryCount: 0,
            autoRetryEnabled: true,
            baseVersion: result.data.version,
            serverId: result.data.serverId,
            syncedAt: result.data.syncedAt,
            conflict: null,
            lastError: null,
            updatedAt: result.data.syncedAt,
          };

          dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: syncedItem });
          dispatch({ type: 'SET_LAST_SYNC', payload: result.data.syncedAt });
          dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'online' });
          dispatch({
            type: 'APPEND_HISTORY',
            payload: createHistoryEntry(
              syncedItem.localId,
              'synced',
              true,
              `${reason}: Kayıt sunucu versiyonu (${result.data.version}) ile başarıyla eşlendi.`
            ),
          });
          continue;
        }

        if (result.kind === 'conflict') {
          const conflictItem: QueuedRequest = {
            ...syncingItem,
            syncStatus: 'conflict',
            conflict: result.data,
            lastError: 'Aynı araç ve tarih için sistemde farklı bir kayıt mevcut.',
            updatedAt: new Date().toISOString(),
          };

          dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: conflictItem });
          dispatch({
            type: 'APPEND_HISTORY',
            payload: createHistoryEntry(
              conflictItem.localId,
              'conflict',
              false,
              `${reason}: Veri çakışması algılandı, kullanıcı kararı bekleniyor.`
            ),
          });
          continue;
        }

        const erroredItem: QueuedRequest = {
          ...syncingItem,
          syncStatus: 'error',
          retryCount: syncingItem.retryCount + 1,
          lastAttemptAt: syncingItem.lastAttemptAt,
          autoRetryEnabled:
            syncingItem.draft.vehicleId === 'ERR-500' ? false : syncingItem.autoRetryEnabled,
          lastError: result.message,
          updatedAt: new Date().toISOString(),
        };

        dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: erroredItem });
        if (result.status == null) {
          dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'offline' });
        }
        dispatch({
          type: 'APPEND_HISTORY',
          payload: createHistoryEntry(
            erroredItem.localId,
            'error',
            false,
            `${reason}: ${result.message}`
          ),
        });
      }
    } finally {
      isSyncingRef.current = false;
      dispatch({ type: 'SET_IS_SYNCING', payload: false });
    }
  }

  async function addDraft(draft: ServiceRequestDraft) {
    const now = new Date().toISOString();
    const queuedRequest: QueuedRequest = {
      localId: createId('srv'),
      draft,
      syncStatus: 'pending',
      retryCount: 0,
      lastAttemptAt: null,
      autoRetryEnabled: true,
      baseVersion: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      serverId: null,
      syncedAt: null,
      conflict: null,
    };

    dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: queuedRequest });
    dispatch({
      type: 'APPEND_HISTORY',
      payload: createHistoryEntry(
        queuedRequest.localId,
        'queued',
        true,
        'Talep cihaz hafizasina guvenli bir sekilde kaydedildi.'
      ),
    });

    if (canSyncWithNetwork(stateRef.current.network)) {
      void requestSync('form-submit');
    }
  }

  async function resolveConflict(localId: string, mode: 'overwrite' | 'skip') {
    const liveItem = stateRef.current.queue.find((entry) => entry.localId === localId);

    if (!liveItem || liveItem.syncStatus !== 'conflict') {
      return;
    }

    if (mode === 'skip') {
      const skippedItem: QueuedRequest = {
        ...liveItem,
        syncStatus: 'skipped',
        retryCount: 0,
        conflict: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: skippedItem });
      dispatch({
        type: 'APPEND_HISTORY',
        payload: createHistoryEntry(localId, 'skipped', true, 'Kullanici karari ile kayit atlandi.'),
      });
      return;
    }

    const serverReady = await refreshServerConnection();

    if (!serverReady) {
      return;
    }

    const syncingItem: QueuedRequest = {
      ...liveItem,
      syncStatus: 'syncing',
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: syncingItem });

    const result = await syncQueuedRequest(syncingItem, { overwrite: true });

    if (result.kind === 'success') {
      const syncedItem: QueuedRequest = {
        ...syncingItem,
        syncStatus: 'synced',
        retryCount: 0,
        autoRetryEnabled: true,
        baseVersion: result.data.version,
        serverId: result.data.serverId,
        syncedAt: result.data.syncedAt,
        conflict: null,
        lastError: null,
        updatedAt: result.data.syncedAt,
      };

      dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: syncedItem });
      dispatch({ type: 'SET_LAST_SYNC', payload: result.data.syncedAt });
      dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'online' });
      dispatch({
        type: 'APPEND_HISTORY',
        payload: createHistoryEntry(
          localId,
          'overwrite',
          true,
          'Kullanici karari ile sunucu kaydi guncellendi.'
        ),
      });
      return;
    }

    if (result.kind === 'conflict') {
      const conflictItem: QueuedRequest = {
        ...syncingItem,
        syncStatus: 'conflict',
        conflict: result.data,
        lastError: 'Ayni arac, servis ve gun icin bulutta kayit bulundu.',
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: conflictItem });
      return;
    }

    const erroredItem: QueuedRequest = {
      ...syncingItem,
      syncStatus: 'error',
      retryCount: syncingItem.retryCount + 1,
      lastAttemptAt: syncingItem.lastAttemptAt,
      autoRetryEnabled:
        syncingItem.draft.vehicleId === 'ERR-500' ? false : syncingItem.autoRetryEnabled,
      lastError: result.message,
      conflict: null,
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: 'UPSERT_QUEUE_ITEM', payload: erroredItem });
    if (result.status == null) {
      dispatch({ type: 'SET_SERVER_CONNECTION', payload: 'offline' });
    }
    dispatch({
      type: 'APPEND_HISTORY',
      payload: createHistoryEntry(localId, 'error', false, `Uzerine yazma basarisiz: ${result.message}`),
    });
  }

  function removeQueuedRequest(localId: string) {
    dispatch({ type: 'REMOVE_QUEUE_ITEM', payload: { localId } });
    dispatch({
      type: 'APPEND_HISTORY',
      payload: createHistoryEntry(localId, 'skipped', true, 'Kayit cihazdan silindi.'),
    });
  }

  function getQueuedRequest(localId?: string) {
    if (!localId) {
      return undefined;
    }

    return stateRef.current.queue.find((item) => item.localId === localId);
  }

  useEffect(() => {
    configureNotifications();
    void registerBackgroundSyncTaskAsync();
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [snapshot, network] = await Promise.all([
        loadPersistedSyncSnapshot(),
        getCurrentNetworkSnapshot(),
      ]);

      if (!isMounted) {
        return;
      }

      dispatch({
        type: 'HYDRATE',
        payload: {
          queue: snapshot.queue,
          history: snapshot.history,
          lastSyncAt: snapshot.lastSyncAt,
          network,
        },
      });

      await refreshServerConnection();
      await requestSync('app-start');
      void registerBackgroundSyncTaskAsync();
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((network) => {
      dispatch({ type: 'SET_NETWORK', payload: network });

      void (async () => {
        await refreshServerConnection();

        if (canSyncWithNetwork(network)) {
          await requestSync('network-change');
        }
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState.match(/inactive|background/) && nextState === 'active') {
        void (async () => {
          const network = await getCurrentNetworkSnapshot();
          await hydrateFromStorage(network);
          await refreshServerConnection();
          await requestSync('app-foreground');
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!state.isHydrated) {
      return;
    }

    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
    }

    healthIntervalRef.current = setInterval(() => {
      void refreshServerConnection();
    }, SERVER_HEALTH_POLL_MS);

    return () => {
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }
    };
  }, [state.isHydrated]);

  useEffect(() => {
    if (!state.isHydrated) {
      return;
    }

    void syncPendingReminder(
      state.queue.filter((item) => item.syncStatus === 'pending' || item.syncStatus === 'error').length
    );
  }, [state.isHydrated, state.queue]);

  useEffect(() => {
    if (!state.isHydrated || state.isSyncing || !canSyncWithNetwork(state.network)) {
      return;
    }

    const hasRetryableItem = state.queue.some(canRetryItem);

    if (!hasRetryableItem) {
      return;
    }

    void requestSync('queue-watch');
  }, [
    state.isHydrated,
    state.isSyncing,
    state.network,
    state.serverConnection,
    state.queue,
  ]);

  const value: SyncContextValue = {
    ...state,
    pendingCount: selectPendingCount(state.queue),
    conflictCount: selectConflictItems(state.queue).length,
    isMutating,
    sortedQueue: selectSortedQueue(state.queue),
    addDraft,
    resolveConflict,
    removeQueuedRequest,
    getQueuedRequest,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error('useSyncContext must be used inside SyncProvider.');
  }

  return value;
}
