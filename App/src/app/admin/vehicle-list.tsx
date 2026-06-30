import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/services/api';
import { cacheVehicles, searchCachedVehicles, getOfflineStats, CachedVehicle } from '@/services/sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import { documentDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ChevronLeft,
  Search,
  Car,
  Share2,
} from 'lucide-react-native';

export interface ListVehicle extends CachedVehicle {
  serialNumber?: number;
  photos?: any[];
  chassisNumber?: string;
  engineNumber?: string;
  repoAgency?: string;
  customerName?: string;
  customerPhone?: string;
  inventory?: any[];
  yardLocation?: any;
}

export default function VehicleListScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<ListVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'KACHHA' | 'PAKKA' | 'RELEASED'>('ALL');

  const loadData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        const res = await apiRequest('/api/vehicles?limit=1000');
        if (res.success && res.data) {
          const formatted: ListVehicle[] = res.data.map((item: any) => ({
            id: item.id,
            vehicleNumber: item.vehicleNumber,
            brand: item.brand,
            model: item.model,
            vehicleType: item.vehicleType,
            entryDate: item.entryDate,
            yardStatus: item.yardStatus,
            bankName: item.bankName,
            tenantId: item.tenantId,
            serialNumber: item.serialNumber,
            photos: item.photos,
            chassisNumber: item.chassisNumber,
            engineNumber: item.engineNumber,
            repoAgency: item.repoAgency,
            customerName: item.customerName,
            customerPhone: item.customerPhone,
            inventory: item.inventory,
            yardLocation: item.yardLocation,
          }));

          setVehicles(formatted);
          cacheVehicles(formatted);
        }
      } else {
        // Fallback offline
        const cached = searchCachedVehicles(searchQuery);
        setVehicles(cached);
      }
    } catch (e: any) {
      console.warn('[VehicleList] Failed to fetch vehicles:', e.message);
      const cached = searchCachedVehicles(searchQuery);
      setVehicles(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData(true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        if (!text.trim()) {
          loadData(false);
        } else {
          setLoading(true);
          const res = await apiRequest(`/api/vehicles?limit=1000&search=${encodeURIComponent(text)}`);
          if (res.success && res.data) {
            setVehicles(res.data);
          }
        }
      } else {
        const results = searchCachedVehicles(text);
        setVehicles(results);
      }
    } catch (e) {
      console.warn('[VehicleList] Online search failed, trying cached search:', e);
      const results = searchCachedVehicles(text);
      setVehicles(results);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic stats calculated from currently loaded search list
  const stats = useMemo(() => {
    const kachha = vehicles.filter(v => v.yardStatus === 'KACHHA').length;
    const pakka = vehicles.filter(v => v.yardStatus === 'PAKKA').length;
    const released = vehicles.filter(v => v.yardStatus === 'RELEASED').length;
    const all = vehicles.length;
    return { kachha, pakka, released, all };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    if (statusFilter === 'RELEASED') {
      return vehicles.filter(v => v.yardStatus === 'RELEASED');
    }
    if (statusFilter === 'PAKKA') {
      return vehicles.filter(v => v.yardStatus === 'PAKKA');
    }
    if (statusFilter === 'KACHHA') {
      return vehicles.filter(v => v.yardStatus === 'KACHHA');
    }
    return vehicles;
  }, [vehicles, statusFilter]);

  // Billing helpers
  const getDailyRate = (type: string) => {
    if (type === 'TW') return 50;
    if (type === 'THREE_W') return 100;
    if (type === 'CV') return 400;
    return 150; // FW / standard
  };

  const getDurationDays = (entryDateStr: string | null) => {
    if (!entryDateStr) return 1;
    const entryDate = new Date(entryDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const handleExportCSV = async () => {
    if (filteredVehicles.length === 0) {
      Alert.alert('No Data', 'There is no vehicle data to export.');
      return;
    }

    try {
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      };

      const headers = [
        'Serial No',
        'Vehicle Number',
        'Category',
        'Brand',
        'Model',
        'Bank Name',
        'Chassis Number',
        'Engine Number',
        'Customer Name',
        'Customer Phone',
        'Repo Details',
        'Entry Date',
        'Status',
        'Location',
        'Total Days',
        'Total Charges'
      ];

      const rows = filteredVehicles.map(v => {
        const days = getDurationDays(v.entryDate);
        const rate = getDailyRate(v.vehicleType);
        const totalCharges = v.yardStatus === 'KACHHA' ? 0 : days * rate;
        
        let loc = 'N/A';
        if (v.yardLocation) {
          loc = `${v.yardLocation.zone} - ${v.yardLocation.slot}`;
        }

        return [
          escapeCSV(v.serialNumber || 'N/A'),
          escapeCSV(v.vehicleNumber.toUpperCase()),
          escapeCSV(v.vehicleType),
          escapeCSV(v.brand),
          escapeCSV(v.model),
          escapeCSV(v.bankName),
          escapeCSV(v.chassisNumber),
          escapeCSV(v.engineNumber),
          escapeCSV(v.customerName),
          escapeCSV(v.customerPhone),
          escapeCSV(v.repoAgency),
          escapeCSV(v.entryDate ? new Date(v.entryDate).toLocaleString('en-IN') : 'N/A'),
          escapeCSV(v.yardStatus),
          escapeCSV(loc),
          escapeCSV(days),
          escapeCSV(totalCharges)
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const fileName = `YMS_Stock_Report_${new Date().toISOString().slice(0,10)}.csv`;
      const fileUri = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(fileUri, csvContent, { encoding: EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Vehicle Stock CSV' });
      } else {
        Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (err: any) {
      console.error('[VehicleList] CSV Export failed:', err);
      Alert.alert('Export Error', err.message || 'Could not export vehicle list.');
    }
  };

  const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=200';

  return (
    <ThemedView style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Vehicle List</ThemedText>
        <View style={styles.headerRightActions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            activeOpacity={0.7}
            onPress={handleExportCSV}
          >
            <Share2 size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={16} color="#94A3B8" style={styles.searchIconLeft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by vehicle number"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Filter Tabs Horizontal Scroll */}
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterTabsScroll}
        >
          <TouchableOpacity
            style={[styles.filterTabButton, statusFilter === 'ALL' && styles.filterTabButtonActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <ThemedText style={[styles.filterTabButtonText, statusFilter === 'ALL' && styles.filterTabButtonTextActive]}>
              All ({stats.all})
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTabButton, statusFilter === 'PAKKA' && styles.filterTabButtonActive]}
            onPress={() => setStatusFilter('PAKKA')}
          >
            <ThemedText style={[styles.filterTabButtonText, statusFilter === 'PAKKA' && styles.filterTabButtonTextActive]}>
              Pakka ({stats.pakka})
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTabButton, statusFilter === 'KACHHA' && styles.filterTabButtonActive]}
            onPress={() => setStatusFilter('KACHHA')}
          >
            <ThemedText style={[styles.filterTabButtonText, statusFilter === 'KACHHA' && styles.filterTabButtonTextActive]}>
              Kachha ({stats.kachha})
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTabButton, statusFilter === 'RELEASED' && styles.filterTabButtonActive]}
            onPress={() => setStatusFilter('RELEASED')}
          >
            <ThemedText style={[styles.filterTabButtonText, statusFilter === 'RELEASED' && styles.filterTabButtonTextActive]}>
              Released ({stats.released})
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Vehicle List */}
      {loading && filteredVehicles.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <ThemedText style={styles.loadingText}>Loading stock inventory...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.emptyList}>
              <Car size={36} color="#94A3B8" style={{ marginBottom: 12 }} />
              <ThemedText style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
                No vehicles found
              </ThemedText>
            </View>
          )}
          renderItem={({ item }) => {
            const days = getDurationDays(item.entryDate);
            const rate = getDailyRate(item.vehicleType);
            const totalCharges = item.yardStatus === 'KACHHA' ? 0 : days * rate;
            
            const displayPhoto = item.photos && item.photos.length > 0 ? 
              (item.photos.find((p: any) => p.photoType === 'front' || p.photoType === 'front_view')?.s3Url || item.photos[0].s3Url) : 
              defaultPhoto;

            return (
              <TouchableOpacity
                style={styles.vehicleCard}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/admin/vehicle-details', params: { id: item.id } })}
              >
                <View style={styles.thumbnailWrapper}>
                  <Image source={{ uri: displayPhoto }} style={styles.vehicleThumbnail} />
                  {item.serialNumber !== undefined && item.serialNumber !== null && (
                    <View style={styles.serialBadgeOverlap}>
                      <ThemedText style={styles.serialBadgeTextOverlap}>#{item.serialNumber}</ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.vehicleInfo}>
                  <ThemedText style={styles.plateNumber}>{item.vehicleNumber.toUpperCase()}</ThemedText>
                  <ThemedText style={styles.modelName} numberOfLines={1}>
                    {item.brand || 'Unknown'} {item.model || ''}
                  </ThemedText>
                  <ThemedText style={styles.inventoryNo}>
                    INV-{new Date(item.entryDate || Date.now()).getFullYear()}-{item.id.substring(0, 6).toUpperCase()}
                  </ThemedText>
                </View>

                <View style={styles.rightStats}>
                  <ThemedText style={styles.daysText}>{days} Days</ThemedText>
                  <ThemedText style={styles.amountText}>{formatCurrency(totalCharges)}</ThemedText>
                  <View style={[
                    styles.statusBadge,
                    item.yardStatus === 'KACHHA' ? styles.statusBadgeKachha :
                    item.yardStatus === 'RELEASED' ? styles.statusBadgeReleased :
                    styles.statusBadgePakka
                  ]}>
                    <ThemedText style={[
                      item.yardStatus === 'KACHHA' ? styles.statusBadgeTextKachha :
                      item.yardStatus === 'RELEASED' ? styles.statusBadgeTextReleased :
                      styles.statusBadgeTextPakka
                    ]}>
                      {item.yardStatus === 'KACHHA' ? 'Kachha' :
                       item.yardStatus === 'RELEASED' ? 'Released' : 'In Yard'}
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIconLeft: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTabButton: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterTabButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterTabButtonTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  vehicleThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  serialBadgeOverlap: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FDE047',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  serialBadgeTextOverlap: {
    color: '#1E293B',
    fontSize: 8,
    fontWeight: '900',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    gap: 2,
  },
  plateNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  modelName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  inventoryNo: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
  },
  rightStats: {
    alignItems: 'flex-end',
    gap: 3,
  },
  daysText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  amountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeKachha: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeTextKachha: {
    color: '#D97706',
    fontSize: 8,
    fontWeight: '800',
  },
  statusBadgePakka: {
    backgroundColor: '#E6F4EA',
  },
  statusBadgeTextPakka: {
    color: '#137333',
    fontSize: 8,
    fontWeight: '800',
  },
  statusBadgeReleased: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeTextReleased: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '800',
  },
});
