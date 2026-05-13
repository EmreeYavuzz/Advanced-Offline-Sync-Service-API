import { Platform } from 'react-native';

import { appConfig } from '@/src/config/appConfig';
import { getDateOnly } from '@/src/utils/format';
import type {
  ConflictPayload,
  QueuedRequest,
  ServiceRequestDraft,
  SyncHistoryAction,
  SyncHistoryEntry,
  SyncSuccessResponse,
} from '@/src/types/sync';

type SyncRequestResult =
  | { kind: 'success'; data: SyncSuccessResponse }
  | { kind: 'conflict'; data: ConflictPayload }
  | { kind: 'error'; message: string; status?: number };

const HEALTH_TIMEOUT_MS = 2_500;
const SYNC_TIMEOUT_MS = 8_000;

let activeApiBaseUrl = appConfig.apiBaseUrl;

function getCandidateApiBaseUrls() {
  const urls = [
    process.env.EXPO_PUBLIC_API_URL,
    activeApiBaseUrl,
    appConfig.apiBaseUrl,
    Platform.OS === 'android' ? 'http://10.0.2.2:4000' : null,
    'http://localhost:4000',
  ].filter((value): value is string => Boolean(value));

  return [...new Set(urls)];
}

function getMessageFromBody(payload: unknown) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;
    return typeof message === 'string' ? message : null;
  }

  return null;
}

export function buildRequestKey(draft: ServiceRequestDraft) {
  return `${draft.vehicleId}__${draft.serviceType}__${getDateOnly(draft.requestedAt)}`;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryHealthCheck(baseUrl: string) {
  const response = await fetchWithTimeout(
    `${baseUrl}/health`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
    HEALTH_TIMEOUT_MS
  );

  return response.ok;
}

export async function checkServerHealth() {
  const candidates = getCandidateApiBaseUrls();

  for (const baseUrl of candidates) {
    try {
      const isHealthy = await tryHealthCheck(baseUrl);

      if (isHealthy) {
        activeApiBaseUrl = baseUrl;
        return true;
      }
    } catch {
      // try next candidate
    }
  }

  return false;
}

export async function syncQueuedRequest(
  item: QueuedRequest,
  options?: { overwrite?: boolean }
): Promise<SyncRequestResult> {
  const candidates = getCandidateApiBaseUrls();

  for (const baseUrl of candidates) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/service-requests/sync`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            localId: item.localId,
            draft: item.draft,
            overwrite: options?.overwrite ?? false,
            baseVersion: item.baseVersion,
          }),
        },
        SYNC_TIMEOUT_MS
      );

      activeApiBaseUrl = baseUrl;

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.status === 409) {
        return {
          kind: 'conflict',
          data: payload as ConflictPayload,
        };
      }

      if (!response.ok) {
        return {
          kind: 'error',
          message:
            getMessageFromBody(payload) ??
            `Sunucu senkronizasyonu reddetti (${response.status}).`,
          status: response.status,
        };
      }

      return {
        kind: 'success',
        data: payload as SyncSuccessResponse,
      };
    } catch {
      // try next candidate
    }
  }

  return {
    kind: 'error',
    message: 'Sunucuya ulasilamadi. Baglanti veya API adresini kontrol et.',
  };
}

export function createHistoryEntry(
  localId: string,
  action: SyncHistoryAction,
  success: boolean,
  message: string
): SyncHistoryEntry {
  return {
    id: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    localId,
    action,
    success,
    timestamp: new Date().toISOString(),
    message,
  };
}
