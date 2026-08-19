import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export type VehicleCategoryKey = 'ALL' | 'PAKKA' | 'KACHHA' | 'RELEASED' | 'SHIFTING';

export interface VehicleCategoryCounts {
  all: number;
  pakka: number;
  kachha: number;
  released: number;
  shifting: number;
}

export interface VehicleCategoryTabsProps {
  selectedCategory: VehicleCategoryKey;
  onSelectCategory: (category: VehicleCategoryKey) => void;
  counts?: Partial<VehicleCategoryCounts>;
}

interface CategoryOption {
  key: VehicleCategoryKey;
  label: string;
  countKey: keyof VehicleCategoryCounts;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'ALL', label: 'All', countKey: 'all' },
  { key: 'PAKKA', label: 'Pakka', countKey: 'pakka' },
  { key: 'KACHHA', label: 'Kachha', countKey: 'kachha' },
  { key: 'RELEASED', label: 'Released', countKey: 'released' },
  { key: 'SHIFTING', label: 'Shifting', countKey: 'shifting' },
];

export default function VehicleCategoryTabs({
  selectedCategory,
  onSelectCategory,
  counts = { all: 0, pakka: 0, kachha: 0, released: 0, shifting: 0 },
}: VehicleCategoryTabsProps) {
  const handlePress = (key: VehicleCategoryKey) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onSelectCategory(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.key;
          const count = counts[cat.countKey] ?? 0;

          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.tabItem,
                isActive ? styles.activeTabItem : styles.inactiveTabItem,
              ]}
              onPress={() => handlePress(cat.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${cat.label}, ${count} vehicles`}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
                ]}
              >
                {cat.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isActive ? styles.activeCountBadge : styles.inactiveCountBadge,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isActive ? styles.activeCountText : styles.inactiveCountText,
                  ]}
                >
                  {count > 999 ? '999+' : count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: '#0062FF',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  inactiveTabItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  activeTabLabel: {
    color: '#FFFFFF',
  },
  inactiveTabLabel: {
    color: '#475569',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  inactiveCountBadge: {
    backgroundColor: '#E2E8F0',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activeCountText: {
    color: '#FFFFFF',
  },
  inactiveCountText: {
    color: '#64748B',
  },
});
