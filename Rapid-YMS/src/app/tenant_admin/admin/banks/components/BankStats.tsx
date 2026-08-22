import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Landmark, Building2, GitBranch, Truck } from 'lucide-react-native';
import { BankTabFilter } from '../types';

export interface BankStatsProps {
  totalDirect: number;
  totalThirdParty: number;
  totalSubBanks: number;
  totalShift: number;
  activeFilter: BankTabFilter;
  onFilterSelect: (filter: BankTabFilter) => void;
}

export default function BankStats({
  totalDirect,
  totalThirdParty,
  totalSubBanks,
  totalShift,
  activeFilter,
  onFilterSelect,
}: BankStatsProps) {
  const handleSelect = (filter: BankTabFilter) => {
    Haptics.selectionAsync().catch(() => {});
    onFilterSelect(filter);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All Filter Card */}
        <TouchableOpacity
          style={[
            styles.statCard,
            activeFilter === 'ALL' && styles.statCardActive,
          ]}
          onPress={() => handleSelect('ALL')}
          activeOpacity={0.8}
        >
          <View style={styles.statTop}>
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Landmark size={15} color="#0062FF" strokeWidth={2.4} />
            </View>
            <Text style={[styles.statValue, activeFilter === 'ALL' && styles.statValueActive]}>
              {totalDirect + totalThirdParty + totalSubBanks + totalShift}
            </Text>
          </View>
          <Text style={[styles.statLabel, activeFilter === 'ALL' && styles.statLabelActive]}>
            All Entities
          </Text>
        </TouchableOpacity>

        {/* Direct Banks */}
        <TouchableOpacity
          style={[
            styles.statCard,
            activeFilter === 'DIRECT' && styles.statCardActive,
          ]}
          onPress={() => handleSelect('DIRECT')}
          activeOpacity={0.8}
        >
          <View style={styles.statTop}>
            <View style={[styles.iconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Building2 size={15} color="#4F46E5" strokeWidth={2.4} />
            </View>
            <Text style={[styles.statValue, activeFilter === 'DIRECT' && styles.statValueActive]}>
              {totalDirect}
            </Text>
          </View>
          <Text style={[styles.statLabel, activeFilter === 'DIRECT' && styles.statLabelActive]}>
            Direct Banks
          </Text>
        </TouchableOpacity>

        {/* 3rd Party Groups */}
        <TouchableOpacity
          style={[
            styles.statCard,
            activeFilter === 'THIRD_PARTY' && styles.statCardActive,
          ]}
          onPress={() => handleSelect('THIRD_PARTY')}
          activeOpacity={0.8}
        >
          <View style={styles.statTop}>
            <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7' }]}>
              <GitBranch size={15} color="#D97706" strokeWidth={2.4} />
            </View>
            <Text style={[styles.statValue, activeFilter === 'THIRD_PARTY' && styles.statValueActive]}>
              {totalThirdParty}
            </Text>
          </View>
          <Text style={[styles.statLabel, activeFilter === 'THIRD_PARTY' && styles.statLabelActive]}>
            3rd Party ({totalSubBanks})
          </Text>
        </TouchableOpacity>

        {/* Shift Banks */}
        <TouchableOpacity
          style={[
            styles.statCard,
            activeFilter === 'SHIFT' && styles.statCardActive,
          ]}
          onPress={() => handleSelect('SHIFT')}
          activeOpacity={0.8}
        >
          <View style={styles.statTop}>
            <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Truck size={15} color="#16A34A" strokeWidth={2.4} />
            </View>
            <Text style={[styles.statValue, activeFilter === 'SHIFT' && styles.statValueActive]}>
              {totalShift}
            </Text>
          </View>
          <Text style={[styles.statLabel, activeFilter === 'SHIFT' && styles.statLabelActive]}>
            Shift Banks
          </Text>
        </TouchableOpacity>
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
    gap: 10,
  },
  statCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardActive: {
    borderColor: '#0062FF',
    backgroundColor: '#F0F7FF',
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  statValueActive: {
    color: '#0062FF',
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  statLabelActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
});
