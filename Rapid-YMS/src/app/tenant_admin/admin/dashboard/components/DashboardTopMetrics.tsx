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
  ChevronRight,
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
  badge: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  primaryColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
}

const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: 'total',
    title: 'Total Vehicles',
    badge: 'All',
    icon: Car,
    primaryColor: '#4F46E5', // Indigo
    bgColor: '#EEF2FF',
    borderColor: '#E0E7FF',
    badgeBg: '#E0E7FF',
    badgeColor: '#4338CA',
  },
  {
    key: 'inYard',
    title: 'In-Yard Stock',
    badge: 'Stock',
    icon: Building2,
    primaryColor: '#0284C7', // Sky Blue
    bgColor: '#F0F9FF',
    borderColor: '#E0F2FE',
    badgeBg: '#E0F2FE',
    badgeColor: '#0369A1',
  },
  {
    key: 'pakka',
    title: 'Pakka',
    badge: 'Repo OK',
    icon: ShieldCheck,
    primaryColor: '#059669', // Emerald
    bgColor: '#ECFDF5',
    borderColor: '#D1FAE5',
    badgeBg: '#D1FAE5',
    badgeColor: '#047857',
  },
  {
    key: 'kachha',
    title: 'Kachha',
    badge: 'Pending',
    icon: Clock,
    primaryColor: '#D97706', // Amber
    bgColor: '#FFFBEB',
    borderColor: '#FEF3C7',
    badgeBg: '#FEF3C7',
    badgeColor: '#B45309',
  },
  {
    key: 'released',
    title: 'Released',
    badge: 'Out',
    icon: LogOut,
    primaryColor: '#7C3AED', // Purple
    bgColor: '#F5F3FF',
    borderColor: '#EDE9FE',
    badgeBg: '#EDE9FE',
    badgeColor: '#6D28D9',
  },
  {
    key: 'shifting',
    title: 'For Shift',
    badge: 'Shift',
    icon: ArrowRightLeft,
    primaryColor: '#0D9488', // Teal
    bgColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    badgeBg: '#CCFBF1',
    badgeColor: '#0F766E',
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

  // Stock breakdown calculation (Pakka vs Kachha percentage)
  const inYardCount = data.inYard > 0 ? data.inYard : (data.pakka + data.kachha);
  const pakkaPct = inYardCount > 0 ? Math.round((data.pakka / inYardCount) * 100) : 0;
  const kachhaPct = inYardCount > 0 ? 100 - pakkaPct : 0;

  return (
    <View style={styles.container}>
      {/* 1. Header Row: Yard Overview & Time Filter in Single Line */}
      <View style={styles.headerRow}>
        <View style={styles.titleSection}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDotPulse} />
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.overviewTitle}>Yard Overview</Text>
        </View>

        {/* Time Period Filter Pills */}
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

      {/* 2. Compact Metrics Cards Grid (2x3) */}
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
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}: ${countValue} vehicles`}
            >
              {/* Card Top: Icon & Badge */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: card.bgColor },
                  ]}
                >
                  <IconComp size={16} color={card.primaryColor} strokeWidth={2.4} />
                </View>
                <View
                  style={[
                    styles.cardBadge,
                    { backgroundColor: card.badgeBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.cardBadgeText,
                      { color: card.badgeColor },
                    ]}
                  >
                    {card.badge}
                  </Text>
                </View>
              </View>

              {/* Card Middle: Value & Chevron */}
              <View style={styles.valueRow}>
                {loading ? (
                  <ActivityIndicator size="small" color={card.primaryColor} />
                ) : (
                  <Text style={styles.cardValue}>
                    {countValue.toLocaleString('en-IN')}
                  </Text>
                )}
                <ChevronRight size={14} color="#94A3B8" strokeWidth={2.2} />
              </View>

              {/* Card Bottom: Clean English Title */}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {card.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Compact Stock Ratio Bar */}
      {inYardCount > 0 && !loading && (
        <View style={styles.ratioCard}>
          <View style={styles.ratioHeader}>
            <View style={styles.ratioTitleRow}>
              <TrendingUp size={13} color="#0062FF" strokeWidth={2.2} />
              <Text style={styles.ratioTitle}>Stock Ratio</Text>
            </View>
            <Text style={styles.ratioTotalText}>{inYardCount} in yard</Text>
          </View>

          {/* Progress Bar */}
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

          {/* Legend Strip */}
          <View style={styles.ratioLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
              <Text style={styles.legendLabel}>
                Pakka: <Text style={styles.legendBold}>{data.pakka}</Text> ({pakkaPct}%)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
              <Text style={styles.legendLabel}>
                Kachha: <Text style={styles.legendBold}>{data.kachha}</Text> ({kachhaPct}%)
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    height: 34,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveIndicator: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveDotPulse: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  overviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 2.5,
    gap: 2,
  },
  filterPill: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 11,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterPillText: {
    fontSize: 11,
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
    gap: 9,
  },
  card: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  ratioCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ratioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratioTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  ratioTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  progressBarWrapper: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarPakka: {
    height: '100%',
    backgroundColor: '#059669',
  },
  progressBarKachha: {
    height: '100%',
    backgroundColor: '#D97706',
  },
  ratioLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10.5,
    color: '#64748B',
  },
  legendBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
});
