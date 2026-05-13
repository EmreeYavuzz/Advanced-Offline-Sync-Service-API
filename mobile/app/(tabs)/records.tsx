import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner } from '@/src/components/OfflineBanner';
import { StatusBadge } from '@/src/components/StatusBadge';
import { theme } from '@/src/constants/theme';
import { useSyncContext } from '@/src/context/SyncContext';
import { formatDateTime } from '@/src/utils/format';


export default function RecordsScreen() {
  const {
    sortedQueue,
    pendingCount,
    conflictCount,
    lastSyncAt,
    network,
    isSyncing,
    serverConnection,
    removeQueuedRequest,
  } = useSyncContext();


  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={sortedQueue}
      keyExtractor={(item) => item.localId}
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <OfflineBanner
            isOnline={network.isConnected === true && network.isInternetReachable !== false}
            pendingCount={pendingCount}
          />

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{pendingCount}</Text>
              <Text style={styles.metricLabel}>Bekleyen kayit</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{conflictCount}</Text>
              <Text style={styles.metricLabel}>Cakisma</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryTitle}>Veri Esitleme Durumu</Text>
                <Text style={styles.summaryText}>
                  {isSyncing
                    ? 'Kayitlar su anda sirayla sisteme gonderiliyor.'
                    : serverConnection === 'offline'
                      ? 'Sunucuya baglanti yok. Kayitlar guvenle kuyrukta bekliyor.'
                      : 'Sunucu baglantisi hazir. Yeni kayitlar uygun anda otomatik islenir.'}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryDot,
                  { backgroundColor: serverConnection === 'online' ? theme.success : theme.warning },
                ]}
              />
            </View>
            <Text style={styles.summaryMeta}>
              Son basarili senkron: {formatDateTime(lastSyncAt)}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Henuz kayit yok</Text>
          <Text style={styles.emptyText}>
            Form ekranindan ilk servis talebini olusturabilirsin.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{item.draft.vehicleId}</Text>
              <Text style={styles.cardSubtitle}>
                {item.draft.serviceType} - {item.draft.driverName}
              </Text>
            </View>
            <StatusBadge status={item.syncStatus} />
          </View>

          <View style={styles.metaGrid}>
            <Text style={styles.cardMeta}>Local ID: {item.localId}</Text>
            <Text style={styles.cardMeta}>
              Istek zamani: {formatDateTime(item.draft.requestedAt)}
            </Text>
            <Text style={styles.cardMeta}>Versiyon: {item.baseVersion}</Text>
            <Text style={styles.cardMeta}>Retry: {item.retryCount}</Text>
          </View>

          {item.lastError ? <Text style={styles.errorText}>{item.lastError}</Text> : null}

          <View style={styles.actionRow}>
            {item.syncStatus === 'conflict' ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/modal',
                    params: {
                      localId: item.localId,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.resolveButton,
                  pressed ? styles.buttonPressed : null,
                ]}>
                <Text style={styles.resolveText}>Cakismayi cozmeye git</Text>
              </Pressable>
            ) : null}

            {(item.syncStatus === 'error' || item.syncStatus === 'skipped') ? (
              <Pressable
                onPress={() => removeQueuedRequest(item.localId)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed ? styles.buttonPressed : null,
                ]}>
                <Text style={styles.deleteText}>Kaydi kaldir</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 20,
  },
  headerStack: {
    gap: 14,
    marginBottom: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: 16,
  },
  metricValue: {
    color: theme.primary,
    fontSize: 30,
    fontWeight: '900',
  },
  metricLabel: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryText: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '92%',
  },
  summaryMeta: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDot: {
    borderRadius: 999,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  emptyCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 22,
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
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: theme.textMuted,
    fontSize: 13,
  },
  metaGrid: {
    gap: 4,
  },
  cardMeta: {
    color: theme.text,
    fontSize: 13,
  },
  errorText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  resolveButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resolveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surface,
    borderColor: theme.danger,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.84,
  },
});
