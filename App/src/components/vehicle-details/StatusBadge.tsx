import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { VehicleData } from './types';

interface StatusBadgeProps {
  vehicle: VehicleData;
  size?: 'small' | 'medium' | 'large';
}

export function StatusBadge({ vehicle, size = 'medium' }: StatusBadgeProps) {
  const getBadgeConfig = () => {
    if (vehicle.shiftStatus === 'SHIFT_PENDING') {
      return {
        label: '🚚 Shift Pending',
        bg: '#FEF3C7',
        color: '#B45309',
        border: '#FDE68A',
      };
    }
    if (vehicle.yardStatus === 'KACHHA') {
      return {
        label: '🟡 Pending Verification',
        bg: '#FFFBEB',
        color: '#D97706',
        border: '#FDE68A',
      };
    }
    if (
      vehicle.yardStatus === 'RELEASED' ||
      vehicle.status === 'RELEASED' ||
      vehicle.status === 'CHECKED_OUT'
    ) {
      return {
        label: '🔵 Released',
        bg: '#EFF6FF',
        color: '#2563EB',
        border: '#BFDBFE',
      };
    }
    return {
      label: '🟢 Active Parking',
      bg: '#F0FDF4',
      color: '#16A34A',
      border: '#BBF7D0',
    };
  };

  const config = getBadgeConfig();

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        isSmall && styles.badgeSmall,
        isLarge && styles.badgeLarge,
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          { color: config.color },
          isSmall && styles.textSmall,
          isLarge && styles.textLarge,
        ]}
      >
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  badgeLarge: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  textSmall: {
    fontSize: 10,
  },
  textLarge: {
    fontSize: 14,
  },
});
