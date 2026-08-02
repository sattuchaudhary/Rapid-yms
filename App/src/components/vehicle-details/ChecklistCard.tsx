import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, X, AlertTriangle } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { InventoryItem } from './types';

interface ChecklistCardProps {
  inventory?: InventoryItem[];
}

export const ACCESSORY_ITEMS = [
  { key: 'RC-Original', label: 'RC Original' },
  { key: 'key', label: 'Keys' },
  { key: 'Battery', label: 'Battery' },
  { key: 'Horn', label: 'Horn' },
  { key: 'Front Tyre', label: 'Front Tyre' },
  { key: 'Back Tyre', label: 'Back Tyre' },
  { key: 'Spare Tyre', label: 'Spare Tyre' },
  { key: 'Tool Kit', label: 'Tool Kit' },
  { key: 'Side Mirror (Left)', label: 'Side Mirror (L)' },
  { key: 'Side Mirror (Right)', label: 'Side Mirror (R)' },
  { key: 'Light Front', label: 'Front Light' },
  { key: 'Light Back', label: 'Back Light' },
  { key: 'Light Indicator', label: 'Indicator Lights' },
  { key: 'Music System', label: 'Music System' },
  { key: 'Meter Running Condition', label: 'Meter Running' },
];

export function ChecklistCard({ inventory = [] }: ChecklistCardProps) {
  const getInventoryItem = (itemName: string) => {
    const searchName = itemName.toLowerCase() === 'battery' ? 'battry' : itemName;
    return inventory.find(
      item =>
        item.itemName.toLowerCase() === itemName.toLowerCase() ||
        item.itemName.toLowerCase() === searchName.toLowerCase()
    );
  };

  const { availableItems, missingItems } = useMemo(() => {
    const available: { label: string; subtext: string }[] = [];
    const missing: { label: string }[] = [];

    ACCESSORY_ITEMS.forEach(item => {
      const invItem = getInventoryItem(item.key);
      const isPresent = !!invItem?.isPresent;

      if (isPresent) {
        let subtext = '';
        if (item.key === 'Front Tyre' || item.key === 'Back Tyre') {
          const match = invItem.remarks?.match(/\(Tyre Make:\s*(.*?)\)/i);
          subtext = match ? match[1]?.trim() : '';
        } else {
          subtext = invItem.remarks || '';
        }
        available.push({ label: item.label, subtext });
      } else {
        missing.push({ label: item.label });
      }
    });

    return { availableItems: available, missingItems: missing };
  }, [inventory]);

  return (
    <View style={styles.container}>
      {/* 1. MISSING ITEMS GROUP (PRIORITIZED FIRST IN RED) */}
      {missingItems.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRed}>
            <AlertTriangle size={14} color="#EF4444" />
            <ThemedText style={styles.sectionTitleRed}>
              MISSING ({missingItems.length})
            </ThemedText>
          </View>

          <View style={styles.grid}>
            {missingItems.map((item, index) => (
              <View key={`missing-${index}`} style={styles.missingChip}>
                <View style={styles.crossCircle}>
                  <X size={12} color="#EF4444" />
                </View>
                <ThemedText style={styles.missingText} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 2. AVAILABLE ITEMS GROUP (GREEN) */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderGreen}>
          <Check size={14} color="#16A34A" />
          <ThemedText style={styles.sectionTitleGreen}>
            AVAILABLE ({availableItems.length})
          </ThemedText>
        </View>

        <View style={styles.grid}>
          {availableItems.map((item, index) => (
            <View key={`avail-${index}`} style={styles.availableChip}>
              <View style={styles.checkCircle}>
                <Check size={12} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.availableText} numberOfLines={1}>
                  {item.label}
                </ThemedText>
                {item.subtext ? (
                  <ThemedText style={styles.subtext} numberOfLines={1}>
                    {item.subtext}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitleRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  sectionHeaderGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitleGreen: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  missingChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  crossCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    flex: 1,
  },
  availableChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  availableText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtext: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
});
