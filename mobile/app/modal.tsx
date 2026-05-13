import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { ConflictSheet } from '@/src/components/ConflictSheet';
import { theme } from '@/src/constants/theme';
import { useSyncContext } from '@/src/context/SyncContext';

export default function ModalScreen() {
  const params = useLocalSearchParams<{ localId?: string }>();
  const { getQueuedRequest, resolveConflict, isMutating } = useSyncContext();
  const item = getQueuedRequest(
    Array.isArray(params.localId) ? params.localId[0] : params.localId
  );

  if (!item || item.syncStatus !== 'conflict') {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Cakisma' }} />
        <Text style={styles.emptyTitle}>Aktif cakisma bulunamadi.</Text>
        <Text style={styles.emptyText}>Bu pencere sadece cakisma durumundaki kayitlar icin acilir.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Cakisma', headerShown: false }} />
      <ConflictSheet
        isWorking={isMutating}
        item={item}
        onClose={() => router.back()}
        onSkip={async () => {
          await resolveConflict(item.localId, 'skip');
          router.back();
        }}
        onOverwrite={async () => {
          await resolveConflict(item.localId, 'overwrite');
          router.back();
        }}
      />
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: theme.bg,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
