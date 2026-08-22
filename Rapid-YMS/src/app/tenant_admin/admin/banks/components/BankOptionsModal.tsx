import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  PlusCircle,
  Download,
  SlidersHorizontal,
  RotateCcw,
  ChevronRight,
} from 'lucide-react-native';

export interface BankOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onAddBankPress?: () => void;
  onRefreshPress?: () => void;
  onExportPress?: () => void;
  onSettingsPress?: () => void;
  canManage?: boolean;
}

export default function BankOptionsModal({
  visible,
  onClose,
  onAddBankPress,
  onRefreshPress,
  onExportPress,
  onSettingsPress,
  canManage = true,
}: BankOptionsModalProps) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible]);

  const handleAction = (callback?: () => void, defaultMessage?: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onClose();
    setTimeout(() => {
      if (callback) {
        callback();
      } else if (defaultMessage) {
        Alert.alert('Bank Action', defaultMessage);
      }
    }, 150);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.headerTitle}>Bank Actions</Text>
                  <Text style={styles.headerSubtitle}>
                    Quick management & tools
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={18} color="#64748B" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Options List (3-4 Options) */}
              <View style={styles.optionsList}>
                {/* 1. Add New Bank */}
                {canManage && (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleAction(onAddBankPress)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                      <PlusCircle size={20} color="#0062FF" strokeWidth={2.2} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>Add New Bank</Text>
                      <Text style={styles.optionSub}>
                        Create direct or 3rd party bank profile
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                  </TouchableOpacity>
                )}

                {/* 2. Export Directory */}
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() =>
                    handleAction(
                      onExportPress,
                      'Export Directory option selected. Export feature will be configured here.'
                    )
                  }
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                    <Download size={19} color="#16A34A" strokeWidth={2.2} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Export Directory</Text>
                    <Text style={styles.optionSub}>
                      Download bank lists & rate cards (CSV/PDF)
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                </TouchableOpacity>

                {/* 3. Rate Configurations / Settings */}
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() =>
                    handleAction(
                      onSettingsPress,
                      'Rate Configurations option selected. Custom rate settings will be managed here.'
                    )
                  }
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
                    <SlidersHorizontal size={19} color="#D97706" strokeWidth={2.2} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Default Rate Settings</Text>
                    <Text style={styles.optionSub}>
                      Adjust yard 3-phase rate baselines
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                </TouchableOpacity>

                {/* 4. Refresh & Sync Data */}
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() =>
                    handleAction(
                      onRefreshPress,
                      'Refreshing bank directory from server.'
                    )
                  }
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#F8FAFC' }]}>
                    <RotateCcw size={19} color="#64748B" strokeWidth={2.2} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Refresh Directory</Text>
                    <Text style={styles.optionSub}>
                      Sync with latest database updates
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 10,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  cancelBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
});
