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
  Plus,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface AddThirdPartyMainModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}

export default function AddThirdPartyMainModal({
  visible,
  onClose,
  onSave,
}: AddThirdPartyMainModalProps) {
  // Default Fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Additional Dynamic Custom Fields (e.g. Manager Number, GST, Contact Person)
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setCustomFields([]);
    }
  }, [visible]);

  const handleAddCustomField = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    const newField: CustomField = {
      id: Date.now().toString(),
      label: '',
      value: '',
    };
    setCustomFields(prev => [...prev, newField]);
  };

  const handleUpdateCustomField = (id: string, key: 'label' | 'value', text: string) => {
    setCustomFields(prev =>
      prev.map(f => (f.id === id ? { ...f, [key]: text } : f))
    );
  };

  const handleRemoveCustomField = (id: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter Name.');
      return;
    }

    setSaving(true);
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Format custom fields summary if provided
      let formattedAddress = address.trim();
      const validCustomFields = customFields.filter(f => f.label.trim() && f.value.trim());
      if (validCustomFields.length > 0) {
        const customDetailsStr = validCustomFields
          .map(f => `${f.label.trim()}: ${f.value.trim()}`)
          .join(' | ');
        formattedAddress = formattedAddress
          ? `${formattedAddress} (${customDetailsStr})`
          : customDetailsStr;
      }

      const payload = {
        name: name.trim(),
        isThirdParty: true,
        bankCategory: 'THIRD_PARTY_BANK',
        branchAddress: formattedAddress || undefined,
        customerCarePhone: phone.trim() || undefined,
        customerCareEmail: email.trim() || undefined,
        parkingEnabled: true,
        parkingWaiverDays: 2,
        parkingPayer: 'CUSTOMER',
        rates: {
          TW: 50,
          THREE_W: 100,
          FW: 150,
          CV: 400,
        },
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add 3rd party.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add 3rd Party Main Bank</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <X size={19} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter Name"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoFocus={true}
              />
            </View>

            {/* 2. Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter Address"
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* 3. Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter Mobile Number"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* 4. Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter Email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Dynamic Custom Fields */}
            {customFields.map((field) => (
              <View key={field.id} style={styles.customFieldRow}>
                <View style={styles.customFieldColLeft}>
                  <Text style={styles.inputLabelSmall}>Option Name</Text>
                  <TextInput
                    style={styles.customTextInput}
                    placeholder="e.g. Manager Number"
                    placeholderTextColor="#94A3B8"
                    value={field.label}
                    onChangeText={text => handleUpdateCustomField(field.id, 'label', text)}
                  />
                </View>
                <View style={styles.customFieldColRight}>
                  <Text style={styles.inputLabelSmall}>Value</Text>
                  <TextInput
                    style={styles.customTextInput}
                    placeholder="Enter value"
                    placeholderTextColor="#94A3B8"
                    value={field.value}
                    onChangeText={text => handleUpdateCustomField(field.id, 'value', text)}
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteCustomBtn}
                  onPress={() => handleRemoveCustomField(field.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#E11D48" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Custom Field Button */}
            <TouchableOpacity
              style={styles.addOptionBtn}
              onPress={handleAddCustomField}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#0062FF" strokeWidth={2.4} />
              <Text style={styles.addOptionBtnText}>Add Additional Option</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    paddingHorizontal: 20,
  },
  formContent: {
    paddingVertical: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  inputLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  customFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customFieldColLeft: {
    flex: 1.1,
  },
  customFieldColRight: {
    flex: 1.2,
  },
  customTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  deleteCustomBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  addOptionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0062FF',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.8,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
