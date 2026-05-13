import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';

export function OfflineBanner({
  isOnline,
  pendingCount,
}: {
  isOnline: boolean;
  pendingCount: number;
}) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isOnline ? theme.successSoft : theme.warningSoft,
          borderColor: isOnline ? theme.success : theme.warning,
        },
      ]}>
      <Text style={[styles.title, { color: isOnline ? theme.success : theme.warning }]}>
        {isOnline ? 'Ag baglantisi uygun.' : 'Cevrimdisi mod aktif.'}
      </Text>
      <Text style={styles.message}>
        Kuyrukta {pendingCount} kayit var. Baglanti ve sunucu uygunsa uygulama bunlari otomatik gonderecek.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
