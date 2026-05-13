import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { sendBackgroundSyncSuccessNotification } from '@/src/services/notificationService';
import { runPersistedQueueSync } from '@/src/services/syncRunner';

export const SERVICE_SYNC_BACKGROUND_TASK = 'service-request-sync-task';

if (!TaskManager.isTaskDefined(SERVICE_SYNC_BACKGROUND_TASK)) {
  TaskManager.defineTask(SERVICE_SYNC_BACKGROUND_TASK, async () => {
    try {
      const result = await runPersistedQueueSync('background-task');

      if (result.syncedCount > 0) {
        await sendBackgroundSyncSuccessNotification(result.syncedCount);
      }

      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSyncTaskAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SERVICE_SYNC_BACKGROUND_TASK);

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(SERVICE_SYNC_BACKGROUND_TASK, {
        minimumInterval: 15 * 60,
      });
    }
  } catch {
    // Expo Go and simulators may not support this consistently; keep app flow resilient.
  }
}

export async function getBackgroundSyncDebugStateAsync() {
  const [status, isRegistered] = await Promise.all([
    BackgroundTask.getStatusAsync(),
    TaskManager.isTaskRegisteredAsync(SERVICE_SYNC_BACKGROUND_TASK),
  ]);

  return {
    status,
    isRegistered,
  };
}

export async function triggerBackgroundSyncTaskForTestingAsync() {
  await BackgroundTask.triggerTaskWorkerForTestingAsync();
}
