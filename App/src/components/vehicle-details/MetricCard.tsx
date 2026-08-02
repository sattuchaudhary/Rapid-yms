import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  theme: 'indigo' | 'amber' | 'green' | 'slate';
}

export function MetricCard({ label, value, subValue, icon, theme }: MetricCardProps) {
  const getThemeStyles = () => {
    switch (theme) {
      case 'indigo':
        return {
          iconBg: '#EEF2FF',
          cardBg: '#FFFFFF',
          valueColor: '#0F172A',
          borderColor: '#E2E8F0',
        };
      case 'amber':
        return {
          iconBg: '#FEF3C7',
          cardBg: '#FFFFFF',
          valueColor: '#B45309',
          borderColor: '#E2E8F0',
        };
      case 'green':
        return {
          iconBg: '#DCFCE7',
          cardBg: '#F0FDF4',
          valueColor: '#16A34A',
          borderColor: '#BBF7D0',
        };
      case 'slate':
      default:
        return {
          iconBg: '#F1F5F9',
          cardBg: '#FFFFFF',
          valueColor: '#0F172A',
          borderColor: '#E2E8F0',
        };
    }
  };

  const themeStyles = getThemeStyles();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: themeStyles.cardBg, borderColor: themeStyles.borderColor },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: themeStyles.iconBg }]}>
          {icon}
        </View>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>

      <ThemedText style={[styles.value, { color: themeStyles.valueColor }]} numberOfLines={1}>
        {value}
      </ThemedText>

      {subValue ? <ThemedText style={styles.subValue}>{subValue}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    flex: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  subValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
});
