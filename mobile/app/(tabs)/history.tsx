import { FlatList, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';
import { useSyncContext } from '@/src/context/SyncContext';
import { formatDateTime } from '@/src/utils/format';
import type { SyncHistoryAction } from '@/src/types/sync';

function getActionLabel(action: SyncHistoryAction) {
  switch (action) {
    case 'queued':
      return 'Kuyruga Alindi';
    case 'synced':
      return 'Sisteme Aktarildi';
    case 'error':
      return 'Hata Olustu';
    case 'conflict':
      return 'Veri Cakismasi';
    case 'overwrite':
      return 'Guncellendi';
    case 'skipped':
      return 'Kayit Atlandi';
    default:
      return action;
  }
}

export default function HistoryScreen() {
  const { history } = useSyncContext();

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={history}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Islem gecmisi bulunamadi</Text>
          <Text style={styles.emptyText}>
            Yapilan tum kayit ve esitleme islemleri burada listelenecektir.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            { borderLeftColor: item.success ? theme.success : theme.primary, borderLeftWidth: 4 },
          ]}>
          <Text style={styles.action}>{getActionLabel(item.action)} - {item.localId}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.timestamp}>{formatDateTime(item.timestamp)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 20,
  },
  emptyCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  action: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
