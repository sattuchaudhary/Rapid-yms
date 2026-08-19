import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Info,
  Camera,
  Receipt,
  Edit3,
  Printer,
  Share2,
  X,
  History,
} from 'lucide-react-native';
import VehicleDetailHeader from './header';
import VehicleDateTimeline from './date';
import VehicleInfo from './vehicleinfo';
import VehiclePhotos from './photos';
import ParkingCharge from './parkingcharge';
import VehicleDetailBottomBar from './bottombar';
import { getVehicleById } from '@/services/api';

export type VehicleDetailTab = 'date' | 'info' | 'photos' | 'charges';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<VehicleDetailTab>('date');
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3-Dots Action Sheet Modal
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  const fetchVehicle = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getVehicleById(id);
      const data = res?.data || res;
      setVehicle(data);
    } catch (err: any) {
      console.warn('[Fetch Vehicle Detail Error]', err);
      setError(err?.message || 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const handleTabChange = (tab: VehicleDetailTab) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setActiveTab(tab);
  };

  const handleBackPress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tenant_admin/admin/vehicles' as any);
    }
  };

  const handleMenuPress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setMenuModalVisible(true);
  };

  const handleOpenEdit = () => {
    setMenuModalVisible(false);
    if (vehicle?.id) {
      router.push({
        pathname: '/tenant_admin/admin/vehicles/details/edit',
        params: { id: vehicle.id },
      } as any);
    }
  };

  const handleReleasePress = () => {
    Alert.alert(
      'Release Vehicle',
      `Are you sure you want to release ${vehicle?.vehicleNumber || 'this vehicle'} from yard stock?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed to Release',
          style: 'default',
          onPress: () => {
            Alert.alert('Release Process', 'Release gate pass generation modal will open.');
          },
        },
      ]
    );
  };

  const handleInYardPress = () => {
    if (vehicle?.yardStatus === 'PAKKA') {
      Alert.alert('Vehicle Status', `${vehicle?.vehicleNumber || 'Vehicle'} is already in Pakka Yard status.`);
      return;
    }

    if (vehicle?.id) {
      router.push({
        pathname: '/tenant_admin/admin/vehicles/details/kachha-to-pakka',
        params: { id: vehicle.id },
      } as any);
    }
  };

  const vehicleNumber = vehicle?.vehicleNumber || 'VEHICLE DETAILS';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Top Header */}
      <VehicleDetailHeader
        vehicleNumber={vehicleNumber}
        onBackPress={handleBackPress}
        onMenuPress={handleMenuPress}
      />

      {/* 2. Premium 4-Segment Controller (Dates, Info, Photos, Charges) */}
      <View style={styles.tabsWrapper}>
        <View style={styles.segmentedTrack}>
          {/* Tab 1: Dates */}
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'date' && styles.segmentBtnActive]}
            onPress={() => handleTabChange('date')}
            activeOpacity={0.8}
          >
            <Calendar
              size={13.5}
              color={activeTab === 'date' ? '#0062FF' : '#64748B'}
              strokeWidth={2.4}
            />
            <Text style={[styles.segmentText, activeTab === 'date' && styles.segmentTextActive]}>
              Dates
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Vehicle Info */}
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'info' && styles.segmentBtnActive]}
            onPress={() => handleTabChange('info')}
            activeOpacity={0.8}
          >
            <Info
              size={13.5}
              color={activeTab === 'info' ? '#0062FF' : '#64748B'}
              strokeWidth={2.4}
            />
            <Text style={[styles.segmentText, activeTab === 'info' && styles.segmentTextActive]}>
              Info
            </Text>
          </TouchableOpacity>

          {/* Tab 3: Photos */}
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'photos' && styles.segmentBtnActive]}
            onPress={() => handleTabChange('photos')}
            activeOpacity={0.8}
          >
            <Camera
              size={13.5}
              color={activeTab === 'photos' ? '#0062FF' : '#64748B'}
              strokeWidth={2.4}
            />
            <Text style={[styles.segmentText, activeTab === 'photos' && styles.segmentTextActive]}>
              Photos
            </Text>
          </TouchableOpacity>

          {/* Tab 4: Parking Charges */}
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'charges' && styles.segmentBtnActive]}
            onPress={() => handleTabChange('charges')}
            activeOpacity={0.8}
          >
            <Receipt
              size={13.5}
              color={activeTab === 'charges' ? '#0062FF' : '#64748B'}
              strokeWidth={2.4}
            />
            <Text style={[styles.segmentText, activeTab === 'charges' && styles.segmentTextActive]}>
              Charges
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Section Content Body */}
      <View style={styles.contentArea}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerLoading}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicle} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : vehicle ? (
          <>
            {activeTab === 'date' && <VehicleDateTimeline vehicle={vehicle} />}
            {activeTab === 'info' && <VehicleInfo vehicle={vehicle} />}
            {activeTab === 'photos' && <VehiclePhotos vehicle={vehicle} />}
            {activeTab === 'charges' && <ParkingCharge vehicle={vehicle} />}
          </>
        ) : null}
      </View>

      {/* 4. Bottom Action Bar (Release • In Yard) */}
      {!loading && vehicle && (
        <VehicleDetailBottomBar
          vehicle={vehicle}
          onReleasePress={handleReleasePress}
          onInYardPress={handleInYardPress}
        />
      )}

      {/* 5. 3-Dots Action Sheet Modal */}
      <Modal
        visible={menuModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuModalVisible(false)}>
          <View style={styles.menuModalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuModalSheet, { paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={styles.menuSheetHandle} />

                {/* Header */}
                <View style={styles.menuSheetHeader}>
                  <View>
                    <Text style={styles.menuSheetTitle}>Vehicle Options</Text>
                    <Text style={styles.menuSheetSub}>{vehicleNumber.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.menuCloseBtn}
                    onPress={() => setMenuModalVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={18} color="#64748B" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Action Items List */}
                <View style={styles.menuOptionsList}>
                  {/* Option 1: Edit Vehicle & Dates */}
                  <TouchableOpacity
                    style={styles.menuOptionRow}
                    onPress={handleOpenEdit}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.menuOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <Edit3 size={19} color="#0062FF" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionTitle}>Edit Vehicle & Dates</Text>
                      <Text style={styles.menuOptionSub}>Correct status, lifecycle dates and vehicle info</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Print Entry Slip */}
                  <TouchableOpacity
                    style={styles.menuOptionRow}
                    onPress={() => {
                      setMenuModalVisible(false);
                      Alert.alert('Print Slip', 'Generating PDF entry slip for printing...');
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.menuOptionIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <Printer size={19} color="#059669" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionTitle}>Print Entry Slip</Text>
                      <Text style={styles.menuOptionSub}>Print inventory receipt and gate pass slip</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 3: Share Details */}
                  <TouchableOpacity
                    style={styles.menuOptionRow}
                    onPress={() => {
                      setMenuModalVisible(false);
                      Alert.alert('Share', `Vehicle ${vehicleNumber} details ready to share.`);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.menuOptionIconBox, { backgroundColor: '#F8FAFC' }]}>
                      <Share2 size={19} color="#64748B" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuOptionTitle}>Share Details</Text>
                      <Text style={styles.menuOptionSub}>Share summary via WhatsApp or Message</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.menuCancelBtn}
                  onPress={() => setMenuModalVisible(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.menuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 11,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    height: 35,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  contentArea: {
    flex: 1,
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
  errorText: {
    fontSize: 13,
    color: '#E11D48',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#0062FF',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },

  // 3-Dots Action Sheet Modal Styles
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  menuModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    gap: 12,
  },
  menuSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  menuSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuSheetSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  menuCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionsList: {
    gap: 8,
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  menuOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  menuCancelBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  menuCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
});
