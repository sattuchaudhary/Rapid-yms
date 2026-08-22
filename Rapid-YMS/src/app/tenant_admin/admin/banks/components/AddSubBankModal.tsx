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
  GitBranch,
  Phone,
  Mail,
} from 'lucide-react-native';
import { Bank, VEHICLE_TYPES, TYPE_SHORT_LABELS } from '../types';

export interface AddSubBankModalProps {
  visible: boolean;
  parentGroup: Bank | null;
  onClose: () => void;
  onSave: (parentId: string, subBankPayload: any) => Promise<void>;
}

export default function AddSubBankModal({
  visible,
  parentGroup,
  onClose,
  onSave,
}: AddSubBankModalProps) {
  const [subName, setSubName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rates, setRates] = useState<Record<string, string>>({
    TW: '50',
    THREE_W: '100',
    FW: '150',
    CV: '400',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSubName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setRates({
        TW: '50',
        THREE_W: '100',
        FW: '150',
        CV: '400',
      });
    }
  }, [visible]);

  if (!parentGroup) return null;

  const handleSubmit = async () => {
    if (!subName.trim()) {
      Alert.alert('Required', 'Please enter sub-bank name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: subName.trim(),
        isThirdParty: false,
        parentId: parentGroup.id,
        branchAddress: address.trim() || undefined,
        customerCareEmail: email.trim() || undefined,
        customerCarePhone: phone.trim() || undefined,
        rates: {
          TW: Number(rates.TW || 0),
          THREE_W: Number(rates.THREE_W || 0),
          FW: Number(rates.FW || 0),
          CV: Number(rates.CV || 0),
        },
      };

      await onSave(parentGroup.id, payload);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add sub-bank.');
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
              <Text style={styles.modalTitle}>Add Sub-Bank</Text>
              <Text style={styles.modalSubtitle}>To {parentGroup.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Sub-Bank Name */}
            <Text style={styles.fieldLabel}>Sub-Bank Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ICICI Bank (via Swift)"
              placeholderTextColor="#94A3B8"
              value={subName}
              onChangeText={setSubName}
            />

            {/* Branch Address */}
            <Text style={styles.fieldLabel}>Branch Address (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Civil Lines Branch"
              placeholderTextColor="#94A3B8"
              value={address}
              onChangeText={setAddress}
            />

            {/* Contacts */}
            <Text style={styles.fieldLabel}>Contact Details</Text>
            <View style={styles.contactInputsRow}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Phone size={14} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Mobile"
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
                  placeholder="Email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Daily Rates */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Daily Parking Rates (₹)</Text>
            <View style={styles.ratesGrid}>
              {VEHICLE_TYPES.map(t => (
                <View key={t} style={styles.rateCol}>
                  <Text style={styles.rateColLabel}>{TYPE_SHORT_LABELS[t]}</Text>
                  <TextInput
                    style={styles.rateInputField}
                    value={rates[t]}
                    onChangeText={val => setRates(prev => ({ ...prev, [t]: val }))}
                    keyboardType="numeric"
                    placeholder="100"
                  />
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
                <Text style={styles.saveBtnText}>Add Sub-Bank</Text>
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
    maxHeight: '85%',
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
  ratesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  rateCol: {
    flex: 1,
    alignItems: 'center',
  },
  rateColLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  rateInputField: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
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
