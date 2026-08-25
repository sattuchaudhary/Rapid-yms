import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Building2,
  Calendar,
  Inbox,
  ShieldCheck,
} from 'lucide-react-native';

import VehiclesHeader, { VehicleFilterState } from './header';
import VehicleCategoryTabs, {
  VehicleCategoryKey,
  VehicleCategoryCounts,
} from './VehicleCategoryTabs';
import ExportVehiclesModal from './ExportVehiclesModal';
import AdminDashboardBottomNavBar, {
  AdminDashboardTabKey,
} from '../navigation/admindashbordbottomnavbar';
import { getVehicles, getVehicleSummary, getBanks } from '@/services/api';

const PAGE_SIZE = 25;

export default function VehiclesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; filter?: string; bank?: string }>();
  const [activeTab, setActiveTab] = useState<AdminDashboardTabKey>('vehicles');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategoryKey>('ALL');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VehicleFilterState>({
    preset: 'all_time',
    bankName: params.bank || null,
    label: params.bank ? params.bank : 'All Time (Day 1 - Today)',
  });

  // Banks List for Header Filter Modal
  const [banksList, setBanksList] = useState<any[]>([]);

  // Sync category and filter if navigated from dashboard metric cards
  useEffect(() => {
    if (params.category) {
      const validCategories: VehicleCategoryKey[] = ['ALL', 'PAKKA', 'KACHHA', 'RELEASED', 'SHIFTING'];
      const upper = params.category.toUpperCase() as VehicleCategoryKey;
      if (validCategories.includes(upper)) {
        setSelectedCategory(upper);
      }
    }
    if (params.filter) {
      if (params.filter === 'today') {
        setActiveFilter((prev) => ({ ...prev, preset: 'today', label: 'Today' }));
      } else if (params.filter === 'this_month') {
        setActiveFilter((prev) => ({ ...prev, preset: 'this_month', label: 'This Month' }));
      } else if (params.filter === 'all_time') {
        setActiveFilter((prev) => ({ ...prev, preset: 'all_time', label: 'All Time (Day 1 - Today)' }));
      }
    }
    if (params.bank) {
      setActiveFilter((prev) => ({
        ...prev,
        bankName: params.bank || null,
        label: params.bank || prev.label,
      }));
    }
  }, [params.category, params.filter, params.bank]);

  // Load Banks List on mount for the 3-dot filter modal
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const res = await getBanks();
        const list = res?.data || (Array.isArray(res) ? res : []);
        setBanksList(list);
      } catch (err) {
        console.warn('[Load Banks For Filter Error]', err);
      }
    };
    loadBanks();
  }, []);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<VehicleCategoryCounts>({
    all: 0,
    pakka: 0,
    kachha: 0,
    released: 0,
    shifting: 0,
  });

  const isFetchingRef = useRef(false);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate Date boundaries from active header filter
  const getDateRangeParams = useCallback(() => {
    const { preset, month, year } = activeFilter;
    const now = new Date();

    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      return { startDate: start, endDate: end };
    }

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      return { startDate: start, endDate: end };
    }

    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
      return { startDate: start, endDate: end };
    }

    if (preset === 'custom_month_year' && month && year) {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      return { startDate: start, endDate: end };
    }

    return {};
  }, [activeFilter]);

  // 1. Fetch Fast Category Aggregate Counts (with Bank filter from activeFilter)
  const fetchCountsSummary = useCallback(async () => {
    try {
      const dateParams = getDateRangeParams();
      const summaryRes = await getVehicleSummary({
        ...dateParams,
        bankName: activeFilter.bankName || undefined,
      });
      if (summaryRes?.data) {
        setCategoryCounts(summaryRes.data);
      }
    } catch (err) {
      console.warn('[Fetch Category Summary Error]', err);
    }
  }, [getDateRangeParams, activeFilter.bankName]);

  // 2. Fetch Paginated Vehicles List (with Bank filter from activeFilter)
  const fetchVehiclesPage = useCallback(
    async (targetPage: number, isReset = false) => {
      if (isFetchingRef.current && !isReset) return;
      isFetchingRef.current = true;

      try {
        if (isReset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const dateParams = getDateRangeParams();
        const statusFilter =
          selectedCategory === 'ALL' || selectedCategory === 'SHIFTING'
            ? undefined
            : selectedCategory;

        const res = await getVehicles({
          ...dateParams,
          yardStatus: statusFilter,
          bankName: activeFilter.bankName || undefined,
          shifting: selectedCategory === 'SHIFTING' ? true : undefined,
          search: debouncedSearch || undefined,
          page: targetPage,
          limit: PAGE_SIZE,
        });

        const newItems: any[] = res?.data || res?.vehicles || (Array.isArray(res) ? res : []);
        const totalCount = res?.total ?? 0;
        const totalPages = res?.totalPages ?? Math.ceil(totalCount / PAGE_SIZE);

        if (isReset) {
          setVehicles(newItems);
        } else {
          setVehicles((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const uniqueAdditions = newItems.filter((i) => !existingIds.has(i.id));
            return [...prev, ...uniqueAdditions];
          });
        }

        setPage(targetPage);
        setHasMore(targetPage < totalPages);
      } catch (err) {
        console.warn('[Fetch Vehicles Page Error]', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [getDateRangeParams, selectedCategory, activeFilter.bankName, debouncedSearch]
  );

  // Initial load or when filter/search/bank changes
  useEffect(() => {
    fetchCountsSummary();
    fetchVehiclesPage(1, true);
  }, [fetchCountsSummary, fetchVehiclesPage]);

  // Pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchCountsSummary();
    fetchVehiclesPage(1, true);
  };

  // Infinite Scroll Trigger
  const handleEndReached = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchVehiclesPage(page + 1, false);
    }
  };

  const handleTabPress = (tab: AdminDashboardTabKey) => {
    setActiveTab(tab);
    if (tab === 'home') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/tenant_admin/admin/dashboard' as any);
      }
    } else if (tab === 'add') {
      router.push('/tenant_admin/admin/vehicles/add' as any);
    } else if (tab === 'release') {
      router.push('/tenant_admin/admin/vehicles/release' as any);
    }
  };

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tenant_admin/admin/dashboard' as any);
    }
  };

  // Status Chip Colors
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PAKKA') return { bg: '#EFF6FF', text: '#0062FF', border: '#BFDBFE' };
    if (s === 'KACHHA') return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    if (s === 'RELEASED') return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    if (s === 'SHIFTING') return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
    return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
  };

  // Clean Vehicle Card
  const renderVehicleCard = ({ item }: { item: any }) => {
    const status = item.yardStatus || 'KACHHA';
    const statusStyle = getStatusBadgeStyle(status);

    const vehicleNum = item.vehicleNumber || 'NO NUMBER';
    const bankName = item.bankName || item.bank?.name || item.bank?.bankName || 'General / Other';
    const model = [item.brand, item.model].filter(Boolean).join(' ') || item.vehicleType || 'Vehicle';

    // Format Inward / Check-in Date
    const rawDate = item.kachhaStartDate || item.entryDate || item.createdAt;
    const formattedDate = rawDate
      ? new Date(rawDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'Recently Added';

    return (
      <TouchableOpacity
        style={styles.vehicleCard}
        activeOpacity={0.7}
        onPress={() => {
          router.push(`/tenant_admin/admin/vehicles/details/${item.id}` as any);
        }}
      >
        {/* Top Header Row: Vehicle Number + Status Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.numContainer}>
            <Text style={styles.vehicleNumberText} numberOfLines={1}>
              {vehicleNum}
            </Text>
            <Text style={styles.modelSubText} numberOfLines={1}>
              {model}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {status}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Footer Meta Row: Bank + Inward Date */}
        <View style={styles.cardFooterRow}>
          <View style={styles.metaItem}>
            <Building2 size={13} color="#64748B" strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>
              {bankName}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Calendar size={13} color="#64748B" strokeWidth={2} />
            <Text style={styles.metaText}>{formattedDate}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0062FF" />
        <Text style={styles.footerText}>Loading more vehicles...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Header with Search & 3-Dot Filter (Searchable Bank Dropdown + Date Filter) */}
      <VehiclesHeader
        title="Vehicle List"
        onBackPress={handleBackPress}
        initialFilter={activeFilter}
        onFilterChange={(newFilter) => setActiveFilter(newFilter)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefreshPress={handleRefresh}
        onExportPress={() => setExportModalVisible(true)}
        banksList={banksList}
      />

      {/* 2. Top Category Tabs (ALL, PAKKA, KACHHA, RELEASED, SHIFTING) */}
      <VehicleCategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
        counts={categoryCounts}
      />

      {/* 3. Clean Vehicles List */}
      <View style={styles.contentArea}>
        {loading && !refreshing ? (
          <View style={styles.centerLoadingBox}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.loadingText}>Loading vehicles...</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Inbox size={32} color="#94A3B8" strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery || activeFilter.bankName ? 'No Matching Vehicles' : 'No Vehicles Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter.bankName
                ? `Bank "${activeFilter.bankName}" ke liye ${selectedCategory} category mein koi vehicle nahi mila.`
                : searchQuery
                ? `"${searchQuery}" ke liye koi vehicle record nahi mila.`
                : `Is category (${selectedCategory}) mein koi vehicle record uplabdh nahi hai.`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item, index) => item.id || `veh-${index}`}
            renderItem={renderVehicleCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#0062FF']}
                tintColor="#0062FF"
              />
            }
          />
        )}
      </View>

      {/* Export Vehicles Modal with Category & Date Range Filter */}
      <ExportVehiclesModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
      />

      {/* 4. Bottom Navigation Bar */}
      <AdminDashboardBottomNavBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 90,
    gap: 7,
  },
  centerLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Vehicle Card
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  numContainer: {
    flex: 1,
    paddingRight: 8,
  },
  vehicleNumberText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  modelSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginVertical: 9,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
