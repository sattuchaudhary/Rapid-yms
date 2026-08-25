import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import BillingBottomBar from './bottomBar';
import BillingOverviewSection, {
  BillingFinancialData,
  BankValuationBreakdown,
} from './components/BillingOverviewSection';
import BillingFilterModal, {
  BillingTimeFilter,
} from './components/BillingFilterModal';
import { getVehicles, getVehicleSummary } from '@/services/api';

/**
 * Accurately calculates difference in calendar days between start and end date
 */
function getDaysBetween(start: Date | null, end: Date | null): number {
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function BillingManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Filter State (Default: 'all_time' to show all live standing inventory without filtering out older vehicles)
  const [selectedFilter, setSelectedFilter] = useState<BillingTimeFilter>('all_time');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Loading & Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialData, setFinancialData] = useState<BillingFinancialData>({
    inYardTotal: 0,
    pakkaInYard: 0,
    kachhaInYard: 0,
    totalLiveYardValuation: 0,
    pakkaLiveAccruedValue: 0,
    kachhaLiveBlockedValue: 0,
    dailyPakkaInflow: 0,
    dailyKachhaLoss: 0,
    netDailyRate: 0,
    averagePakkaDays: 0,
    averageKachhaDays: 0,
    totalReleased: 0,
    pakkaReleased: 0,
    kachhaReleased: 0,
    releasedSettledAmount: 0,
    customerOverstayCharges: 0,
    bankBreakdown: [],
  });

  const getFilterDateParams = (filter: BillingTimeFilter, custom?: { startDate: string; endDate: string }) => {
    const now = new Date();
    if (filter === 'today') {
      const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEndStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      return { startDate: todayStr, endDate: todayEndStr };
    } else if (filter === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      return { startDate: startOfMonth, endDate: endOfMonth };
    } else if (filter === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
      return { startDate: startOfLastMonth, endDate: endOfLastMonth };
    } else if (filter === 'custom' && custom) {
      return {
        startDate: custom.startDate ? new Date(custom.startDate).toISOString() : undefined,
        endDate: custom.endDate ? new Date(custom.endDate).toISOString() : undefined,
      };
    }
    // 'all_time' has no date bounds
    return {};
  };

  const fetchFinancialMetrics = useCallback(
    async (filter: BillingTimeFilter, custom?: { startDate: string; endDate: string }) => {
      try {
        setLoading(true);
        const params = getFilterDateParams(filter, custom);

        // Fetch all vehicles and summary from database
        const [vehiclesRes, summaryRes] = await Promise.all([
          getVehicles({ ...params, limit: 1000 }),
          getVehicleSummary(params),
        ]);

        const vehiclesList: any[] = vehiclesRes?.data || [];
        const now = new Date();

        let inYardTotal = 0;
        let pakkaInYard = 0;
        let kachhaInYard = 0;

        let pakkaLiveAccruedValue = 0;
        let kachhaLiveBlockedValue = 0;

        let dailyPakkaInflow = 0;
        let dailyKachhaLoss = 0;

        let totalPakkaDays = 0;
        let totalKachhaDays = 0;

        let totalReleased = 0;
        let pakkaReleased = 0;
        let kachhaReleased = 0;
        let releasedSettledAmount = 0;
        let customerOverstayCharges = 0;

        // Bank-wise accumulation map
        const bankMap = new Map<string, { count: number; accrued: number; dailyRate: number; totalDays: number }>();

        for (const v of vehiclesList) {
          const status = v.yardStatus || (v.actualReleaseDate ? 'RELEASED' : v.pakkaDate ? 'PAKKA' : 'KACHHA');
          
          const rawEntry = v.kachhaStartDate || v.entryDate || v.createdAt;
          const entryDate = rawEntry ? new Date(rawEntry) : now;

          const rawPakka = v.pakkaDate || v.repoKitDate;
          const pakkaDate = rawPakka ? new Date(rawPakka) : null;

          const rawRO = v.releaseOrderDate;
          const roDate = rawRO ? new Date(rawRO) : null;

          const rawRelease = v.actualReleaseDate || v.release?.releasedAt;
          const releaseDate = rawRelease ? new Date(rawRelease) : null;

          const bankName = v.bankName || v.bank?.name || v.bank?.bankName || 'General / Other';

          // Lookup vehicle bank rate
          const vehicleType = v.vehicleType || 'FW';
          const bankRateConfig = v.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vehicleType);

          const pakkaRate = Number(
            bankRateConfig?.pakkaRate ||
            v.bank?.pakkaParkingRate ||
            bankRateConfig?.dailyRate ||
            v.bank?.kachhaParkingRate ||
            150
          );

          const kachhaRate = Number(
            bankRateConfig?.kachhaRate ||
            v.bank?.kachhaParkingRate ||
            pakkaRate ||
            150
          );

          const roRate = Number(
            bankRateConfig?.releaseOrderRate ||
            v.bank?.releaseOrderParkingRate ||
            pakkaRate ||
            150
          );

          const waiverDays = Number(v.bank?.parkingWaiverDays || 0);

          if (status === 'PAKKA') {
            // Actively standing Pakka vehicle in yard
            inYardTotal++;
            pakkaInYard++;
            dailyPakkaInflow += pakkaRate;

            const pakkaStart = pakkaDate || entryDate;
            const daysStanding = Math.max(1, getDaysBetween(pakkaStart, now));
            totalPakkaDays += daysStanding;

            const vehicleAccrued = daysStanding * pakkaRate;
            pakkaLiveAccruedValue += vehicleAccrued;

            const bEntry = bankMap.get(bankName) || { count: 0, accrued: 0, dailyRate: 0, totalDays: 0 };
            bEntry.count += 1;
            bEntry.accrued += vehicleAccrued;
            bEntry.dailyRate += pakkaRate;
            bEntry.totalDays += daysStanding;
            bankMap.set(bankName, bEntry);
          } else if (status === 'KACHHA') {
            // Actively standing Kachha vehicle in yard
            inYardTotal++;
            kachhaInYard++;
            dailyKachhaLoss += kachhaRate;

            const daysStanding = Math.max(1, getDaysBetween(entryDate, now));
            totalKachhaDays += daysStanding;

            const vehicleLoss = daysStanding * kachhaRate;
            kachhaLiveBlockedValue += vehicleLoss;
          } else if (status === 'RELEASED') {
            // Released Vehicle
            totalReleased++;
            const finalRelease = releaseDate || now;

            if (pakkaDate) {
              pakkaReleased++;
              const pakkaDays = getDaysBetween(pakkaDate, roDate || finalRelease);
              releasedSettledAmount += (pakkaDays * pakkaRate);
            } else {
              kachhaReleased++;
              const kachhaDays = getDaysBetween(entryDate, finalRelease);
              const paid = Number(v.billing?.paidAmount || 0);
              releasedSettledAmount += (paid > 0 ? paid : (kachhaDays * kachhaRate));
            }

            if (roDate) {
              const grossRODays = getDaysBetween(roDate, finalRelease);
              const chargeableDays = Math.max(0, grossRODays - waiverDays);
              customerOverstayCharges += (chargeableDays * roRate);
            }
          }
        }

        // Summary sync if total vehicles in summary differed
        if (summaryRes?.data && vehiclesList.length === 0) {
          const s = summaryRes.data;
          inYardTotal = s.inYard || 0;
          pakkaInYard = s.pakka || 0;
          kachhaInYard = s.kachha || 0;
          totalReleased = s.released || 0;
        }

        const totalLiveYardValuation = pakkaLiveAccruedValue + kachhaLiveBlockedValue;
        const netDailyRate = dailyPakkaInflow - dailyKachhaLoss;
        const averagePakkaDays = pakkaInYard > 0 ? Math.round(totalPakkaDays / pakkaInYard) : 0;
        const averageKachhaDays = kachhaInYard > 0 ? Math.round(totalKachhaDays / kachhaInYard) : 0;

        const bankBreakdown: BankValuationBreakdown[] = Array.from(bankMap.entries()).map(([name, b]) => ({
          bankName: name,
          vehicleCount: b.count,
          accruedValue: b.accrued,
          dailyRate: b.dailyRate,
          averageDays: b.count > 0 ? Math.round(b.totalDays / b.count) : 0,
        })).sort((a, b) => b.accruedValue - a.accruedValue);

        console.log('[Billing Real Accrual Summary]:', {
          vehiclesCount: vehiclesList.length,
          inYardTotal,
          pakkaInYard,
          kachhaInYard,
          pakkaLiveAccruedValue,
          kachhaLiveBlockedValue,
          totalLiveYardValuation,
        });

        setFinancialData({
          inYardTotal,
          pakkaInYard,
          kachhaInYard,
          totalLiveYardValuation,
          pakkaLiveAccruedValue,
          kachhaLiveBlockedValue,
          dailyPakkaInflow,
          dailyKachhaLoss,
          netDailyRate,
          averagePakkaDays,
          averageKachhaDays,
          totalReleased,
          pakkaReleased,
          kachhaReleased,
          releasedSettledAmount,
          customerOverstayCharges,
          bankBreakdown,
        });
      } catch (err) {
        console.warn('[Billing Fetch Real Financial Metrics Error]', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchFinancialMetrics(selectedFilter);
  }, [fetchFinancialMetrics, selectedFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFinancialMetrics(selectedFilter, {
      startDate: customStartDate,
      endDate: customEndDate,
    });
  };

  const handleApplyFilter = (
    filter: BillingTimeFilter,
    customDates?: { startDate: string; endDate: string }
  ) => {
    setSelectedFilter(filter);
    if (customDates) {
      setCustomStartDate(customDates.startDate);
      setCustomEndDate(customDates.endDate);
    }
    fetchFinancialMetrics(filter, customDates);
  };

  const getFilterLabel = (): string => {
    switch (selectedFilter) {
      case 'this_month':
        return 'This Month';
      case 'today':
        return 'Today';
      case 'last_month':
        return 'Last Month';
      case 'all_time':
        return 'All Time';
      case 'custom':
        return 'Custom Range';
      default:
        return 'Filter';
    }
  };

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const handleMorePress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setFilterModalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        {/* Left: Back Button */}
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>

        {/* Center: Title */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Billing Management
          </Text>
        </View>

        {/* Right: 3 Dots Button */}
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleMorePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MoreVertical size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Page Body / Scrollable Content */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0062FF']}
            tintColor="#0062FF"
          />
        }
      >
        {/* Real-time Live Yard Stock Valuation Overview */}
        <BillingOverviewSection
          data={financialData}
          loading={loading && !refreshing}
          selectedFilter={selectedFilter}
          filterLabel={getFilterLabel()}
          onOpenFilter={() => setFilterModalVisible(true)}
        />
      </ScrollView>

      {/* Interactive Date Period Filter Modal */}
      <BillingFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        selectedFilter={selectedFilter}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onApplyFilter={handleApplyFilter}
      />

      {/* Bottom Navigation Bar */}
      <BillingBottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90, // Space for bottom bar
  },
});
