import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { UserRole } from '../types';

export interface UserRoleFilterProps {
  selectedRole: string | 'ALL';
  onSelectRole: (role: string | 'ALL') => void;
  counts: {
    ALL: number;
    MANAGER: number;
    SUPERVISOR: number;
    EXECUTIVE: number;
    GUARD: number;
  };
}

const FILTER_ITEMS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All Staff' },
  { key: 'MANAGER', label: 'Managers' },
  { key: 'SUPERVISOR', label: 'Supervisors' },
  { key: 'EXECUTIVE', label: 'Executives' },
  { key: 'GUARD', label: 'Guards' },
];

export default function UserRoleFilter({
  selectedRole,
  onSelectRole,
  counts,
}: UserRoleFilterProps) {
  const handleSelect = (key: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onSelectRole(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_ITEMS.map((item) => {
          const isSelected = selectedRole === item.key;
          const count = counts[item.key as keyof typeof counts] ?? 0;

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterChip,
                isSelected ? styles.selectedChip : styles.unselectedChip,
              ]}
              onPress={() => handleSelect(item.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterLabel,
                  isSelected ? styles.selectedLabel : styles.unselectedLabel,
                ]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isSelected ? styles.selectedCountBadge : styles.unselectedCountBadge,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected ? styles.selectedCountText : styles.unselectedCountText,
                  ]}
                >
                  {count}
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
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  selectedChip: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  unselectedChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  filterLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  selectedLabel: {
    color: '#FFFFFF',
  },
  unselectedLabel: {
    color: '#64748B',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  selectedCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  unselectedCountBadge: {
    backgroundColor: '#F1F5F9',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  selectedCountText: {
    color: '#FFFFFF',
  },
  unselectedCountText: {
    color: '#64748B',
  },
});
