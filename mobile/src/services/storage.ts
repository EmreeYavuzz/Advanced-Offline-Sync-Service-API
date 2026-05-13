import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistedSyncSnapshot } from '@/src/types/sync';

export const STORAGE_KEYS = {
  queue: 'service_requests_queue',
  history: 'service_requests_history',
  lastSync: 'service_requests_last_sync',
} as const;

async function readJson<T>(key: string, fallback: T) {
  const raw = await AsyncStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadPersistedSyncSnapshot(): Promise<PersistedSyncSnapshot> {
  const [queue, history, lastSyncAt] = await Promise.all([
    readJson(STORAGE_KEYS.queue, []),
    readJson(STORAGE_KEYS.history, []),
    AsyncStorage.getItem(STORAGE_KEYS.lastSync),
  ]);

  return {
    queue,
    history,
    lastSyncAt,
  };
}

export async function savePersistedSyncSnapshot(snapshot: PersistedSyncSnapshot) {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(snapshot.queue)),
    AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(snapshot.history)),
    snapshot.lastSyncAt
      ? AsyncStorage.setItem(STORAGE_KEYS.lastSync, snapshot.lastSyncAt)
      : AsyncStorage.removeItem(STORAGE_KEYS.lastSync),
  ]);
}
