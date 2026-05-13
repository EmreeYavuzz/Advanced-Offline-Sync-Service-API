import { canSyncWithNetwork, getCurrentNetworkSnapshot } from '@/src/services/networkService';
import { syncPendingReminder } from '@/src/services/notificationService';
import { loadPersistedSyncSnapshot, savePersistedSyncSnapshot } from '@/src/services/storage';
import { createHistoryEntry, checkServerHealth, syncQueuedRequest } from '@/src/services/syncService';
import type { PersistedSyncSnapshot, QueuedRequest, ServerConnectionState } from '@/src/types/sync';

const ERROR_RETRY_COOLDOWN_MS = 15_000;

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

function upsertQueueItem(queue: QueuedRequest[], item: QueuedRequest) {
  const index = queue.findIndex((entry) => entry.localId === item.localId);

  if (index === -1) {
    return [item, ...queue];
  }

  const next = [...queue];
  next[index] = item;
  return next;
}

interface SyncRunResult {
  snapshot: PersistedSyncSnapshot;
  serverConnection: ServerConnectionState;
  didWork: boolean;
  syncedCount: number;
}

export async function runPersistedQueueSync(reason: string): Promise<SyncRunResult> {
  const network = await getCurrentNetworkSnapshot();
  const snapshot = await loadPersistedSyncSnapshot();

  if (!canSyncWithNetwork(network)) {
    return {
      snapshot,
      serverConnection: 'offline',
      didWork: false,
      syncedCount: 0,
    };
  }

  const serverReady = await checkServerHealth();

  if (!serverReady) {
    return {
      snapshot,
      serverConnection: 'offline',
      didWork: false,
      syncedCount: 0,
    };
  }

  let queue = [...snapshot.queue];
  let history = [...snapshot.history];
  let lastSyncAt = snapshot.lastSyncAt;
  let didWork = false;
  let syncedCount = 0;

  const candidates = queue.filter(canRetryItem);

  for (const candidate of candidates) {
    const liveItem = queue.find((entry) => entry.localId === candidate.localId);

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

    queue = upsertQueueItem(queue, syncingItem);
    didWork = true;

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

      queue = upsertQueueItem(queue, syncedItem);
      lastSyncAt = result.data.syncedAt;
      syncedCount += 1;
      history = [
        createHistoryEntry(
          syncedItem.localId,
          'synced',
          true,
          `${reason}: Kayıt sunucu versiyonu (${result.data.version}) ile başarıyla eşlendi.`
        ),
        ...history,
      ].slice(0, 100);
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

      queue = upsertQueueItem(queue, conflictItem);
      history = [
        createHistoryEntry(
          conflictItem.localId,
          'conflict',
          false,
          `${reason}: Veri çakışması algılandı, kullanıcı kararı bekleniyor.`
        ),
        ...history,
      ].slice(0, 100);
      continue;
    }

    const erroredItem: QueuedRequest = {
      ...syncingItem,
      syncStatus: 'error',
      retryCount: syncingItem.retryCount + 1,
      lastAttemptAt: syncingItem.lastAttemptAt,
      autoRetryEnabled: syncingItem.draft.vehicleId === 'ERR-500' ? false : syncingItem.autoRetryEnabled,
      lastError: result.message,
      updatedAt: new Date().toISOString(),
    };

    queue = upsertQueueItem(queue, erroredItem);
    history = [
      createHistoryEntry(erroredItem.localId, 'error', false, `${reason}: ${result.message}`),
      ...history,
    ].slice(0, 100);
  }

  const nextSnapshot: PersistedSyncSnapshot = {
    queue,
    history,
    lastSyncAt,
  };

  await savePersistedSyncSnapshot(nextSnapshot);
  await syncPendingReminder(
    queue.filter((item) => item.syncStatus === 'pending' || item.syncStatus === 'error').length
  );

  return {
    snapshot: nextSnapshot,
    serverConnection: 'online',
    didWork,
    syncedCount,
  };
}
