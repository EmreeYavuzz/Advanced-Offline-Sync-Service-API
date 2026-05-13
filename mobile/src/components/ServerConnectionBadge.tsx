import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';
import { useSyncContext } from '@/src/context/SyncContext';

export function ServerConnectionBadge() {
  const { serverConnection } = useSyncContext();

  const config =
    serverConnection === 'online'
      ? {
          label: 'Sistem Aktif',
          dot: '#2F7D5C',
          bg: '#D9EFE5',
          border: '#79B99B',
        }
      : {
          label: 'Sunucu Çevrimdışı',
          dot: '#B4473C',
          bg: '#F6D4D1',
          border: '#D99A94',
        };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={styles.text}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  text: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '800',
  },
});
