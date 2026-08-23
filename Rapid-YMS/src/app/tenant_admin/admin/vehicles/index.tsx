import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
import { getVehicles, getVehicleSummary } from '@/services/api';

const PAGE_SIZE = 25;

export default function VehiclesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; filter?: string }>();
  const [activeTab, setActiveTab] = useState<AdminDashboardTabKey>('vehicles');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategoryKey>('ALL');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VehicleFilterState>({
    preset: 'all_time',
    label: 'All Time (Day 1 - Today)',
  });

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
        setActiveFilter({ preset: 'today', label: 'Today' });
      } else if (params.filter === 'this_month') {
        setActiveFilter({ preset: 'this_month', label: 'This Month' });
      } else if (params.filter === 'all_time') {
        setActiveFilter({ preset: 'all_time', label: 'All Time (Day 1 - Today)' });
      }
    }
  }, [params.category, params.filter]);

  // Search State (Header Expandable Search - Option 2)
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

  // 1. Fetch Fast Category Aggregate Counts
  const fetchCountsSummary = useCallback(async () => {
    try {
      const dateParams = getDateRangeParams();
      const summaryRes = await getVehicleSummary(dateParams);
      if (summaryRes?.data) {
        setCategoryCounts(summaryRes.data);
      }
    } catch (err) {
      console.warn('[Fetch Category Summary Error]', err);
    }
  }, [getDateRangeParams]);

  // 2. Fetch Paginated Vehicles List
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
    [getDateRangeParams, selectedCategory, debouncedSearch]
  );

  // Initial load or when filter/search changes
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

  // Clean, Simple & Perfectly Aligned Vehicle Card
  const renderVehicleCard = ({ item }: { item: any }) => {
    const statusStyle = getStatusBadgeStyle(item.yardStatus);
    const vehicleNum = item.vehicleNumber || 'NO NUMBER';
    const bank = item.bankName || item.bank?.name || 'Private / Agency';
    const entryDateStr = item.entryDate
      ? new Date(item.entryDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    return (
      <TouchableOpacity
        style={styles.cleanCard}
        activeOpacity={0.75}
        onPress={() => {
          if (item?.id) {
            router.push(`/tenant_admin/admin/vehicles/details/${item.id}` as any);
          }
        }}
      >
        {/* Row 1: Vehicle Number (Left) — Date (Center) — Status (Right) */}
        <View style={styles.cardTopRow}>
          {/* 1. Bold Readable Vehicle Number */}
          <Text style={styles.vehicleNumberText} numberOfLines={1}>
            {vehicleNum.toUpperCase()}
          </Text>

          {/* 2. Date in Center (Safe Fixed Position) */}
          <View style={styles.dateCenterBox}>
            <Calendar size={11} color="#64748B" style={styles.dateIcon} />
            <Text style={styles.dateText}>{entryDateStr}</Text>
          </View>

          {/* 3. Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {item.yardStatus || 'KACHHA'}
            </Text>
          </View>
        </View>

        {/* Row 2: Full Width Dedicated Bank Name (No text overlap) */}
        <View style={styles.cardBottomRow}>
          <Building2 size={13} color="#64748B" style={styles.bankIcon} />
          <Text style={styles.bankText} numberOfLines={1}>
            {bank}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0062FF" />
        <Text style={styles.footerLoaderText}>Loading more vehicles...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Vehicles Header with Expandable Search & 3-Dot Options Menu */}
      <VehiclesHeader
        title="Vehicle List"
        onBackPress={handleBackPress}
        onFilterChange={(filter) => setActiveFilter(filter)}
        initialFilter={activeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefreshPress={handleRefresh}
        onExportPress={() => setExportModalVisible(true)}
      />

      {/* 2. Category Tabs: All(count), Pakka(count), Kachha(count), Released(count), Shifting(count) */}
      <VehicleCategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
        counts={categoryCounts}
      />

      {/* 3. Clean & Understandable Vehicles List */}
      <View style={styles.contentArea}>
        {loading && !refreshing ? (
          <View style={styles.centerLoadingBox}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.loadingText}>Searching vehicles...</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Inbox size={32} color="#94A3B8" strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Matching Vehicles' : 'No Vehicles Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
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
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ---- Clean, Simple & Stable Card Styles ----
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vehicleNumberText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
    flex: 1,
  },
  dateCenterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  dateIcon: {
    marginRight: 1,
  },
  dateText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 5,
  },
  bankIcon: {
    marginRight: 1,
  },
  bankText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
});

