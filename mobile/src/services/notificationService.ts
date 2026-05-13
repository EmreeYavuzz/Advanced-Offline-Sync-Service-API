import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let isConfigured = false;
let reminderId: string | null = null;
let lastReminderPendingCount: number | null = null;
let permissionPromptAttempted = false;
const DEFAULT_CHANNEL_ID = 'service-sync-status';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Servis Senkronizasyonu',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export function configureNotifications() {
  if (isConfigured || Platform.OS === 'web') {
    return;
  }

  void ensureAndroidChannel();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  isConfigured = true;
}

async function ensurePermissions(requestIfNeeded = true) {
  if (Platform.OS === 'web') {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return true;
  }

  if (!requestIfNeeded || !current.canAskAgain || permissionPromptAttempted) {
    return false;
  }

  permissionPromptAttempted = true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function syncPendingReminder(pendingCount: number) {
  if (Platform.OS === 'web') {
    return;
  }

  if (pendingCount <= 0) {
    if (reminderId) {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
      reminderId = null;
    }
    lastReminderPendingCount = null;
    return;
  }

  if (!(await ensurePermissions())) {
    return;
  }

  await ensureAndroidChannel();

  if (reminderId) {
    if (lastReminderPendingCount === pendingCount) {
      return;
    }

    await Notifications.cancelScheduledNotificationAsync(reminderId);
  }

  reminderId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Bekleyen servis formlari var',
      body: `${pendingCount} kayit uygun baglanti geldiginde otomatik senkronize edilecek.`,
      data: {
        url: '/records',
      },
    },
    trigger:
      Platform.OS === 'android'
        ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 120,
          channelId: DEFAULT_CHANNEL_ID,
        }
        : {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 120,
        },
  });
  lastReminderPendingCount = pendingCount;
}

export async function sendBackgroundSyncSuccessNotification(syncedCount: number) {
  if (Platform.OS === 'web' || syncedCount <= 0) {
    return;
  }

  if (!(await ensurePermissions(false))) {
    return;
  }

  await ensureAndroidChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Bekleyen kayitlar gonderildi',
      body: `${syncedCount} kayit ilk uygun firsatta otomatik olarak senkron edildi.`,
      data: {
        url: '/records',
      },
    },
    trigger: null,
  });
}
