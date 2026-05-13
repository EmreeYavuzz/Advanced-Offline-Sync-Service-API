import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';
import type { SyncStatus } from '@/src/types/sync';

const statusStyles: Record<SyncStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Bekliyor', bg: theme.warningSoft, fg: theme.warning },
  syncing: { label: 'Gonderiliyor', bg: theme.infoSoft, fg: theme.info },
  synced: { label: 'Gonderildi', bg: theme.successSoft, fg: theme.success },
  error: { label: 'Hata', bg: theme.dangerSoft, fg: theme.danger },
  conflict: { label: 'Cakisma', bg: theme.primarySoft, fg: theme.primary },
  skipped: { label: 'Atlandi', bg: theme.surfaceStrong, fg: theme.slate },
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  const config = statusStyles[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
