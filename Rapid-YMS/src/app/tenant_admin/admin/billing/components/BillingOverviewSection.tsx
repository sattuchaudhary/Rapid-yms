import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  LogOut,
  Car,
  AlertTriangle,
  Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BillingTimeFilter } from './BillingFilterModal';

export interface BankValuationBreakdown {
  bankName: string;
  vehicleCount: number;
  accruedValue: number;
  dailyRate: number;
  averageDays: number;
}

export interface BillingFinancialData {
  inYardTotal: number;
  pakkaInYard: number;
  kachhaInYard: number;

  totalLiveYardValuation: number;
  pakkaLiveAccruedValue: number;
  kachhaLiveBlockedValue: number;

  dailyPakkaInflow: number;
  dailyKachhaLoss: number;
  netDailyRate: number;

  averagePakkaDays: number;
  averageKachhaDays: number;

  totalReleased: number;
  pakkaReleased: number;
  kachhaReleased: number;
  releasedSettledAmount: number;
  customerOverstayCharges: number;

  bankBreakdown: BankValuationBreakdown[];
}

export interface BillingOverviewSectionProps {
  data: BillingFinancialData;
  loading: boolean;
  selectedFilter: BillingTimeFilter;
  filterLabel: string;
  onOpenFilter: () => void;
}

const formatINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(val || 0));
};

export default function BillingOverviewSection({
  data,
  loading,
  selectedFilter,
  filterLabel,
  onOpenFilter,
}: BillingOverviewSectionProps) {
  const handleFilterPress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onOpenFilter();
  };

  return (
    <View style={styles.container}>
      {/* 1. Clean Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Overview</Text>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={handleFilterPress}
          activeOpacity={0.75}
        >
          <SlidersHorizontal size={13} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {filterLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading valuation data...</Text>
        </View>
      ) : (
        <>
          {/* 2. Main Live Yard Valuation Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroHeaderLeft}>
                <Text style={styles.heroLabel}>Live Yard Value</Text>
                <Text style={styles.heroTotalAmount}>
                  ₹{formatINR(data.totalLiveYardValuation)}
                </Text>
              </View>

              <View style={styles.stockBadge}>
                <Car size={15} color="#0062FF" strokeWidth={2.2} />
                <Text style={styles.stockBadgeText}>
                  {data.inYardTotal} in Yard
                </Text>
              </View>
            </View>

            {/* Daily Inflow & Loss */}
            <View style={styles.dailyRow}>
              <View style={styles.dailyCol}>
                <Text style={styles.dailyColLabel}>Pakka Inflow</Text>
                <Text style={[styles.dailyColValue, { color: '#059669' }]}>
                  +₹{formatINR(data.dailyPakkaInflow)}/day
                </Text>
              </View>

              <View style={styles.dailyDivider} />

              <View style={styles.dailyCol}>
                <Text style={styles.dailyColLabel}>Kachha Loss</Text>
                <Text style={[styles.dailyColValue, { color: '#DC2626' }]}>
                  -₹{formatINR(data.dailyKachhaLoss)}/day
                </Text>
              </View>

              <View style={styles.dailyDivider} />

              <View style={styles.dailyCol}>
                <Text style={styles.dailyColLabel}>Net Daily</Text>
                <Text
                  style={[
                    styles.dailyColValue,
                    { color: data.netDailyRate >= 0 ? '#0062FF' : '#DC2626' },
                  ]}
                >
                  {data.netDailyRate >= 0 ? '+' : ''}₹{formatINR(data.netDailyRate)}/day
                </Text>
              </View>
            </View>
          </View>

          {/* 3. Pakka vs Kachha Cards */}
          <View style={styles.cardsGrid}>
            {/* Pakka Card */}
            <View style={[styles.categoryCard, { borderColor: '#A7F3D0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <ShieldCheck size={18} color="#059669" strokeWidth={2.4} />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardTitle}>Pakka Stock</Text>
                  <Text style={styles.cardSubtitle}>
                    {data.pakkaInYard} Vehicles
                  </Text>
                </View>
                <Text style={[styles.cardAmountHeader, { color: '#059669' }]}>
                  ₹{formatINR(data.pakkaLiveAccruedValue)}
                </Text>
              </View>
            </View>

            {/* Kachha Card */}
            <View style={[styles.categoryCard, { borderColor: '#FECDD3' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <AlertTriangle size={18} color="#E11D48" strokeWidth={2.4} />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardTitle}>Kachha Holding</Text>
                  <Text style={styles.cardSubtitle}>
                    {data.kachhaInYard} Vehicles
                  </Text>
                </View>
                <Text style={[styles.cardAmountHeader, { color: '#DC2626' }]}>
                  -₹{formatINR(data.kachhaLiveBlockedValue)}
                </Text>
              </View>
            </View>

            {/* Released Card (if any released) */}
            {data.totalReleased > 0 && (
              <View style={[styles.categoryCard, { borderColor: '#DDD6FE' }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <LogOut size={18} color="#7C3AED" strokeWidth={2.4} />
                  </View>
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.cardTitle}>Released Vehicles</Text>
                    <Text style={styles.cardSubtitle}>
                      {data.totalReleased} Vehicles Settled
                    </Text>
                  </View>
                  <Text style={[styles.cardAmountHeader, { color: '#7C3AED' }]}>
                    ₹{formatINR(data.releasedSettledAmount + data.customerOverstayCharges)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 4. Bank Breakdown */}
          {data.bankBreakdown && data.bankBreakdown.length > 0 && (
            <View style={styles.bankSection}>
              <Text style={styles.bankSectionTitle}>Bank-Wise Breakdown</Text>
              <View style={styles.bankCard}>
                {data.bankBreakdown.map((item, idx) => (
                  <View key={item.bankName + idx}>
                    <View style={styles.bankRow}>
                      <View style={styles.bankLeft}>
                        <Building2 size={16} color="#0062FF" />
                        <View>
                          <Text style={styles.bankName}>{item.bankName}</Text>
                          <Text style={styles.bankMeta}>
                            {item.vehicleCount} Vehicles • +₹{formatINR(item.dailyRate)}/day
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.bankAmount}>
                        ₹{formatINR(item.accruedValue)}
                      </Text>
                    </View>
                    {idx < data.bankBreakdown.length - 1 && (
                      <View style={styles.bankDivider} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0062FF',
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroHeaderLeft: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  heroTotalAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 6,
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0062FF',
  },
  dailyRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dailyCol: {
    flex: 1,
    alignItems: 'center',
  },
  dailyColLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  dailyColValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  dailyDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },

  // Cards Grid
  cardsGrid: {
    gap: 10,
    marginBottom: 14,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  cardAmountHeader: {
    fontSize: 15,
    fontWeight: '800',
  },

  // Bank Breakdown
  bankSection: {
    marginTop: 2,
  },
  bankSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  bankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bankName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  bankMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  bankAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#059669',
  },
  bankDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
});
