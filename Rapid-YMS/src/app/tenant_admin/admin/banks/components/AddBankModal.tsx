import React, { useState } from 'react';
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
  GitBranch,
  Truck,
  MapPin,
  Phone,
  Mail,
  Plus,
  Trash2,
  Clock,
  UserCheck,
} from 'lucide-react-native';
import { VEHICLE_TYPES, TYPE_LABELS, VehiclePhaseRatesMap } from '../types';

export interface AddBankModalProps {
  visible: boolean;
  initialBankType?: AddBankType;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}

export type AddBankType = 'direct' | 'third_party' | 'shift';

export default function AddBankModal({
  visible,
  initialBankType = 'direct',
  onClose,
  onSave,
}: AddBankModalProps) {
  const [bankType, setBankType] = useState<AddBankType>(initialBankType);
  const [name, setName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [waiverDays, setWaiverDays] = useState('2');
  const [parkingPayer, setParkingPayer] = useState<'CUSTOMER' | 'BANK'>('CUSTOMER');

  // Rates for Direct / Shift
  const [phaseRates, setPhaseRates] = useState<VehiclePhaseRatesMap>({
    TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
    THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
    FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
    CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
  });

  // Sub-banks for Third Party Group
  const [subBanks, setSubBanks] = useState([
    {
      name: '',
      branchAddress: '',
      customerCareEmail: '',
      customerCarePhone: '',
      rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' },
    },
  ]);

  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setBankType(initialBankType);
    }
  }, [visible, initialBankType]);

  const resetForm = () => {
    setBankType(initialBankType);
    setName('');
    setBranchAddress('');
    setPhone('');
    setEmail('');
    setWaiverDays('2');
    setParkingPayer('CUSTOMER');
    setPhaseRates({
      TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
      THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
      FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
      CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
    });
    setSubBanks([
      {
        name: '',
        branchAddress: '',
        customerCareEmail: '',
        customerCarePhone: '',
        rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' },
      },
    ]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddSubBankRow = () => {
    setSubBanks(prev => [
      ...prev,
      {
        name: '',
        branchAddress: '',
        customerCareEmail: '',
        customerCarePhone: '',
        rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' },
      },
    ]);
  };

  const handleRemoveSubBankRow = (index: number) => {
    if (subBanks.length === 1) {
      Alert.alert('Notice', 'At least one sub-bank is recommended for a third party group.');
      return;
    }
    setSubBanks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a valid bank / group name.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        isThirdParty: bankType === 'third_party',
        bankCategory:
          bankType === 'shift'
            ? 'SHIFT_BANK'
            : bankType === 'third_party'
            ? 'THIRD_PARTY_BANK'
            : 'DIRECT_BANK',
        isShiftBank: bankType === 'shift',
        branchAddress: branchAddress.trim() || undefined,
        customerCareEmail: email.trim() || undefined,
        customerCarePhone: phone.trim() || undefined,
        parkingWaiverDays: Number(waiverDays || 0),
        parkingPayer: parkingPayer,
      };

      if (bankType === 'direct' || bankType === 'shift') {
        payload.rates = {
          TW: {
            kachhaRate: Number(phaseRates.TW.kachha || 0),
            pakkaRate: Number(phaseRates.TW.pakka || 0),
            releaseOrderRate: Number(phaseRates.TW.releaseOrder || 0),
            dailyRate: Number(phaseRates.TW.pakka || phaseRates.TW.kachha || 0),
          },
          THREE_W: {
            kachhaRate: Number(phaseRates.THREE_W.kachha || 0),
            pakkaRate: Number(phaseRates.THREE_W.pakka || 0),
            releaseOrderRate: Number(phaseRates.THREE_W.releaseOrder || 0),
            dailyRate: Number(phaseRates.THREE_W.pakka || phaseRates.THREE_W.kachha || 0),
          },
          FW: {
            kachhaRate: Number(phaseRates.FW.kachha || 0),
            pakkaRate: Number(phaseRates.FW.pakka || 0),
            releaseOrderRate: Number(phaseRates.FW.releaseOrder || 0),
            dailyRate: Number(phaseRates.FW.pakka || phaseRates.FW.kachha || 0),
          },
          CV: {
            kachhaRate: Number(phaseRates.CV.kachha || 0),
            pakkaRate: Number(phaseRates.CV.pakka || 0),
            releaseOrderRate: Number(phaseRates.CV.releaseOrder || 0),
            dailyRate: Number(phaseRates.CV.pakka || phaseRates.CV.kachha || 0),
          },
        };
      } else {
        payload.subBanks = subBanks
          .filter(sb => sb.name.trim())
          .map(sb => ({
            name: sb.name.trim(),
            branchAddress: sb.branchAddress?.trim() || undefined,
            customerCareEmail: sb.customerCareEmail?.trim() || undefined,
            customerCarePhone: sb.customerCarePhone?.trim() || undefined,
            rates: {
              TW: Number(sb.rates.TW || 0),
              THREE_W: Number(sb.rates.THREE_W || 0),
              FW: Number(sb.rates.FW || 0),
              CV: Number(sb.rates.CV || 0),
            },
          }));
      }

      await onSave(payload);
      handleClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create bank.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add New Bank</Text>
              <Text style={styles.modalSubtitle}>Register Bank or Third-Party Network</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Bank Type Segmented Selector */}
            <Text style={styles.fieldLabel}>Select Bank Type *</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  bankType === 'direct' && styles.typeOptionActiveDirect,
                ]}
                onPress={() => setBankType('direct')}
                activeOpacity={0.8}
              >
                <Building2
                  size={16}
                  color={bankType === 'direct' ? '#0062FF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    bankType === 'direct' && styles.typeTextActiveDirect,
                  ]}
                >
                  Direct
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  bankType === 'third_party' && styles.typeOptionActiveGroup,
                ]}
                onPress={() => setBankType('third_party')}
                activeOpacity={0.8}
              >
                <GitBranch
                  size={16}
                  color={bankType === 'third_party' ? '#D97706' : '#64748B'}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    bankType === 'third_party' && styles.typeTextActiveGroup,
                  ]}
                >
                  3rd Party
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  bankType === 'shift' && styles.typeOptionActiveShift,
                ]}
                onPress={() => setBankType('shift')}
                activeOpacity={0.8}
              >
                <Truck
                  size={16}
                  color={bankType === 'shift' ? '#16A34A' : '#64748B'}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    bankType === 'shift' && styles.typeTextActiveShift,
                  ]}
                >
                  Shift
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bank / Group Name */}
            <Text style={styles.fieldLabel}>
              {bankType === 'third_party' ? 'Group Name *' : 'Bank Name *'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={
                bankType === 'third_party'
                  ? 'e.g. Swift Recovery Group'
                  : 'e.g. HDFC Bank, SBI Bank'
              }
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
                  placeholder="Care Mobile No."
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
                  placeholder="Care Email ID"
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

            {/* Vehicle Phase Rates (Direct / Shift) */}
            {(bankType === 'direct' || bankType === 'shift') && (
              <View style={styles.ratesBlock}>
                <Text style={styles.sectionHeaderTitle}>
                  Vehicle-Wise 3-Phase Parking Rates (₹/Day)
                </Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Set custom rate for Kachha, Pakka, and Post-Release Order
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
            )}

            {/* Sub-Banks (Third Party) */}
            {bankType === 'third_party' && (
              <View style={styles.subBanksBlock}>
                <View style={styles.subBanksTopRow}>
                  <Text style={styles.sectionHeaderTitle}>Sub-Banks in Group</Text>
                  <TouchableOpacity
                    style={styles.addSubRowBtn}
                    onPress={handleAddSubBankRow}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color="#0062FF" strokeWidth={2.4} />
                    <Text style={styles.addSubRowText}>Add Sub-Bank</Text>
                  </TouchableOpacity>
                </View>

                {subBanks.map((sb, idx) => (
                  <View key={idx} style={styles.subBankInputBox}>
                    <View style={styles.subBankBoxHeader}>
                      <Text style={styles.subBankBoxTitle}>Sub-Bank #{idx + 1}</Text>
                      {subBanks.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveSubBankRow(idx)}
                          style={styles.removeSubBtn}
                        >
                          <Trash2 size={14} color="#E11D48" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="Sub-Bank Name (e.g. ICICI via Swift)"
                      placeholderTextColor="#94A3B8"
                      value={sb.name}
                      onChangeText={val =>
                        setSubBanks(prev =>
                          prev.map((s, i) => (i === idx ? { ...s, name: val } : s))
                        )
                      }
                    />

                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      placeholder="Branch Address (Optional)"
                      placeholderTextColor="#94A3B8"
                      value={sb.branchAddress}
                      onChangeText={val =>
                        setSubBanks(prev =>
                          prev.map((s, i) => (i === idx ? { ...s, branchAddress: val } : s))
                        )
                      }
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Daily Rate (₹)</Text>
                    <View style={styles.subRatesGrid}>
                      {VEHICLE_TYPES.map(t => (
                        <View key={t} style={styles.subRateCol}>
                          <Text style={styles.subRateLabel}>{t}</Text>
                          <TextInput
                            style={styles.subRateInput}
                            value={sb.rates[t]}
                            onChangeText={val =>
                              setSubBanks(prev =>
                                prev.map((s, i) =>
                                  i === idx
                                    ? { ...s, rates: { ...s.rates, [t]: val } }
                                    : s
                                )
                              )
                            }
                            keyboardType="numeric"
                            placeholder="100"
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Modal Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
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
                <Text style={styles.saveBtnText}>Create Bank</Text>
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
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typeOptionActiveDirect: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF6FF',
  },
  typeOptionActiveGroup: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  typeOptionActiveShift: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  typeOptionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  typeTextActiveDirect: {
    color: '#0062FF',
  },
  typeTextActiveGroup: {
    color: '#B45309',
  },
  typeTextActiveShift: {
    color: '#15803D',
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
  subBanksBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subBanksTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addSubRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addSubRowText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  subBankInputBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  subBankBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subBankBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  removeSubBtn: {
    padding: 4,
  },
  subRatesGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  subRateCol: {
    flex: 1,
    alignItems: 'center',
  },
  subRateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  subRateInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
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
