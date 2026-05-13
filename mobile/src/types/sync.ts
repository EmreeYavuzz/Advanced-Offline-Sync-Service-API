export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'conflict'
  | 'skipped';

export interface ServiceRequestDraft {
  vehicleId: string;
  driverName: string;
  serviceType: string;
  description: string;
  odometer: number;
  requestedAt: string;
}

export interface ServerServiceRecord {
  serverId: string;
  version: number;
  key: string;
  draft: ServiceRequestDraft;
  syncedAt: string;
}

export interface ConflictPayload {
  localRecord: ServiceRequestDraft;
  serverRecord: ServerServiceRecord;
  serverVersion: number;
}

export interface QueuedRequest {
  localId: string;
  draft: ServiceRequestDraft;
  syncStatus: SyncStatus;
  retryCount: number;
  lastAttemptAt?: string | null;
  autoRetryEnabled?: boolean;
  baseVersion: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  serverId?: string | null;
  syncedAt?: string | null;
  conflict?: ConflictPayload | null;
}

export type SyncHistoryAction =
  | 'queued'
  | 'synced'
  | 'error'
  | 'conflict'
  | 'overwrite'
  | 'skipped';

export interface SyncHistoryEntry {
  id: string;
  localId: string;
  action: SyncHistoryAction;
  success: boolean;
  timestamp: string;
  message: string;
}

export interface NetworkSnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}

export type ServerConnectionState = 'online' | 'offline';

export interface SyncState {
  queue: QueuedRequest[];
  history: SyncHistoryEntry[];
  lastSyncAt: string | null;
  network: NetworkSnapshot;
  serverConnection: ServerConnectionState;
  isHydrated: boolean;
  isSyncing: boolean;
}

export interface PersistedSyncSnapshot {
  queue: QueuedRequest[];
  history: SyncHistoryEntry[];
  lastSyncAt: string | null;
}

export interface SyncSuccessResponse {
  serverId: string;
  version: number;
  syncedAt: string;
}
