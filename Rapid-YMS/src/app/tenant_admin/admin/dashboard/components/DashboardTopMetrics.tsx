import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Car,
  ShieldCheck,
  Clock,
  LogOut,
  ArrowRightLeft,
  Building2,
  TrendingUp,
} from 'lucide-react-native';

export type DashboardTimeFilter = 'all' | 'this_month' | 'today';

export interface DashboardMetricsData {
  total: number;
  inYard: number;
  pakka: number;
  kachha: number;
  released: number;
  shifting: number;
}

export interface DashboardTopMetricsProps {
  data: DashboardMetricsData;
  loading?: boolean;
  selectedFilter: DashboardTimeFilter;
  onFilterChange: (filter: DashboardTimeFilter) => void;
  onCardPress?: (metricKey: 'total' | 'inYard' | 'pakka' | 'kachha' | 'released' | 'shifting') => void;
}

interface MetricCardConfig {
  key: 'total' | 'inYard' | 'pakka' | 'kachha' | 'released' | 'shifting';
  title: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  primaryColor: string;
  bgColor: string;
  borderColor: string;
}

const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: 'total',
    title: 'Total Vehicles',
    icon: Car,
    primaryColor: '#4F46E5', // Indigo
    bgColor: '#EEF2FF',
    borderColor: '#E0E7FF',
  },
  {
    key: 'inYard',
    title: 'In-Yard Stock',
    icon: Building2,
    primaryColor: '#0284C7', // Sky Blue
    bgColor: '#F0F9FF',
    borderColor: '#E0F2FE',
  },
  {
    key: 'pakka',
    title: 'Pakka Stock',
    icon: ShieldCheck,
    primaryColor: '#059669', // Emerald
    bgColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  {
    key: 'kachha',
    title: 'Kachha Stock',
    icon: Clock,
    primaryColor: '#D97706', // Amber
    bgColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  {
    key: 'released',
    title: 'Released',
    icon: LogOut,
    primaryColor: '#7C3AED', // Purple
    bgColor: '#F5F3FF',
    borderColor: '#EDE9FE',
  },
  {
    key: 'shifting',
    title: 'For Shift',
    icon: ArrowRightLeft,
    primaryColor: '#0D9488', // Teal
    bgColor: '#F0FDFA',
    borderColor: '#CCFBF1',
  },
];

export default function DashboardTopMetrics({
  data,
  loading = false,
  selectedFilter,
  onFilterChange,
  onCardPress,
}: DashboardTopMetricsProps) {
  const handleFilterSelect = (filter: DashboardTimeFilter) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onFilterChange(filter);
  };

  const handleCardPress = (key: MetricCardConfig['key']) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (onCardPress) {
      onCardPress(key);
    }
  };

  // Stock breakdown calculation
  const inYardCount = data.inYard > 0 ? data.inYard : (data.pakka + data.kachha);
  const pakkaPct = inYardCount > 0 ? Math.round((data.pakka / inYardCount) * 100) : 0;
  const kachhaPct = inYardCount > 0 ? 100 - pakkaPct : 0;

  return (
    <View style={styles.container}>
      {/* 1. Header: Yard Overview & Time Filter in Single Line */}
      <View style={styles.headerRow}>
        <View style={styles.titleSection}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDotPulse} />
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.overviewTitle}>Yard Overview</Text>
        </View>

        {/* Compact Time Filter Pills */}
        <View style={styles.filterPillsContainer}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'this_month', label: 'Month' },
              { key: 'today', label: 'Today' },
            ] as const
          ).map((pill) => {
            const isSelected = selectedFilter === pill.key;
            return (
              <TouchableOpacity
                key={pill.key}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                ]}
                onPress={() => handleFilterSelect(pill.key)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Ultra-Compact Metrics Cards Grid (2 Columns) */}
      <View style={styles.cardsGrid}>
        {METRIC_CARDS.map((card) => {
          const IconComp = card.icon;
          const countValue =
            card.key === 'total'
              ? data.total
              : card.key === 'inYard'
              ? inYardCount
              : card.key === 'pakka'
              ? data.pakka
              : card.key === 'kachha'
              ? data.kachha
              : card.key === 'released'
              ? data.released
              : data.shifting;

          return (
            <TouchableOpacity
              key={card.key}
              style={[
                styles.card,
                {
                  borderColor: card.borderColor,
                },
              ]}
              onPress={() => handleCardPress(card.key)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}: ${countValue}`}
            >
              {/* Top Row: Small Icon + Large Value */}
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: card.bgColor },
                  ]}
                >
                  <IconComp size={14} color={card.primaryColor} strokeWidth={2.4} />
                </View>
                {loading ? (
                  <ActivityIndicator size="small" color={card.primaryColor} style={styles.loader} />
                ) : (
                  <Text style={styles.cardValue}>
                    {countValue.toLocaleString('en-IN')}
                  </Text>
                )}
              </View>

              {/* Bottom Row: Clean Title */}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {card.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ultra-Slim Stock Ratio Bar */}
      {inYardCount > 0 && !loading && (
        <View style={styles.ratioCard}>
          <View style={styles.ratioHeader}>
            <View style={styles.ratioTitleRow}>
              <TrendingUp size={12} color="#0062FF" strokeWidth={2.2} />
              <Text style={styles.ratioTitle}>Stock Ratio</Text>
            </View>
            <Text style={styles.ratioLegendInline}>
              <Text style={{ color: '#059669', fontWeight: '700' }}>{data.pakka} Pakka</Text>
              {'  •  '}
              <Text style={{ color: '#D97706', fontWeight: '700' }}>{data.kachha} Kachha</Text>
            </Text>
          </View>

          {/* Slim Progress Bar */}
          <View style={styles.progressBarWrapper}>
            <View
              style={[
                styles.progressBarPakka,
                { width: `${pakkaPct}%` },
              ]}
            />
            <View
              style={[
                styles.progressBarKachha,
                { width: `${kachhaPct}%` },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    height: 30,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveDotPulse: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  filterPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1.5,
  },
  filterPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  card: {
    width: '49%',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    transform: [{ scale: 0.7 }],
  },
  cardValue: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  ratioCard: {
    marginTop: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ratioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratioTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  ratioLegendInline: {
    fontSize: 10,
    color: '#64748B',
  },
  progressBarWrapper: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarPakka: {
    height: '100%',
    backgroundColor: '#059669',
  },
  progressBarKachha: {
    height: '100%',
    backgroundColor: '#D97706',
  },
});
