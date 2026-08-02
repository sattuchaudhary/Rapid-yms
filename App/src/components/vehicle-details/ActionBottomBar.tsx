import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import {
  Key,
  Shield,
  RefreshCw,
  Printer,
  Camera,
  Calculator,
  FileText,
  MoreHorizontal,
} from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { VehicleData } from './types';

interface ActionBottomBarProps {
  vehicle: VehicleData;
  photoCount: number;
  insetsBottom: number;
  onPressPrimaryAction: () => void;
  onPressPhotos: () => void;
  onPressCalculator: () => void;
  onPressPdf: () => void;
  onPressMore: () => void;
}

export function ActionBottomBar({
  vehicle,
  photoCount,
  insetsBottom,
  onPressPrimaryAction,
  onPressPhotos,
  onPressCalculator,
  onPressPdf,
  onPressMore,
}: ActionBottomBarProps) {
  const getPrimaryConfig = () => {
    if (vehicle.shiftStatus === 'SHIFT_PENDING') {
      return {
        label: 'Shift Vehicle',
        bg: '#D97706',
        icon: <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 6 }} />,
      };
    }
    if (vehicle.yardStatus === 'KACHHA') {
      return {
        label: 'Complete Verification',
        bg: '#D97706',
        icon: <Shield size={18} color="#FFFFFF" style={{ marginRight: 6 }} />,
      };
    }
    if (
      vehicle.yardStatus === 'RELEASED' ||
      vehicle.status === 'RELEASED' ||
      vehicle.status === 'CHECKED_OUT'
    ) {
      return {
        label: 'Share Gatepass PDF',
        bg: '#2563EB',
        icon: <Printer size={18} color="#FFFFFF" style={{ marginRight: 6 }} />,
      };
    }
    return {
      label: 'Release Vehicle',
      bg: '#16A34A',
      icon: <Key size={18} color="#FFFFFF" style={{ marginRight: 6 }} />,
    };
  };

  const primaryConfig = getPrimaryConfig();

  return (
    <View
      style={[
        styles.stickyBar,
        { paddingBottom: Math.max(insetsBottom, 12) },
      ]}
    >
      {/* 1. Large Full-Width Primary CTA */}
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: primaryConfig.bg }]}
        onPress={onPressPrimaryAction}
        activeOpacity={0.85}
        accessibilityLabel={primaryConfig.label}
        accessibilityRole="button"
      >
        {primaryConfig.icon}
        <ThemedText style={styles.primaryBtnText}>{primaryConfig.label}</ThemedText>
      </TouchableOpacity>

      {/* 2. Secondary Quick Icon Buttons Bar */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={onPressPhotos}
          activeOpacity={0.7}
          accessibilityLabel="Photos"
          accessibilityRole="button"
        >
          <Camera size={18} color="#4F46E5" />
          <ThemedText style={styles.quickLabel}>Photos ({photoCount})</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={onPressCalculator}
          activeOpacity={0.7}
          accessibilityLabel="Calculator"
          accessibilityRole="button"
        >
          <Calculator size={18} color="#4F46E5" />
          <ThemedText style={styles.quickLabel}>Calculator</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={onPressPdf}
          activeOpacity={0.7}
          accessibilityLabel="PDF Report"
          accessibilityRole="button"
        >
          <FileText size={18} color="#4F46E5" />
          <ThemedText style={styles.quickLabel}>PDF Report</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={onPressMore}
          activeOpacity={0.7}
          accessibilityLabel="More Options"
          accessibilityRole="button"
        >
          <MoreHorizontal size={18} color="#4F46E5" />
          <ThemedText style={styles.quickLabel}>More</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  primaryBtn: {
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  quickBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 3,
  },
});
