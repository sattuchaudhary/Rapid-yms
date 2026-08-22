import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  FileText,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface UploadPickerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onSelectDocument?: () => void;
}

export default function UploadPickerModal({
  visible,
  title,
  subtitle = 'Choose where you want to upload from',
  onClose,
  onSelectCamera,
  onSelectGallery,
  onSelectDocument,
}: UploadPickerModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleAction = (action: () => void) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onClose();
    setTimeout(() => {
      action();
    }, 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sliding Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleBar}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.sparkleCircle}>
                <Sparkles size={16} color="#7C3AED" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.subtitleText}>{subtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Options Cards */}
          <View style={styles.optionsList}>
            {/* 1. Camera Option */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleAction(onSelectCamera)}
              activeOpacity={0.78}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#F5F3FF' }]}>
                <Camera size={22} color="#7C3AED" strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionTitle}>Take Photo with Camera</Text>
                <Text style={styles.actionSubtitle}>
                  Capture a crisp document or live face portrait
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
            </TouchableOpacity>

            {/* 2. Photo Gallery Option */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleAction(onSelectGallery)}
              activeOpacity={0.78}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                <ImageIcon size={22} color="#0062FF" strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionTitle}>Choose from Gallery</Text>
                <Text style={styles.actionSubtitle}>
                  Select saved image from device gallery / album
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
            </TouchableOpacity>

            {/* 3. Document / PDF Option (If applicable) */}
            {onSelectDocument && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => handleAction(onSelectDocument)}
                activeOpacity={0.78}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <FileText size={22} color="#16A34A" strokeWidth={2.2} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={styles.actionTitle}>Browse PDF / Files</Text>
                  <Text style={styles.actionSubtitle}>
                    Upload official PDF or scanned doc file
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 24,
  },
  dragHandleBar: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
  },
  header: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkleCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  titleText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  subtitleText: {
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
  optionsList: {
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  cancelButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#475569',
  },
});
