import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { theme } from '@/src/constants/theme';
import { formatDateTime } from '@/src/utils/format';
import type { QueuedRequest, ServiceRequestDraft, ServerServiceRecord } from '@/src/types/sync';

function DetailOverlay({
  title,
  fields,
  onClose,
}: {
  title: string;
  fields: Array<{ label: string; value: string }>;
  onClose: () => void;
}) {
  return (
    <Pressable onPress={onClose} style={styles.overlay}>
      <Pressable onPress={(event) => event.stopPropagation()} style={styles.overlayCard}>
        <View style={styles.overlayHeader}>
          <Text style={styles.overlayTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        {fields.map((field) => (
          <View key={`${title}-${field.label}`} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{field.label}</Text>
            <Text style={styles.detailValue}>{field.value}</Text>
          </View>
        ))}
      </Pressable>
    </Pressable>
  );
}

function buildDraftFields(record: ServiceRequestDraft) {
  return [
    { label: 'Arac', value: record.vehicleId },
    { label: 'Surucu', value: record.driverName },
    { label: 'Servis Tipi', value: record.serviceType },
    { label: 'Kilometre', value: `${record.odometer} km` },
    { label: 'Istenen Zaman', value: formatDateTime(record.requestedAt) },
    { label: 'Aciklama', value: record.description || '-' },
  ];
}

function buildServerFields(record: ServerServiceRecord) {
  return [
    { label: 'Bulut ID', value: record.serverId },
    { label: 'Versiyon', value: `${record.version}` },
    { label: 'Arac', value: record.draft.vehicleId },
    { label: 'Surucu', value: record.draft.driverName },
    { label: 'Servis Tipi', value: record.draft.serviceType },
    { label: 'Kilometre', value: `${record.draft.odometer} km` },
    { label: 'Son Senkron', value: formatDateTime(record.syncedAt) },
    { label: 'Aciklama', value: record.draft.description || '-' },
  ];
}

function SummaryCard({
  title,
  lines,
  onPress,
}: {
  title: string;
  lines: string[];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {lines.map((line) => (
        <Text key={`${title}-${line}`} style={styles.summaryLine}>
          {line}
        </Text>
      ))}
      <Text style={styles.summaryHint}>Tum ayrinti icin dokun</Text>
    </Pressable>
  );
}

export function ConflictSheet({
  item,
  onOverwrite,
  onSkip,
  onClose,
  isWorking,
}: {
  item: QueuedRequest;
  onOverwrite: () => void;
  onSkip: () => void;
  onClose: () => void;
  isWorking: boolean;
}) {
  const conflict = item.conflict;
  const [openPanel, setOpenPanel] = useState<'cihaz' | 'bulut' | null>(null);

  if (!conflict) {
    return null;
  }

  const sameKeyInfo = [
    `Arac: ${conflict.localRecord.vehicleId}`,
    `Servis: ${conflict.localRecord.serviceType}`,
    `Gun: ${
      formatDateTime(conflict.localRecord.requestedAt).split(' ')[0] ??
      formatDateTime(conflict.localRecord.requestedAt)
    }`,
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.eyebrow}>Veri Cakismasi</Text>
              <Text style={styles.title}>Bu kayit icin bulutta farkli bir veri bulundu.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>X</Text>
            </Pressable>
          </View>

          {sameKeyInfo.map((line) => (
            <Text key={line} style={styles.description}>
              {line}
            </Text>
          ))}
          <Text style={styles.description}>
            Bulutta bu kayda ait versiyon {conflict.serverVersion} var. Hangi verinin kalici olacagina karar ver.
          </Text>
        </View>

        <View style={styles.compareRow}>
          <SummaryCard
            title="Cihazdaki Kayit"
            lines={[
              `Surucu: ${conflict.localRecord.driverName}`,
              `Kilometre: ${conflict.localRecord.odometer} km`,
              `Aciklama: ${conflict.localRecord.description || '-'}`,
            ]}
            onPress={() => setOpenPanel('cihaz')}
          />
          <SummaryCard
            title="Buluttaki Kayit"
            lines={[
              `Surucu: ${conflict.serverRecord.draft.driverName}`,
              `Kilometre: ${conflict.serverRecord.draft.odometer} km`,
              `Aciklama: ${conflict.serverRecord.draft.description || '-'}`,
            ]}
            onPress={() => setOpenPanel('bulut')}
          />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          disabled={isWorking}
          onPress={onSkip}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isWorking ? styles.buttonPressed : null,
          ]}>
          <Text style={styles.secondaryText}>Atla</Text>
        </Pressable>
        <Pressable
          disabled={isWorking}
          onPress={onOverwrite}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isWorking ? styles.buttonPressed : null,
          ]}>
          <Text style={styles.primaryText}>{isWorking ? 'Isleniyor...' : 'Uzerine Yaz'}</Text>
        </Pressable>
      </View>

      {openPanel === 'cihaz' ? (
        <DetailOverlay
          title="Cihazdaki Kayit"
          fields={buildDraftFields(conflict.localRecord)}
          onClose={() => setOpenPanel(null)}
        />
      ) : null}

      {openPanel === 'bulut' ? (
        <DetailOverlay
          title="Buluttaki Kayit"
          fields={buildServerFields(conflict.serverRecord)}
          onClose={() => setOpenPanel(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.bg,
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 20,
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  description: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 16,
  },
  summaryTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  summaryLine: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryHint: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    backgroundColor: theme.bg,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    position: 'absolute',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 18,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    inset: 0,
    justifyContent: 'center',
    padding: 20,
    position: 'absolute',
  },
  overlayCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    maxWidth: 460,
    padding: 18,
    width: '100%',
  },
  overlayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlayTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: theme.surfaceStrong,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  closeText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '900',
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  detailValue: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonPressed: {
    opacity: 0.84,
  },
});
