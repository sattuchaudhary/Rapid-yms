import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Car,
  X,
  Building2,
  Calendar,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  User,
} from 'lucide-react-native';
import { getVehicles, getVehicleById } from '@/services/api';
import AdminDashboardBottomNavBar, {
  AdminDashboardTabKey,
} from '../../navigation/admindashbordbottomnavbar';

type InYardCategoryFilter = 'ALL' | 'PAKKA' | 'KACHHA';

export default function ReleaseDeskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [activeCategory, setActiveCategory] = useState<InYardCategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // If directly opened with a vehicle ID, route immediately to appropriate workflow
  useEffect(() => {
    if (id) {
      getVehicleById(id)
        .then((res) => {
          const v = res?.data || res;
          if (v?.yardStatus === 'PAKKA') {
            router.replace({
              pathname: '/tenant_admin/admin/vehicles/release/pakka-release',
              params: { id: v.id },
            } as any);
          } else {
            router.replace({
              pathname: '/tenant_admin/admin/vehicles/release/kachha-release',
              params: { id: v.id },
            } as any);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [id]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch In-Yard vehicles matching search and status filter
  const fetchReleaseCandidates = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: any = {
        limit: 100,
      };

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      if (activeCategory === 'PAKKA') {
        params.yardStatus = 'PAKKA';
      } else if (activeCategory === 'KACHHA') {
        params.yardStatus = 'KACHHA';
      }

      const res = await getVehicles(params);
      const items = res?.data || res?.vehicles || [];

      // Filter only active in-yard vehicles (exclude RELEASED unless searched explicitly)
      const inYard = items.filter((v: any) => {
        if (activeCategory === 'PAKKA') return v.yardStatus === 'PAKKA';
        if (activeCategory === 'KACHHA') return v.yardStatus === 'KACHHA';
        return v.yardStatus === 'PAKKA' || v.yardStatus === 'KACHHA';
      });

      setVehicles(inYard);
    } catch (err) {
      console.warn('[Fetch Release Candidates Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, activeCategory]);

  useEffect(() => {
    fetchReleaseCandidates();
  }, [fetchReleaseCandidates]);

  const handleRefresh = () => {
    fetchReleaseCandidates(true);
  };

  // Route to the appropriate release workflow
  const handleSelectVehicle = (item: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (item.yardStatus === 'PAKKA') {
      router.push({
        pathname: '/tenant_admin/admin/vehicles/release/pakka-release',
        params: { id: item.id },
      } as any);
    } else {
      router.push({
        pathname: '/tenant_admin/admin/vehicles/release/kachha-release',
        params: { id: item.id },
      } as any);
    }
  };

  const handleTabPress = (tab: AdminDashboardTabKey) => {
    if (tab === 'home') {
      router.replace('/tenant_admin/admin/dashboard' as any);
    } else if (tab === 'vehicles') {
      router.replace('/tenant_admin/admin/vehicles' as any);
    } else if (tab === 'add') {
      router.push('/tenant_admin/admin/vehicles/add' as any);
    }
  };

  // Render individual vehicle release candidate card
  const renderVehicleItem = ({ item }: { item: any }) => {
    const isPakka = item.yardStatus === 'PAKKA';
    const vehicleNum = (item.vehicleNumber || 'UNREGISTERED').toUpperCase();
    const bank = item.bankName || item.bank?.name || 'Financier / Bank';
    const brandModel = `${item.brand ? item.brand + ' ' : ''}${item.model || 'Vehicle'}`.trim();
    const customer = item.customerName ? item.customerName : null;

    // Calculate stay days
    const entryDate = item.entryDate ? new Date(item.entryDate) : (item.createdAt ? new Date(item.createdAt) : new Date());
    const now = new Date();
    const stayDays = Math.max(1, Math.ceil((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

    const entryDateStr = entryDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={[styles.vehicleCard, isPakka ? styles.pakkaBorder : styles.kachhaBorder]}
        activeOpacity={0.82}
        onPress={() => handleSelectVehicle(item)}
      >
        {/* Top Header Row: Plate + Status Pill */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.plateGroup}>
            <View style={[styles.statusIndicatorDot, { backgroundColor: isPakka ? '#0062FF' : '#D97706' }]} />
            <Text style={styles.plateText} numberOfLines={1}>
              {vehicleNum}
            </Text>
          </View>

          <View style={[styles.statusBadge, isPakka ? styles.pakkaBadge : styles.kachhaBadge]}>
            <Text style={[styles.statusBadgeText, isPakka ? styles.pakkaBadgeText : styles.kachhaBadgeText]}>
              {isPakka ? 'PAKKA' : 'KACHHA'}
            </Text>
          </View>
        </View>

        {/* Model & Bank Info */}
        <View style={styles.cardDetailsRow}>
          <Text style={styles.brandModelText} numberOfLines={1}>
            {brandModel}
          </Text>
          <View style={styles.bulletDot} />
          <Building2 size={12} color="#64748B" />
          <Text style={styles.bankText} numberOfLines={1}>
            {bank}
          </Text>
        </View>

        {/* Customer & Stay Days Info */}
        <View style={styles.cardMetaRow}>
          {customer ? (
            <View style={styles.metaItem}>
              <User size={11} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>
                {customer}
              </Text>
            </View>
          ) : (
            <View style={styles.metaItem}>
              <Calendar size={11} color="#64748B" />
              <Text style={styles.metaText}>Entry: {entryDateStr}</Text>
            </View>
          )}

          <View style={styles.stayDaysPill}>
            <Clock size={11} color="#475569" />
            <Text style={styles.stayDaysText}>{stayDays} Days In-Yard</Text>
          </View>
        </View>

        {/* Action Button Banner */}
        <View style={[styles.actionBanner, isPakka ? styles.pakkaActionBg : styles.kachhaActionBg]}>
          <View style={styles.actionInfoGroup}>
            {isPakka ? (
              <FileCheck2 size={13} color="#0062FF" strokeWidth={2.2} />
            ) : (
              <ShieldCheck size={13} color="#B45309" strokeWidth={2.2} />
            )}
            <Text style={[styles.actionPromptText, isPakka ? styles.pakkaActionText : styles.kachhaActionText]}>
              {isPakka ? 'Pakka Release Process' : 'Kachha Release Process'}
            </Text>
          </View>

          <View style={styles.actionArrowCircle}>
            <ArrowRight size={13} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 10) }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBadge}>
            <ShieldCheck size={22} color="#0062FF" strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Vehicle Release Desk</Text>
            <Text style={styles.headerSubtitle}>Search and checkout vehicles for release</Text>
          </View>
        </View>
      </View>

      {/* 2. Universal Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={17} color="#64748B" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Plate, Chassis, Bank, Borrower..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 3. Category Filter Tabs */}
        <View style={styles.filterChipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveCategory('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeCategory === 'ALL' && styles.filterChipTextActive]}>
              All In-Yard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'PAKKA' && styles.filterChipActivePakka]}
            onPress={() => setActiveCategory('PAKKA')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeCategory === 'PAKKA' && styles.filterChipTextActivePakka]}>
              Pakka Vehicles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'KACHHA' && styles.filterChipActiveKachha]}
            onPress={() => setActiveCategory('KACHHA')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeCategory === 'KACHHA' && styles.filterChipTextActiveKachha]}>
              Kachha Vehicles
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Results List Area */}
      <View style={styles.listContainer}>
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.centerLoadingText}>Searching yard stock...</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCircle}>
              <Car size={32} color="#94A3B8" strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Matching Vehicles Found' : 'No Active Vehicles In-Yard'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `"${searchQuery}" ke liye koi in-yard vehicle match nahi hua. Search criteria check karein.`
                : 'Abhi yard me release ke liye koi active vehicle uplabdh nahi hai.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item, index) => item.id || `rel-${index}`}
            renderItem={renderVehicleItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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

      {/* 5. Bottom Navigation Bar */}
      <AdminDashboardBottomNavBar
        activeTab="release"
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  clearSearchBtn: {
    paddingHorizontal: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipActivePakka: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  filterChipActiveKachha: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextActivePakka: {
    color: '#0062FF',
    fontWeight: '700',
  },
  filterChipTextActiveKachha: {
    color: '#B45309',
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    paddingBottom: 95,
    gap: 10,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1.5,
  },
  pakkaBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#0062FF',
  },
  kachhaBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  plateText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  pakkaBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  pakkaBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0062FF',
  },
  kachhaBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  kachhaBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandModelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  bankText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  stayDaysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  stayDaysText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  pakkaActionBg: {
    backgroundColor: '#EFF6FF',
  },
  kachhaActionBg: {
    backgroundColor: '#FFFBEB',
  },
  actionInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPromptText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  pakkaActionText: {
    color: '#0062FF',
  },
  kachhaActionText: {
    color: '#B45309',
  },
  actionArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 60,
  },
  centerLoadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
    gap: 8,
  },
  emptyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
});
