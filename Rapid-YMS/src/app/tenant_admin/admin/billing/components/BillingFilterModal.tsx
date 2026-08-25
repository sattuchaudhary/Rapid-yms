import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Platform,
} from 'react-native';
import {
  Calendar,
  Check,
  X,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type BillingTimeFilter = 'all_time' | 'this_month' | 'last_month' | 'today' | 'custom';

export interface BillingFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFilter: BillingTimeFilter;
  customStartDate?: string;
  customEndDate?: string;
  onApplyFilter: (
    filter: BillingTimeFilter,
    customDates?: { startDate: string; endDate: string }
  ) => void;
}

const FILTER_OPTIONS: { id: BillingTimeFilter; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'today', label: 'Today' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
];

export default function BillingFilterModal({
  visible,
  onClose,
  selectedFilter,
  customStartDate = '',
  customEndDate = '',
  onApplyFilter,
}: BillingFilterModalProps) {
  const [activeFilter, setActiveFilter] = useState<BillingTimeFilter>(selectedFilter);
  const [startDate, setStartDate] = useState(customStartDate);
  const [endDate, setEndDate] = useState(customEndDate);

  const handleSelectOption = (filterId: BillingTimeFilter) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setActiveFilter(filterId);
    if (filterId !== 'custom') {
      onApplyFilter(filterId);
      onClose();
    }
  };

  const handleApplyCustom = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onApplyFilter('custom', { startDate, endDate });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Period</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Options */}
              <View style={styles.optionsList}>
                {FILTER_OPTIONS.map((item) => {
                  const isSelected = activeFilter === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => handleSelectOption(item.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Date Inputs */}
              {activeFilter === 'custom' && (
                <View style={styles.customDateContainer}>
                  <View style={styles.dateInputsRow}>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Start (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.dateInput}
                        placeholder="2026-01-01"
                        placeholderTextColor="#94A3B8"
                        value={startDate}
                        onChangeText={setStartDate}
                      />
                    </View>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>End (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.dateInput}
                        placeholder="2026-12-31"
                        placeholderTextColor="#94A3B8"
                        value={endDate}
                        onChangeText={setEndDate}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={handleApplyCustom}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                    <ChevronRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  optionCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  optionLabelSelected: {
    color: '#0062FF',
    fontWeight: '700',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    backgroundColor: '#0062FF',
    borderColor: '#0062FF',
  },
  customDateContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  applyBtn: {
    backgroundColor: '#0062FF',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
