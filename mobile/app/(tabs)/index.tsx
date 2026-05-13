import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { OfflineBanner } from '@/src/components/OfflineBanner';
import { theme } from '@/src/constants/theme';
import { useSyncContext } from '@/src/context/SyncContext';

const SERVICE_TYPE_OPTIONS = [
  {
    value: 'Bakim',
    label: 'Bakim',
    descriptionPlaceholder: 'Orn: 10.000 km bakimi, yag ve filtre kontrolu gerekiyor.',
  },
  {
    value: 'Lastik',
    label: 'Lastik',
    descriptionPlaceholder: 'Orn: On sol lastikte inme var, balans ve kontrol istiyorum.',
  },
  {
    value: 'Ariza',
    label: 'Ariza',
    descriptionPlaceholder: 'Orn: Motor ikaz lambasi yaniyor, cekis dusuk hissediliyor.',
  },
] as const;

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, multiline ? styles.textarea : null]}
        value={value}
      />
    </View>
  );
}

export default function ServiceFormScreen() {
  const { addDraft, pendingCount, network, sortedQueue } = useSyncContext();
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [serviceType, setServiceType] =
    useState<(typeof SERVICE_TYPE_OPTIONS)[number]['value']>('Bakim');
  const [description, setDescription] = useState('');
  const [odometerDigits, setOdometerDigits] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeServiceType =
    SERVICE_TYPE_OPTIONS.find((option) => option.value === serviceType) ?? SERVICE_TYPE_OPTIONS[0];

  useEffect(() => {
    setDescription('');
  }, [serviceType]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    if (!vehicleId.trim() || !driverName.trim()) {
      Alert.alert('Eksik alan', 'Arac ID ve surucu adi zorunlu.');
      return;
    }

    const odometerNumber = Number(odometerDigits);

    if (!Number.isFinite(odometerNumber)) {
      Alert.alert('Kilometre hatasi', 'Kilometre alani sayisal olmali.');
      return;
    }

    setIsSubmitting(true);

    const today = new Date().toISOString().split('T')[0];
    const isDuplicate = sortedQueue.some((item) => {
      const itemDate = item.draft.requestedAt.split('T')[0];
      return (
        item.draft.vehicleId.toLowerCase() === vehicleId.trim().toLowerCase() &&
        item.draft.serviceType === serviceType &&
        itemDate === today &&
        (item.syncStatus === 'pending' || item.syncStatus === 'error')
      );
    });

    if (isDuplicate) {
      Alert.alert(
        'Zaten bekleyen kayit var',
        'Bu arac icin bugun olusturulmus ve henuz gonderilmemis bir kayit zaten mevcut. Lutfen mevcut kaydin tamamlanmasini bekleyin.'
      );
      setIsSubmitting(false);
      return;
    }

    try {
      await addDraft({
        vehicleId: vehicleId.trim(),
        driverName: driverName.trim(),
        serviceType,
        description: description.trim(),
        odometer: odometerNumber,
        requestedAt: new Date().toISOString(),
      });

      setVehicleId('');
      setDriverName('');
      setServiceType('Bakim');
      setDescription('');
      setOdometerDigits('');

      Alert.alert(
        'Talep kaydedildi',
        'Kayit cihaza alindi. Baglanti uygun oldugunda uygulama bu talebi otomatik gonderecek.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <OfflineBanner
        isOnline={network.isConnected === true && network.isInternetReachable !== false}
        pendingCount={pendingCount}
      />

      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Yeni servis talebi</Text>
          <Text style={styles.formDescription}>
            Form gonderildigi anda once cihaza kaydedilir, baglanti uygunsa otomatik senkron denenir.
          </Text>
        </View>

        <Field
          label="Arac ID"
          placeholder="Orn: 34ABC123"
          value={vehicleId}
          onChangeText={setVehicleId}
        />
        <Field
          label="Surucu Adi"
          placeholder="Orn: Ahmet Yilmaz"
          value={driverName}
          onChangeText={setDriverName}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Servis Tipi</Text>
          <View style={styles.optionRow}>
            {SERVICE_TYPE_OPTIONS.map((option) => {
              const isActive = option.value === serviceType;
              return (
                <Pressable
                  key={option.value}
                  disabled={isSubmitting}
                  onPress={() => setServiceType(option.value)}
                  style={[styles.optionChip, isActive ? styles.optionChipActive : null]}>
                  <Text
                    style={[
                      styles.optionChipText,
                      isActive ? styles.optionChipTextActive : null,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="Aciklama"
          multiline
          placeholder={activeServiceType.descriptionPlaceholder}
          value={description}
          onChangeText={setDescription}
        />

        <Field
          keyboardType="numeric"
          label="Kilometre"
          placeholder="Orn: 125000 km"
          value={odometerDigits ? `${odometerDigits} km` : ''}
          onChangeText={(value) => setOdometerDigits(value.replace(/\D/g, ''))}
        />

        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed || isSubmitting ? styles.buttonPressed : null,
          ]}>
          <Text style={styles.submitText}>
            {isSubmitting ? 'Kaydediliyor...' : 'Talebi kuyruga ekle'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 20,
  },
  formCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  formHeader: {
    borderBottomColor: '#E9DED2',
    borderBottomWidth: 1,
    gap: 6,
    paddingBottom: 12,
  },
  formTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '900',
  },
  formDescription: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFF8F1',
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    color: theme.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionChip: {
    backgroundColor: '#FFF8F1',
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary,
  },
  optionChipText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: theme.primary,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 18,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.82,
  },
});
