import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  UserCheck,
} from 'lucide-react-native';
import { Bank, VEHICLE_TYPES, TYPE_LABELS, VehiclePhaseRatesMap } from '../types';

export interface EditBankModalProps {
  visible: boolean;
  bank: Bank | null;
  onClose: () => void;
  onSave: (bankId: string, details: any, phaseRates: VehiclePhaseRatesMap) => Promise<void>;
}

export default function EditBankModal({
  visible,
  bank,
  onClose,
  onSave,
}: EditBankModalProps) {
  const [name, setName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [waiverDays, setWaiverDays] = useState('2');
  const [parkingPayer, setParkingPayer] = useState<'CUSTOMER' | 'BANK'>('CUSTOMER');

  const [phaseRates, setPhaseRates] = useState<VehiclePhaseRatesMap>({
    TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
    THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
    FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
    CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bank) {
      setName(bank.name || '');
      setBranchAddress(bank.branchAddress || '');
      setPhone(bank.customerCarePhone || '');
      setEmail(bank.customerCareEmail || '');
      setWaiverDays(bank.parkingWaiverDays?.toString() || '2');
      setParkingPayer(bank.parkingPayer || 'CUSTOMER');

      const initialRates: VehiclePhaseRatesMap = {
        TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
        THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
        FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
        CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
      };

      VEHICLE_TYPES.forEach(type => {
        const match = bank.parkingRates?.find(r => r.vehicleType === type);
        if (match) {
          initialRates[type] = {
            kachha: String(match.kachhaRate || match.dailyRate || 50),
            pakka: String(match.pakkaRate || match.dailyRate || 100),
            releaseOrder: String(match.releaseOrderRate || match.dailyRate || 150),
          };
        }
      });

      setPhaseRates(initialRates);
    }
  }, [bank, visible]);

  if (!bank) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a valid bank name.');
      return;
    }

    setSaving(true);
    try {
      const detailsPayload = {
        name: name.trim(),
        branchAddress: branchAddress.trim() || null,
        customerCareEmail: email.trim() || null,
        customerCarePhone: phone.trim() || null,
        parkingWaiverDays: Number(waiverDays || 0),
        parkingPayer: parkingPayer,
      };

      await onSave(bank.id, detailsPayload, phaseRates);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update bank.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Bank Details</Text>
              <Text style={styles.modalSubtitle}>{bank.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Bank Name */}
            <Text style={styles.fieldLabel}>Bank Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HDFC Bank"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />

            {/* Branch Address */}
            <Text style={styles.fieldLabel}>Branch / Office Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Civil Lines, Main Road, Kanpur"
              placeholderTextColor="#94A3B8"
              value={branchAddress}
              onChangeText={setBranchAddress}
            />

            {/* Contact Details */}
            <Text style={styles.fieldLabel}>Customer Care Contacts</Text>
            <View style={styles.contactInputsRow}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Phone size={14} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Care Phone"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Mail size={14} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Care Email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Parking Waiver & Payer Settings */}
            <View style={styles.settingsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Free Waiver (Days)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={waiverDays}
                  onChangeText={setWaiverDays}
                />
              </View>

              <View style={{ flex: 1.2 }}>
                <Text style={styles.fieldLabel}>Parking Payer</Text>
                <View style={styles.payerToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.payerToggleBtn,
                      parkingPayer === 'CUSTOMER' && styles.payerToggleActive,
                    ]}
                    onPress={() => setParkingPayer('CUSTOMER')}
                  >
                    <Text
                      style={[
                        styles.payerToggleText,
                        parkingPayer === 'CUSTOMER' && styles.payerToggleTextActive,
                      ]}
                    >
                      Customer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.payerToggleBtn,
                      parkingPayer === 'BANK' && styles.payerToggleActive,
                    ]}
                    onPress={() => setParkingPayer('BANK')}
                  >
                    <Text
                      style={[
                        styles.payerToggleText,
                        parkingPayer === 'BANK' && styles.payerToggleTextActive,
                      ]}
                    >
                      Bank
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Vehicle Phase Rates */}
            <View style={styles.ratesBlock}>
              <Text style={styles.sectionHeaderTitle}>
                Vehicle-Wise 3-Phase Parking Rates (₹/Day)
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Updated daily charges applied to newly parked vehicles
              </Text>

              {VEHICLE_TYPES.map(type => (
                <View key={type} style={styles.vehicleRateCard}>
                  <Text style={styles.vehicleTypeHeading}>{TYPE_LABELS[type]}</Text>
                  <View style={styles.ratesInputRow}>
                    <View style={styles.rateCol}>
                      <Text style={styles.rateColLabelKachha}>🟡 Kachha</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={phaseRates[type].kachha}
                        onChangeText={val =>
                          setPhaseRates(prev => ({
                            ...prev,
                            [type]: { ...prev[type], kachha: val },
                          }))
                        }
                        keyboardType="numeric"
                        placeholder="50"
                      />
                    </View>

                    <View style={styles.rateCol}>
                      <Text style={styles.rateColLabelPakka}>🟢 Pakka</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={phaseRates[type].pakka}
                        onChangeText={val =>
                          setPhaseRates(prev => ({
                            ...prev,
                            [type]: { ...prev[type], pakka: val },
                          }))
                        }
                        keyboardType="numeric"
                        placeholder="100"
                      />
                    </View>

                    <View style={styles.rateCol}>
                      <Text style={styles.rateColLabelRO}>🔵 Post RO</Text>
                      <TextInput
                        style={styles.rateInputField}
                        value={phaseRates[type].releaseOrder}
                        onChangeText={val =>
                          setPhaseRates(prev => ({
                            ...prev,
                            [type]: { ...prev[type], releaseOrder: val },
                          }))
                        }
                        keyboardType="numeric"
                        placeholder="150"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
  },
  contactInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 6,
  },
  iconInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 12.5,
    color: '#0F172A',
  },
  settingsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  payerToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  payerToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  payerToggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  payerToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  payerToggleTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
  ratesBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    marginTop: 2,
  },
  vehicleRateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 8,
  },
  vehicleTypeHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  ratesInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rateCol: {
    flex: 1,
  },
  rateColLabelKachha: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  rateColLabelPakka: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 2,
  },
  rateColLabelRO: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
    marginBottom: 2,
  },
  rateInputField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    paddingVertical: 6,
    color: '#0F172A',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
