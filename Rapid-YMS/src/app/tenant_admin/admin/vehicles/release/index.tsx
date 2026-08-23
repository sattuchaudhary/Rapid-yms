import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Search,
  Car,
  X,
  AlertCircle,
} from 'lucide-react-native';
import ReleaseHeader from './header';
import { getVehicles, getVehicleById } from '@/services/api';

export default function ReleaseRouterScreen() {
  const router = useRouter();
  const { id, plate } = useLocalSearchParams<{ id?: string; plate?: string }>();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [inYardVehicles, setInYardVehicles] = useState<any[]>([]);

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
          loadInYardList();
        });
    } else {
      setLoading(false);
      loadInYardList();
    }
  }, [id, plate]);

  const loadInYardList = async () => {
    try {
      const res = await getVehicles({ limit: 100 });
      const items = res?.data || res?.vehicles || [];
      const active = items.filter((v: any) => v.yardStatus === 'KACHHA' || v.yardStatus === 'PAKKA');
      setInYardVehicles(active);
    } catch (err) {
      console.warn('[Load In-Yard List Error]', err);
    }
  };

  const handleSelectVehicle = (item: any) => {
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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <ReleaseHeader
        vehicleNumber="VEHICLE RELEASE DESK"
        subtitle="Search & Select Active Vehicle"
        onBackPress={() => router.back()}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Fetching vehicle status...</Text>
        </View>
      ) : (
        <View style={styles.deskContainer}>
          <View style={styles.searchPromptBox}>
            <View style={styles.searchIconBadge}>
              <Car size={26} color="#0062FF" strokeWidth={2.4} />
            </View>
            <Text style={styles.deskTitle}>Select Vehicle for Release</Text>
            <Text style={styles.deskSub}>
              Search by license plate or bank to open Kachha / Pakka release checkout.
            </Text>
          </View>

          <View style={styles.searchBarWrapper}>
            <Search size={18} color="#64748B" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Plate (e.g. DL3C, MH12, Swift)..."
              placeholderTextColor="#94A3B8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="characters"
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 8 }}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.stockListHeader}>Active In-Yard Stock ({inYardVehicles.length})</Text>

            {(() => {
              const term = searchTerm.trim().toLowerCase();
              const filtered = term
                ? inYardVehicles.filter(
                    (v) =>
                      v.vehicleNumber?.toLowerCase().includes(term) ||
                      v.brand?.toLowerCase().includes(term) ||
                      v.model?.toLowerCase().includes(term) ||
                      v.bankName?.toLowerCase().includes(term)
                  )
                : inYardVehicles;

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptySearchBox}>
                    <AlertCircle size={28} color="#94A3B8" />
                    <Text style={styles.emptySearchText}>
                      {term ? `No active vehicles match "${searchTerm}"` : 'No active vehicles in yard'}
                    </Text>
                  </View>
                );
              }

              return filtered.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.stockItemCard}
                  onPress={() => handleSelectVehicle(item)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.stockItemNumber}>{(item.vehicleNumber || '').toUpperCase()}</Text>
                    <Text style={styles.stockItemSub}>
                      {item.brand ? `${item.brand} ` : ''}{item.model || 'Vehicle'} • {item.bankName || 'Bank'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.categoryPill,
                      item.yardStatus === 'PAKKA' ? styles.pakkaPill : styles.kachhaPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        item.yardStatus === 'PAKKA' ? styles.pakkaPillText : styles.kachhaPillText,
                      ]}
                    >
                      {item.yardStatus}
                    </Text>
                  </View>
                </TouchableOpacity>
              ));
            })()}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerLoading: {
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
  deskContainer: {
    flex: 1,
    padding: 14,
    gap: 12,
  },
  searchPromptBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  searchIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deskTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  deskSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  stockListHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  stockItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 7,
  },
  stockItemNumber: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  stockItemSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pakkaPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  pakkaPillText: {
    color: '#0062FF',
  },
  kachhaPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  kachhaPillText: {
    color: '#D97706',
  },
  emptySearchBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptySearchText: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
