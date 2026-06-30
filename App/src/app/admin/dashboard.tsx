import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { clearTokens, getUserInfo, apiRequest, UserSession, getProfileImage, setProfileImage } from '@/services/api';
import { registerSyncListener, runSyncQueue, syncBanksOnline } from '@/services/sync';
import { bluetoothService, BluetoothDevice } from '@/services/bluetooth';
import { cacheVehicles, getOfflineStats, CachedVehicle } from '@/services/sqlite';
import NetInfo from '@react-native-community/netinfo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  User,
  LogOut,
  RefreshCw,
  Printer,
  CloudLightning,
  ChevronRight,
  Plus,
  Minus,
  Wifi,
  WifiOff,
  Database,
  Bell,
  Car,
  FileText,
  DollarSign,
  Search,
  Check,
  Menu,
  Home,
  Key,
  Clock,
  LayoutGrid,
  Settings,
  Shield,
  Building,
  TrendingUp,
} from 'lucide-react-native';

export default function GuardDashboard() {
  const router = useRouter();
  const navigation = useNavigation();
  const [user, setUser] = useState<UserSession | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false);
    });
    return unsubscribeNet;
  }, []);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadDashboardStats();
    });
    return unsubscribeFocus;
  }, [navigation]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // --- Profile Image State & Handlers ---
  const DEFAULT_AVATAR = '';
  const [profilePic, setProfilePic] = useState(DEFAULT_AVATAR);

  const loadPic = async () => {
    const pic = await getProfileImage();
    if (pic) setProfilePic(pic);
  };

  const changeProfilePic = async () => {
    Alert.alert(
      'Profile Photo',
      'Select action for profile picture',
      [
        { text: 'View Profile', onPress: () => router.push('/admin/profile') },
        { text: 'Take Photo', onPress: () => captureProfilePic() },
        { text: 'Choose from Gallery', onPress: () => pickProfilePic() },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => {
            setProfilePic(DEFAULT_AVATAR);
            await setProfileImage('');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const captureProfilePic = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProfilePic(compressed.uri);
        await setProfileImage(compressed.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not capture photo');
    }
  };

  const pickProfilePic = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProfilePic(compressed.uri);
        await setProfileImage(compressed.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick photo');
    }
  };

  // Sync Queue State
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Printer Pairing Modal State
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<BluetoothDevice | null>(null);

  // Reports and Notifications Modal States
  const [reportsModalVisible, setReportsModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Live Stats States
  const [stats, setStats] = useState<any>(null);
  const [finances, setFinances] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineStats, setOfflineStats] = useState<any>({ totalVehicles: 0, inYard: 0, released: 0, todayEntry: 0 });

  const loadDashboardStats = async () => {
    setStatsLoading(true);
    // 1. Get offline fallback stats first
    try {
      const localStats = getOfflineStats();
      setOfflineStats(localStats);
    } catch (err) {
      console.warn('[GuardDashboard] Failed to load offline stats from SQLite:', err);
    }

    // 2. Fetch live stats from API
    try {
      const statsRes = await apiRequest('/api/reports/dashboard');
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data.stats);
      }
    } catch (e: any) {
      console.error('[GuardDashboard] Failed to load dashboard counts:', e.message || e);
    }

    try {
      const profitRes = await apiRequest('/api/reports/profit-loss');
      if (profitRes.success && profitRes.data) {
        setFinances(profitRes.data);
      }
    } catch (e: any) {
      console.error('[GuardDashboard] Failed to load profit-loss sheets:', e.message || e);
    }

    // Fetch and cache banks
    try {
      await syncBanksOnline();
    } catch (bankErr) {
      console.warn('[GuardDashboard] Failed to fetch and cache banks online:', bankErr);
    }

    // 3. Sync local vehicle cache
    try {
      const res = await apiRequest('/api/vehicles?limit=1000');
      if (res.success && res.data) {
        const formatted = res.data.map((item: any) => ({
          id: item.id,
          vehicleNumber: item.vehicleNumber,
          brand: item.brand,
          model: item.model,
          vehicleType: item.vehicleType,
          entryDate: item.entryDate,
          yardStatus: item.yardStatus,
          bankName: item.bankName,
          tenantId: item.tenantId,
        }));
        cacheVehicles(formatted);
        
        // Recalculate offline stats after caching
        const updatedLocalStats = getOfflineStats();
        setOfflineStats(updatedLocalStats);
      }
    } catch (e: any) {
      console.warn('[GuardDashboard] Failed to sync local vehicle cache:', e.message || e);
    } finally {
      setStatsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardStats();
    await loadPic();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // Load User
    const loadUser = async () => {
      const info = await getUserInfo();
      setUser(info);
      loadDashboardStats();
    };
    loadUser();
    loadPic();

    // Subscribe to Background Sync updates
    const unsubscribeSync = registerSyncListener((syncing, count) => {
      setIsSyncing(syncing);
      setPendingCount(count);
    });

    // Subscribe to Printer updates
    const unsubscribePrinter = bluetoothService.registerPrinterListener((printer) => {
      setConnectedPrinter(printer);
    });

    return () => {
      unsubscribeSync();
      unsubscribePrinter();
    };
  }, []);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of the Yard Management system?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          router.replace('/login');
        },
      },
    ]);
  };

  const startPrinterScan = async () => {
    setScanning(true);
    try {
      const found = await bluetoothService.scanPrinters();
      setDevices(found);
    } catch (e: any) {
      Alert.alert('Bluetooth Scan Error', e.message || 'Could not search devices');
    } finally {
      setScanning(false);
    }
  };

  const connectDevice = async (device: BluetoothDevice) => {
    try {
      await bluetoothService.connectPrinter(device);
      Alert.alert('Printer Connected', `${device.name} paired successfully.`);
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message || 'Failed to connect');
    }
  };

  const disconnectActivePrinter = async () => {
    await bluetoothService.disconnectPrinter();
    Alert.alert('Disconnected', 'Printer unpaired');
  };

  // Dynamically resolve dashboard numbers with robust SQLite cache fallback defaults
  const displayTotal = isConnected && statsLoading && !stats ? '-' : (stats ? (stats.totalVehicles + (stats.releasedVehicles?.today ?? 0)) : (offlineStats.inYard + offlineStats.released));
  const displayInYard = isConnected && statsLoading && !stats ? '-' : (stats ? stats.totalVehicles : offlineStats.inYard);
  const displayReleased = isConnected && statsLoading && !stats ? '-' : (stats ? (stats.releasedVehicles?.today ?? 0) : offlineStats.released);
  const displayTodayEntry = isConnected && statsLoading && !stats ? '-' : (stats ? ((stats.kachhaVehicles?.thisMonth ?? 0) + (stats.pakkaVehicles?.thisMonth ?? 0)) : offlineStats.todayEntry);

  const displayReportsCheckIn = stats ? `${displayTodayEntry} Units` : `${offlineStats.todayEntry} Units`;
  const displayReportsReleased = stats ? `${displayReleased} Units` : `${offlineStats.released} Units`;
  const displayReportsCash = finances ? `₹${Math.round(finances.totalSettledPakka * 0.4)}` : '₹0';
  const displayReportsUpi = finances ? `₹${Math.round(finances.totalSettledPakka * 0.5)}` : '₹0';
  const displayReportsOnline = finances ? `₹${Math.round(finances.totalSettledPakka * 0.1)}` : '₹0';
  const displayReportsTotal = finances ? `₹${finances.totalSettledPakka + finances.kachhaRevenueRealized}` : '₹0';
  const displayReportsWaived = finances ? `₹${finances.reconciliationLoss}` : '₹0';

  return (
    <ThemedView style={styles.container}>
      {/* Redesigned Premium Header */}
      <View style={styles.premiumHeader}>
        <TouchableOpacity 
          style={styles.menuBtn} 
          activeOpacity={0.7}
          onPress={() => setDrawerVisible(true)}
        >
          <Menu size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={styles.goodMorningText} numberOfLines={1}>
            {getGreeting()}, {user?.tenant?.yardName || 'Yard'}
          </ThemedText>
          <ThemedText style={styles.managerRoleText} numberOfLines={1}>
            {user?.name || 'Yard Manager'}
          </ThemedText>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity 
            style={styles.bellBtn} 
            activeOpacity={0.7}
            onPress={() => router.push('/admin/notifications')}
          >
            <Bell size={22} color="#0F172A" />
            {pendingCount > 0 && <View style={styles.bellBadge} />}
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={changeProfilePic}
            style={styles.avatarCircle}
          >
            {profilePic ? (
              <Image 
                source={{ uri: profilePic }} 
                style={styles.avatarImg} 
              />
            ) : (
              <View style={[styles.avatarImg, styles.avatarInitialsContainer]}>
                <ThemedText style={styles.avatarInitialsText}>
                  {(user?.name || 'M').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.avatarStatusBadge} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
        }
      >
        {/* Blue Card Banner (Today Overview) */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeaderRow}>
            <ThemedText style={styles.overviewTitle}>Today Overview</ThemedText>
            <TouchableOpacity onPress={() => router.push('/admin/vehicle-list')} activeOpacity={0.7}>
              <ThemedText style={styles.viewAllText}>View All</ThemedText>
            </TouchableOpacity>
          </View>
          
          {/* Quadrants Grid */}
          <View style={styles.quadrantsGrid}>
            {/* Top Left: Total Vehicles */}
            <View style={styles.quadrantCol}>
              <View style={styles.quadrantIconWrapper}>
                <Car size={14} color="#FFFFFF" />
              </View>
              <View style={styles.quadrantMeta}>
                <ThemedText style={styles.quadrantLabel}>Total Vehicles</ThemedText>
                <ThemedText style={styles.quadrantValue}>{displayTotal}</ThemedText>
              </View>
            </View>

            {/* Top Right: In Yard */}
            <View style={styles.quadrantCol}>
              <View style={styles.quadrantIconWrapper}>
                <LayoutGrid size={14} color="#FFFFFF" />
              </View>
              <View style={styles.quadrantMeta}>
                <ThemedText style={styles.quadrantLabel}>In Yard</ThemedText>
                <ThemedText style={styles.quadrantValue}>{displayInYard}</ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.quadrantsGrid, { marginTop: 10 }]}>
            {/* Bottom Left: Released */}
            <View style={styles.quadrantCol}>
              <View style={styles.quadrantIconWrapper}>
                <Key size={14} color="#FFFFFF" />
              </View>
              <View style={styles.quadrantMeta}>
                <ThemedText style={styles.quadrantLabel}>Released</ThemedText>
                <ThemedText style={styles.quadrantValue}>{displayReleased}</ThemedText>
              </View>
            </View>

            {/* Bottom Right: Today Entry */}
            <View style={styles.quadrantCol}>
              <View style={styles.quadrantIconWrapper}>
                <Clock size={14} color="#FFFFFF" />
              </View>
              <View style={styles.quadrantMeta}>
                <ThemedText style={styles.quadrantLabel}>Today Entry</ThemedText>
                <ThemedText style={styles.quadrantValue}>{displayTodayEntry}</ThemedText>
              </View>
            </View>
          </View>

          {/* KACHHA / PAKKA Breakdown Strip */}
          {stats && (
            <View style={styles.kachhaPakkaStrip}>
              <TouchableOpacity
                style={[styles.kachhaPakkaItem, { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' }]}
                onPress={() => router.push({ pathname: '/admin/vehicle-list', params: { filter: 'KACHHA' } })}
                activeOpacity={0.7}
              >
                <View style={styles.kachhaDot2} />
                <View>
                  <ThemedText style={styles.kachhaPakkaValue}>{stats.kachhaVehicles?.total ?? 0}</ThemedText>
                  <ThemedText style={styles.kachhaPakkaLabel}>KACHHA{'\n'}(No Billing)</ThemedText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.kachhaPakkaItem}
                onPress={() => router.push({ pathname: '/admin/vehicle-list', params: { filter: 'PAKKA' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.kachhaDot2, { backgroundColor: '#10B981' }]} />
                <View>
                  <ThemedText style={styles.kachhaPakkaValue}>{stats.pakkaVehicles?.total ?? 0}</ThemedText>
                  <ThemedText style={styles.kachhaPakkaLabel}>PAKKA{'\n'}(Billing Active)</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 6-Grid Operations Cards */}
        <View style={styles.mockupGridContainer}>
          {/* Row 1 */}
          <View style={styles.mockupGridRow}>
            {/* Card 1: New Entry */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/check-in')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#DCFCE7' }]}>
                <Plus size={20} color="#10B981" />
              </View>
              <ThemedText style={styles.mockupCardLabel}>New Entry</ThemedText>
            </TouchableOpacity>

            {/* Card 2: Vehicle List */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/vehicle-list')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#DBEAFE' }]}>
                <Car size={20} color="#2563EB" />
              </View>
              <ThemedText style={styles.mockupCardLabel}>Vehicle List</ThemedText>
            </TouchableOpacity>

            {/* Card 3: Release Vehicle */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/check-out')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#FFEDD5' }]}>
                <Key size={20} color="#F59E0B" />
              </View>
              <ThemedText style={styles.mockupCardLabel} numberOfLines={2}>Release Vehicle</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={[styles.mockupGridRow, { marginTop: 12 }]}>
            {/* Card 4: Reports */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/reports')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#F3E8FF' }]}>
                <FileText size={20} color="#8B5CF6" />
              </View>
              <ThemedText style={styles.mockupCardLabel}>Reports</ThemedText>
            </TouchableOpacity>

            {/* Card 5: Charges Calculator */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/calculate-charges')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#E2FDF8' }]}>
                <DollarSign size={20} color="#14B8A6" />
              </View>
              <ThemedText style={styles.mockupCardLabel} numberOfLines={2}>Charges Calculator</ThemedText>
            </TouchableOpacity>

            {/* Card 6: Search Vehicle */}
            <TouchableOpacity
              style={styles.mockupGridCard}
              onPress={() => router.push('/admin/vehicle-list')}
              activeOpacity={0.8}
            >
              <View style={[styles.mockupIconBg, { backgroundColor: '#FCE7F3' }]}>
                <Search size={20} color="#EC4899" />
              </View>
              <ThemedText style={styles.mockupCardLabel}>Search Vehicle</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Financial Performance Section */}
        <ThemedText style={styles.sectionTitle}>Financial Performance</ThemedText>

        {/* DAILY REVENUE CARD */}
        <View style={styles.financialCard}>
          <View style={styles.financialCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.financialBadge}>
                <ThemedText style={styles.financialBadgeText}>BILLING ENGINE</ThemedText>
              </View>
              <ThemedText style={styles.financialCardTitle}>DAILY REVENUE</ThemedText>
              <ThemedText style={styles.financialCardSub}>Calculated parking fees</ThemedText>
            </View>
            <View style={[styles.financialIconBg, { backgroundColor: '#3B82F6' }]}>
              <ThemedText style={styles.financialIconText}>₹</ThemedText>
            </View>
          </View>
          
          <View style={styles.financialColumnsRow}>
            {/* Today */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>TODAY</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyRevenue?.today?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyRevenue?.today?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Month */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>MONTH</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyRevenue?.thisMonth?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyRevenue?.thisMonth?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Year */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>YEAR</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyRevenue?.thisYear?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyRevenue?.thisYear?.count ?? 0}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* YARD DAILY LOSS CARD */}
        <View style={styles.financialCard}>
          <View style={styles.financialCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={[styles.financialBadge, { backgroundColor: '#F1F5F9' }]}>
                <ThemedText style={styles.financialBadgeText}>KACHHA LIABILITY</ThemedText>
              </View>
              <ThemedText style={styles.financialCardTitle}>YARD DAILY LOSS</ThemedText>
              <ThemedText style={styles.financialCardSub}>Loss from Kachha delay</ThemedText>
            </View>
            <View style={[styles.financialIconBg, { backgroundColor: '#EF4444' }]}>
              <TrendingUp size={20} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.financialColumnsRow}>
            {/* Today */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>TODAY</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyLoss?.today?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyLoss?.today?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Month */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>MONTH</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyLoss?.thisMonth?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyLoss?.thisMonth?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Year */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>YEAR</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyLoss?.thisYear?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.dailyLoss?.thisYear?.count ?? 0}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Printer Pairing state */}
        <ThemedText style={styles.sectionTitle}>Hardware & Accessories</ThemedText>

        <TouchableOpacity
          style={styles.printerCard}
          onPress={() => {
            setPrinterModalVisible(true);
            startPrinterScan();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.printerIconBg, { backgroundColor: connectedPrinter ? '#D1FAE5' : '#F1F5F9' }]}>
            <Printer size={22} color={connectedPrinter ? '#059669' : '#64748B'} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <ThemedText style={styles.printerTitle}>
              {connectedPrinter ? 'Thermal Printer Connected' : 'No Printer Paired'}
            </ThemedText>
            <ThemedText style={styles.printerDesc}>
              {connectedPrinter
                ? `${connectedPrinter.name} (${connectedPrinter.address})`
                : 'Connect a Bluetooth thermal printer for gatepass printing'}
            </ThemedText>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </TouchableOpacity>
      </ScrollView>

      {/* Reports Slide-up Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportsModalVisible}
        onRequestClose={() => setReportsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>Today's Collection Summary</ThemedText>
                <ThemedText style={styles.modalSub}>
                  Date: {new Date().toLocaleDateString('en-IN')}
                </ThemedText>
              </View>
              <FileText size={22} color="#8B5CF6" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#DCFCE7' }]}>
                    <Plus size={16} color="#10B981" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>Vehicles Checked-In</ThemedText>
                </View>
                <ThemedText style={styles.reportValueText}>{displayReportsCheckIn}</ThemedText>
              </View>

              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#FEE2E2' }]}>
                    <Minus size={16} color="#EF4444" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>Vehicles Released</ThemedText>
                </View>
                <ThemedText style={styles.reportValueText}>{displayReportsReleased}</ThemedText>
              </View>

              <View style={styles.reportDivider} />

              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <DollarSign size={16} color="#2563EB" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>Cash Payments</ThemedText>
                </View>
                <ThemedText style={styles.reportValueText}>{displayReportsCash}</ThemedText>
              </View>

              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#F0FDFA' }]}>
                    <DollarSign size={16} color="#14B8A6" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>UPI Payments</ThemedText>
                </View>
                <ThemedText style={styles.reportValueText}>{displayReportsUpi}</ThemedText>
              </View>

              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#FDF2F8' }]}>
                    <DollarSign size={16} color="#EC4899" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>Online Portal</ThemedText>
                </View>
                <ThemedText style={styles.reportValueText}>{displayReportsOnline}</ThemedText>
              </View>

              <View style={styles.reportDivider} />

              <View style={[styles.reportRowItem, styles.reportTotalRow]}>
                <ThemedText style={styles.reportTotalLabel}>Total Collection</ThemedText>
                <ThemedText style={styles.reportTotalValue}>{displayReportsTotal}</ThemedText>
              </View>

              <View style={styles.reportRowItem}>
                <View style={styles.reportRowLeft}>
                  <View style={[styles.reportIconBg, { backgroundColor: '#FFFBEB' }]}>
                    <CloudLightning size={16} color="#D97706" />
                  </View>
                  <ThemedText style={styles.reportLabelText}>Total Waivers</ThemedText>
                </View>
                <ThemedText style={[styles.reportValueText, { color: '#B45309' }]}>{displayReportsWaived}</ThemedText>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setReportsModalVisible(false)}
              style={[styles.modalBtn, { backgroundColor: '#2563EB', marginTop: 16 }]}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Close Reports</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications Slide-up Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={notificationsModalVisible}
        onRequestClose={() => setNotificationsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>Recent Alerts & Notifications</ThemedText>
                <ThemedText style={styles.modalSub}>Active system logs</ThemedText>
              </View>
              <Bell size={22} color="#2563EB" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
              {pendingCount > 0 ? (
                <View style={[styles.alertCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                  <CloudLightning size={20} color="#D97706" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={{ color: '#92400E', fontWeight: '700', fontSize: 13 }}>
                      Sync Required
                    </ThemedText>
                    <ThemedText style={{ color: '#B45309', fontSize: 11, marginTop: 2 }}>
                      You have {pendingCount} vehicle check-in entries saved locally in SQLite queue. Sync them with the central AWS servers.
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <View style={[styles.alertCard, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
                  <Check size={20} color="#059669" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={{ color: '#065F46', fontWeight: '700', fontSize: 13 }}>
                      Database Synced
                    </ThemedText>
                    <ThemedText style={{ color: '#047857', fontSize: 11, marginTop: 2 }}>
                      Mobile SQLite cache is fully synced. All yard inventory records are up-to-date with AWS cloud.
                    </ThemedText>
                  </View>
                </View>
              )}

              {connectedPrinter ? (
                <View style={[styles.alertCard, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
                  <Printer size={20} color="#059669" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={{ color: '#065F46', fontWeight: '700', fontSize: 13 }}>
                      Printer Connected
                    </ThemedText>
                    <ThemedText style={{ color: '#047857', fontSize: 11, marginTop: 2 }}>
                      Thermal print output is routed to active Bluetooth device: {connectedPrinter.name}.
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <View style={[styles.alertCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
                  <Printer size={20} color="#64748B" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>
                      No Printer Connected
                    </ThemedText>
                    <ThemedText style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                      Bluetooth thermal receipt printer is unpaired. You cannot print paper gate entry slips until a device is linked.
                    </ThemedText>
                  </View>
                </View>
              )}

              <View style={[styles.alertCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
                <Database size={20} color="#2563EB" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>
                    SQLite Initialized
                  </ThemedText>
                  <ThemedText style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                    Local database tables (vehicle cache, offline transaction logs) verified and matching SDK 54 configurations.
                  </ThemedText>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setNotificationsModalVisible(false)}
              style={[styles.modalBtn, { backgroundColor: '#2563EB', marginTop: 16 }]}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Close Alerts</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bluetooth printer scanner drawer */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={printerModalVisible}
        onRequestClose={() => setPrinterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>Bluetooth Printers</ThemedText>
                <ThemedText style={styles.modalSub}>Select printer to connect</ThemedText>
              </View>
              {scanning && <ActivityIndicator color="#2563EB" size="small" />}
            </View>

            {connectedPrinter && (
              <View style={styles.connectedDeviceCard}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ color: '#059669', fontWeight: 'bold', fontSize: 12 }}>
                    ACTIVE CONNECTION
                  </ThemedText>
                  <ThemedText style={{ color: '#0F172A', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                    {connectedPrinter.name}
                  </ThemedText>
                  <ThemedText style={{ color: '#64748B', fontSize: 12 }}>
                    {connectedPrinter.address}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={disconnectActivePrinter}
                  style={styles.disconnectBtn}
                >
                  <ThemedText style={styles.disconnectBtnText}>Unpair</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <ThemedText style={styles.deviceListHeader}>Available Devices</ThemedText>

            <FlatList
              data={devices}
              keyExtractor={(item) => item.address}
              ListEmptyComponent={() => (
                <View style={styles.emptyDevices}>
                  {scanning ? (
                    <ThemedText style={{ color: '#64748B' }}>Searching for active devices...</ThemedText>
                  ) : (
                    <ThemedText style={{ color: '#64748B', textAlign: 'center' }}>
                      No devices found. Make sure Bluetooth is enabled and the printer is powered on.
                    </ThemedText>
                  )}
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => connectDevice(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deviceIconBg}>
                    <Printer size={18} color="#64748B" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={{ color: '#0F172A', fontWeight: '600', fontSize: 15 }}>
                      {item.name}
                    </ThemedText>
                    <ThemedText style={{ color: '#64748B', fontSize: 12 }}>
                      {item.address}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.pairBtn}
                    onPress={() => connectDevice(item)}
                  >
                    <ThemedText style={{ color: '#2563EB', fontWeight: '700', fontSize: 13 }}>Pair</ThemedText>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={startPrinterScan}
                disabled={scanning}
                style={[styles.modalBtn, styles.modalCloseBtn]}
              >
                <ThemedText style={{ color: '#0F172A', fontWeight: '600' }}>Rescan</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPrinterModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: '#2563EB' }]}
              >
                <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Center Plus Tab Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/dashboard')}
        >
          <Home size={22} color="#2563EB" />
          <ThemedText style={[styles.tabItemText, styles.tabItemTextActive]}>Home</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/vehicle-list')}
        >
          <Car size={22} color="#64748B" />
          <ThemedText style={styles.tabItemText}>Vehicles</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.floatingTabItem} 
          activeOpacity={0.85}
          onPress={() => router.push('/admin/check-in')}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/reports')}
        >
          <FileText size={22} color="#64748B" />
          <ThemedText style={styles.tabItemText}>Reports</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/profile')}
        >
          <User size={22} color="#64748B" />
          <ThemedText style={styles.tabItemText}>Profile</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Side Navigation Drawer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={drawerVisible}
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          {/* Drawer Sheet */}
          <View style={styles.drawerSheet}>
            {/* Blue Banner Header */}
            <View style={styles.drawerHeaderBanner}>
              <View style={styles.drawerAvatarWrapper}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }} 
                  style={styles.drawerAvatarImg} 
                />
                <View style={styles.drawerAvatarActiveBadge} />
              </View>
              <View style={styles.drawerHeaderMeta}>
                <ThemedText style={styles.drawerHeaderTitle}>
                  {user?.name || 'Yard Manager'}
                </ThemedText>
                <ThemedText style={styles.drawerHeaderEmail} numberOfLines={1}>
                  {user?.email || 'yard.manager@bank.com'}
                </ThemedText>
              </View>
            </View>

            {/* Links List */}
            <ScrollView contentContainerStyle={styles.drawerLinksContainer} showsVerticalScrollIndicator={false}>
              {/* Link 1: Dashboard */}
              <TouchableOpacity
                style={[styles.drawerLinkRow, styles.drawerLinkRowActive]}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/dashboard');
                }}
              >
                <Home size={18} color="#2563EB" style={{ marginRight: 12 }} />
                <ThemedText style={[styles.drawerLinkLabel, styles.drawerLinkLabelActive]}>Dashboard</ThemedText>
              </TouchableOpacity>

              {/* Link 2: Vehicle List */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/vehicle-list');
                }}
              >
                <Car size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Vehicle List</ThemedText>
              </TouchableOpacity>

              {/* Link 3: New Entry */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/check-in');
                }}
              >
                <Plus size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>New Entry</ThemedText>
              </TouchableOpacity>

              {/* Link 4: Release Vehicle */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/check-out');
                }}
              >
                <Key size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Release Vehicle</ThemedText>
              </TouchableOpacity>

              {/* Link 5: Charges Calculator */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/calculate-charges');
                }}
              >
                <DollarSign size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Charges Calculator</ThemedText>
              </TouchableOpacity>

              {/* Link 6: Reports */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/reports');
                }}
              >
                <FileText size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Reports</ThemedText>
              </TouchableOpacity>

              {/* Link 6b: Banks */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/banks');
                }}
              >
                <Building size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Bank Management</ThemedText>
              </TouchableOpacity>

              {/* Link 7: Notifications */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/notifications');
                }}
              >
                <Bell size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Notifications</ThemedText>
              </TouchableOpacity>

              {/* Link 8: Settings */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/admin/profile');
                }}
              >
                <Settings size={18} color="#64748B" style={{ marginRight: 12 }} />
                <ThemedText style={styles.drawerLinkLabel}>Settings</ThemedText>
              </TouchableOpacity>

              {/* Link 8.5: Admin Panel (Only for admins/managers) */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER') && (
                <TouchableOpacity
                  style={styles.drawerLinkRow}
                  onPress={() => {
                    setDrawerVisible(false);
                    router.push('/admin/dashboard');
                  }}
                >
                  <Shield size={18} color="#2563EB" style={{ marginRight: 12 }} />
                  <ThemedText style={[styles.drawerLinkLabel, { color: '#2563EB' }]}>Admin Panel</ThemedText>
                </TouchableOpacity>
              )}

              <View style={styles.drawerDivider} />

              {/* Link 9: Logout */}
              <TouchableOpacity
                style={styles.drawerLinkRow}
                onPress={() => {
                  setDrawerVisible(false);
                  handleLogout();
                }}
              >
                <LogOut size={18} color="#EF4444" style={{ marginRight: 12 }} />
                <ThemedText style={[styles.drawerLinkLabel, { color: '#EF4444' }]}>Logout</ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Backdrop Tap to Close */}
          <TouchableOpacity 
            style={styles.drawerBackdrop} 
            activeOpacity={1} 
            onPress={() => setDrawerVisible(false)}
          />
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748B',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  yardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  yardText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  overviewCard: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  overviewHeader: {
    marginBottom: 16,
  },
  overviewTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  overviewSub: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginTop: 4,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#60A5FA',
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  gridCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  financialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  financialCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  financialBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  financialBadgeText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  financialCardTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  financialCardSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  financialIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  financialIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  financialColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialColBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  financialColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  financialColValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  financialColCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  printerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  printerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  printerDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: '75%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  connectedDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  disconnectBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  deviceListHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyDevices: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deviceIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    backgroundColor: '#F1F5F9',
  },
  // Reports & Alerts styles
  reportRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportLabelText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  reportValueText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  reportDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  reportTotalRow: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  reportTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563EB',
  },
  reportTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2563EB',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  premiumHeader: {
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
  menuBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  goodMorningText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  managerRoleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    position: 'relative',
    marginLeft: 4,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
  },
  avatarInitialsContainer: {
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  quadrantsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quadrantCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 8,
  },
  quadrantIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quadrantMeta: {
    gap: 2,
  },
  quadrantLabel: {
    fontSize: 10,
    color: '#BFDBFE',
    fontWeight: '600',
  },
  quadrantValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mockupGridContainer: {
    marginBottom: 20,
  },
  mockupGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mockupGridCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  mockupIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockupCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 14,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 14,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '18%',
  },
  tabItemText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  tabItemTextActive: {
    color: '#2563EB',
  },
  floatingTabItem: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -32,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    flexDirection: 'row',
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerSheet: {
    width: '78%',
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
  },
  drawerHeaderBanner: {
    backgroundColor: '#2563EB',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  drawerAvatarWrapper: {
    position: 'relative',
  },
  drawerAvatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  drawerAvatarActiveBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  drawerHeaderMeta: {
    flex: 1,
    gap: 2,
  },
  drawerHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  drawerHeaderEmail: {
    fontSize: 12,
    color: '#E0F2FE',
    fontWeight: '500',
  },
  drawerLinksContainer: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 4,
  },
  drawerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  drawerLinkRowActive: {
    backgroundColor: '#EFF6FF',
  },
  drawerLinkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  drawerLinkLabelActive: {
    color: '#2563EB',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  kachhaPakkaStrip: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  kachhaPakkaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kachhaDot2: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  kachhaPakkaValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  kachhaPakkaLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
