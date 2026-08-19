import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Car,
  User,
  Shield,
  Clock,
  X,
  RotateCcw,
} from 'lucide-react-native';
import { getVehicleById, updateVehicle } from '@/services/api';

const STATUS_OPTIONS = [
  { key: 'KACHHA', label: 'Kachha (Entry)', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  { key: 'PAKKA', label: 'Pakka (In Yard)', color: '#0062FF', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'RELEASED', label: 'Released (Exit)', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
];

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form States
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [bankName, setBankName] = useState('');
  const [repoAgency, setRepoAgency] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [yardStatus, setYardStatus] = useState<'KACHHA' | 'PAKKA' | 'RELEASED'>('KACHHA');

  // Dates States
  const [entryDate, setEntryDate] = useState<Date | null>(null);
  const [kachhaStartDate, setKachhaStartDate] = useState<Date | null>(null);
  const [repoKitDate, setRepoKitDate] = useState<Date | null>(null);
  const [pakkaDate, setPakkaDate] = useState<Date | null>(null);
  const [releaseOrderDate, setReleaseOrderDate] = useState<Date | null>(null);

  // Date Picker Active Field State
  const [activeDateField, setActiveDateField] = useState<
    'entryDate' | 'kachhaStartDate' | 'repoKitDate' | 'pakkaDate' | 'releaseOrderDate' | null
  >(null);

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const fetchVehicle = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getVehicleById(id);
      const v = res?.data || res;
      if (v) {
        setVehicleNumber(v.vehicleNumber || '');
        setBrand(v.brand || '');
        setModel(v.model || '');
        setColor(v.color || '');
        setBankName(v.bankName || v.bank?.name || '');
        setRepoAgency(v.repoAgency || '');
        setChassisNumber(v.chassisNumber || '');
        setEngineNumber(v.engineNumber || '');
        setCustomerName(v.customerName || '');
        setCustomerPhone(v.customerPhone || '');
        setYardStatus(v.yardStatus || 'KACHHA');

        if (v.entryDate) setEntryDate(new Date(v.entryDate));
        if (v.kachhaStartDate) setKachhaStartDate(new Date(v.kachhaStartDate));
        if (v.repoKitDate) setRepoKitDate(new Date(v.repoKitDate));
        if (v.pakkaDate) setPakkaDate(new Date(v.pakkaDate));
        if (v.releaseOrderDate) setReleaseOrderDate(new Date(v.releaseOrderDate));
      }
    } catch (err: any) {
      console.warn('[Fetch Vehicle Error]', err);
      Alert.alert('Error', err?.message || 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  // Status Change Handler with Auto-Reset Logic
  const handleStatusChange = (newStatus: 'KACHHA' | 'PAKKA' | 'RELEASED') => {
    if (newStatus === 'KACHHA' && yardStatus !== 'KACHHA') {
      Alert.alert(
        'Revert to Kachha Status',
        'Switching back to Kachha will reset Pakka date, Repo kit date, and release order date back to clean initial state. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Reset to Kachha',
            style: 'destructive',
            onPress: () => {
              setYardStatus('KACHHA');
              setPakkaDate(null);
              setRepoKitDate(null);
              setReleaseOrderDate(null);
            },
          },
        ]
      );
      return;
    }

    setYardStatus(newStatus);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const field = activeDateField;
    setActiveDateField(null);

    if (selectedDate && field) {
      if (field === 'entryDate') setEntryDate(selectedDate);
      if (field === 'kachhaStartDate') setKachhaStartDate(selectedDate);
      if (field === 'repoKitDate') setRepoKitDate(selectedDate);
      if (field === 'pakkaDate') setPakkaDate(selectedDate);
      if (field === 'releaseOrderDate') setReleaseOrderDate(selectedDate);
    }
  };

  const handleSave = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Validation Error', 'Vehicle Number is required.');
      return;
    }

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setSaving(true);

      const payload: any = {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim(),
        bankName: bankName.trim(),
        repoAgency: repoAgency.trim(),
        chassisNumber: chassisNumber.trim().toUpperCase(),
        engineNumber: engineNumber.trim().toUpperCase(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        yardStatus,
        entryDate: entryDate ? entryDate.toISOString() : null,
        kachhaStartDate: kachhaStartDate ? kachhaStartDate.toISOString() : null,
        repoKitDate: repoKitDate ? repoKitDate.toISOString() : null,
        pakkaDate: pakkaDate ? pakkaDate.toISOString() : null,
        releaseOrderDate: releaseOrderDate ? releaseOrderDate.toISOString() : null,
      };

      await updateVehicle(id!, payload);

      Alert.alert('Success', 'Vehicle details, status and lifecycle dates updated successfully.', [
        {
          text: 'OK',
          onPress: () => {
            router.replace(`/tenant_admin/admin/vehicles/details/${id}` as any);
          },
        },
      ]);
    } catch (err: any) {
      console.warn('[Update Vehicle Error]', err);
      Alert.alert('Save Failed', err?.message || 'Failed to update vehicle details.');
    } finally {
      setSaving(false);
    }
  };

  const formatDateDisplay = (d: Date | null) => {
    if (!d) return 'Not set / None';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Edit Vehicle & Dates</Text>
            <Text style={styles.headerSub}>Correct status, lifecycle & details</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading vehicle details...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 85 }]}
        >
          {/* 1. YARD STATUS CORRECTION SECTION */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <AlertTriangle size={17} color="#D97706" strokeWidth={2.2} />
              <Text style={styles.sectionTitle}>Yard Status Correction</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Select the real current status of the vehicle. If reverting to Kachha, Pakka and Repo Kit dates will be automatically reset.
            </Text>

            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = yardStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.statusOptionBtn,
                      isSelected && {
                        backgroundColor: opt.bg,
                        borderColor: opt.color,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => handleStatusChange(opt.key as any)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.statusRadioCircle,
                        isSelected && { borderColor: opt.color },
                      ]}
                    >
                      {isSelected && <View style={[styles.statusRadioDot, { backgroundColor: opt.color }]} />}
                    </View>
                    <Text
                      style={[
                        styles.statusOptionText,
                        isSelected && { color: opt.color, fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2. LIFECYCLE DATES EDIT SECTION */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Clock size={17} color="#0062FF" strokeWidth={2.2} />
              <Text style={styles.sectionTitle}>Lifecycle Timeline Dates</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Edit, set, or clear specific timeline dates:
            </Text>

            {/* Entry Date */}
            <View style={styles.dateFieldBlock}>
              <Text style={styles.inputLabel}>1. Yard Gate Entry Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setActiveDateField('entryDate')}
                  activeOpacity={0.75}
                >
                  <Calendar size={16} color="#0062FF" />
                  <Text style={[styles.datePickerValText, !entryDate && styles.placeholderText]}>
                    {formatDateDisplay(entryDate)}
                  </Text>
                </TouchableOpacity>
                {entryDate && (
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => setEntryDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={15} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Kachha Start Date */}
            <View style={styles.dateFieldBlock}>
              <Text style={styles.inputLabel}>2. Kachha Phase Start Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setActiveDateField('kachhaStartDate')}
                  activeOpacity={0.75}
                >
                  <Calendar size={16} color="#D97706" />
                  <Text style={[styles.datePickerValText, !kachhaStartDate && styles.placeholderText]}>
                    {formatDateDisplay(kachhaStartDate)}
                  </Text>
                </TouchableOpacity>
                {kachhaStartDate && (
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => setKachhaStartDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={15} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Repo Kit Date */}
            <View style={styles.dateFieldBlock}>
              <Text style={styles.inputLabel}>3. Repo Kit Verification Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setActiveDateField('repoKitDate')}
                  activeOpacity={0.75}
                >
                  <Calendar size={16} color="#0062FF" />
                  <Text style={[styles.datePickerValText, !repoKitDate && styles.placeholderText]}>
                    {formatDateDisplay(repoKitDate)}
                  </Text>
                </TouchableOpacity>
                {repoKitDate && (
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => setRepoKitDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={15} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Pakka Date */}
            <View style={styles.dateFieldBlock}>
              <Text style={styles.inputLabel}>4. Pakka Yard Transition Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setActiveDateField('pakkaDate')}
                  activeOpacity={0.75}
                >
                  <Calendar size={16} color="#0062FF" />
                  <Text style={[styles.datePickerValText, !pakkaDate && styles.placeholderText]}>
                    {formatDateDisplay(pakkaDate)}
                  </Text>
                </TouchableOpacity>
                {pakkaDate && (
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => setPakkaDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={15} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Release Order Date */}
            <View style={styles.dateFieldBlock}>
              <Text style={styles.inputLabel}>5. Release Order Date</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setActiveDateField('releaseOrderDate')}
                  activeOpacity={0.75}
                >
                  <Calendar size={16} color="#7C3AED" />
                  <Text style={[styles.datePickerValText, !releaseOrderDate && styles.placeholderText]}>
                    {formatDateDisplay(releaseOrderDate)}
                  </Text>
                </TouchableOpacity>
                {releaseOrderDate && (
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => setReleaseOrderDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={15} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* 3. VEHICLE IDENTIFICATION & BANK DETAILS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Car size={17} color="#0062FF" strokeWidth={2.2} />
              <Text style={styles.sectionTitle}>Vehicle & Bank Information</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Vehicle Number</Text>
              <TextInput
                style={styles.textInput}
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="e.g. DL01AB1234"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.rowTwoInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Brand / Make</Text>
                <TextInput
                  style={styles.textInput}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="e.g. Maruti"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Model</Text>
                <TextInput
                  style={styles.textInput}
                  value={model}
                  onChangeText={setModel}
                  placeholder="e.g. Swift"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Color</Text>
              <TextInput
                style={styles.textInput}
                value={color}
                onChangeText={setColor}
                placeholder="e.g. White"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Bank / Financier Name</Text>
              <TextInput
                style={styles.textInput}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. HDFC Bank"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Repo Agency</Text>
              <TextInput
                style={styles.textInput}
                value={repoAgency}
                onChangeText={setRepoAgency}
                placeholder="e.g. Fast Track Repo Agency"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Chassis Number</Text>
              <TextInput
                style={styles.textInput}
                value={chassisNumber}
                onChangeText={setChassisNumber}
                placeholder="Chassis Number"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Engine Number</Text>
              <TextInput
                style={styles.textInput}
                value={engineNumber}
                onChangeText={setEngineNumber}
                placeholder="Engine Number"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.rowTwoInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Customer Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Customer Name"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Customer Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Date Picker Modal */}
      {activeDateField && (
        <DateTimePicker
          value={
            activeDateField === 'entryDate' && entryDate
              ? entryDate
              : activeDateField === 'kachhaStartDate' && kachhaStartDate
              ? kachhaStartDate
              : activeDateField === 'repoKitDate' && repoKitDate
              ? repoKitDate
              : activeDateField === 'pakkaDate' && pakkaDate
              ? pakkaDate
              : activeDateField === 'releaseOrderDate' && releaseOrderDate
              ? releaseOrderDate
              : new Date()
          }
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {/* Sticky Save Button */}
      {!loading && (
        <View style={[styles.stickyFooter, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  statusGrid: {
    gap: 8,
  },
  statusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  statusRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dateFieldBlock: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  datePickerValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  clearDateBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formGroup: {
    gap: 4,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  saveBtn: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#0062FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
