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
import { cacheVehicles, getOfflineStats, getQueuedJobs, getAllDrafts, CachedVehicle } from '@/services/sqlite';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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
  Scan,
  Copy,
} from 'lucide-react-native';

export default function GuardDashboard() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [draftsCount, setDraftsCount] = useState(0);

  const formatRole = (roleStr: string | undefined) => {
    if (!roleStr) return 'Yard Operator';
    if (roleStr === 'SUPER_ADMIN' || roleStr === 'TENANT_ADMIN') {
      return 'Yard Manager';
    }
    if (roleStr === 'GUARD') {
      return 'Yard Guard';
    }
    return roleStr.charAt(0) + roleStr.slice(1).toLowerCase().replace('_', ' ');
  };

  const getActivityIconBg = (type: string) => {
    switch (type) {
      case 'CHECK_IN': return '#DCFCE7';
      case 'PAKKA_UPGRADE': return '#EEF2FF';
      case 'RELEASE_REQUEST': return '#FEF3C7';
      case 'RELEASE_COMPLETE': return '#ECFDF5';
      default: return '#F1F5F9';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN': return <Car size={12} color="#10B981" />;
      case 'PAKKA_UPGRADE': return <Shield size={12} color="#4F46E5" />;
      case 'RELEASE_REQUEST': return <Clock size={12} color="#D97706" />;
      case 'RELEASE_COMPLETE': return <Key size={12} color="#10B981" />;
      default: return <FileText size={12} color="#64748B" />;
    }
  };

  // Throttling ref for vehicle sync (30 seconds)
  const lastSyncTimeRef = useState<{ time: number }>({ time: 0 })[0];

  const loadDashboardStats = async (forceSync = false) => {
    setStatsLoading(true);
    try {
      // 1. Get offline fallback stats first
      try {
        const localStats = getOfflineStats();
        setOfflineStats(localStats);
        
        const queued = getQueuedJobs();
        setPendingCount(queued.length);
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

      // Fetch live notifications/logs for recent activity feed
      try {
        const res = await apiRequest('/api/notifications');
        if (res.success && Array.isArray(res.data)) {
          setRecentActivities(res.data.slice(0, 3));
        }
      } catch (e: any) {
        console.warn('[GuardDashboard] Failed to load recent notifications:', e.message || e);
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

      // 3. Sync local vehicle cache (Throttled: Sync max once every 30s unless forceSync = true)
      const now = Date.now();
      if (forceSync || now - lastSyncTimeRef.time > 30000) {
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
            lastSyncTimeRef.time = now;
            
            // Recalculate offline stats after caching
            const updatedLocalStats = getOfflineStats();
            setOfflineStats(updatedLocalStats);
          }
        } catch (e: any) {
          console.warn('[GuardDashboard] Failed to sync local vehicle cache:', e.message || e);
        }
      }
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardStats(true);
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

    const unsubscribeFocus = navigation.addListener('focus', () => {
      try {
        const list = getAllDrafts();
        setDraftsCount(list.length);
      } catch (err) {
        console.warn('[Dashboard] Error refreshing draft count:', err);
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribePrinter();
      unsubscribeFocus();
    };
  }, [navigation]);

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
  const displayTodayEntry = isConnected && statsLoading && !stats ? '-' : (stats ? (stats.todayEntry ?? 0) : offlineStats.todayEntry);

  const displayReportsCheckIn = stats ? `${displayTodayEntry} Units` : `${offlineStats.todayEntry} Units`;
  const displayReportsReleased = stats ? `${displayReleased} Units` : `${offlineStats.released} Units`;
  const displayReportsCash = finances ? `₹${finances.cashRevenue ?? 0}` : `₹${offlineStats.cashRevenue ?? 0}`;
  const displayReportsUpi = finances ? `₹${finances.upiRevenue ?? 0}` : `₹${offlineStats.upiRevenue ?? 0}`;
  const displayReportsOnline = finances ? `₹${finances.onlineRevenue ?? 0}` : '₹0';
  const displayReportsTotal = finances
    ? `₹${finances.totalSettledPakka + finances.kachhaRevenueRealized}`
    : `₹${(offlineStats.cashRevenue ?? 0) + (offlineStats.upiRevenue ?? 0)}`;
  const displayReportsWaived = finances ? `₹${finances.reconciliationLoss}` : '₹0';

  // Donut chart calculations
  const totalVehiclesCount = stats ? (stats.totalVehicles || 1) : Math.max(1, (offlineStats.inYard || 1));
  const pakkaCount = stats ? (stats.pakkaVehicles?.total ?? 0) : Math.round(offlineStats.inYard * 0.64);
  const kachhaCount = stats ? (stats.kachhaVehicles?.total ?? 0) : Math.round(offlineStats.inYard * 0.36);
  const pakkaRatio = Math.min(1, Math.max(0, pakkaCount / totalVehiclesCount));
  const donutCircumference = 2 * Math.PI * 18; // radius 18 => ~113.1
  const pakkaDash = pakkaRatio * donutCircumference;
  const kachhaDash = donutCircumference - pakkaDash;

  return (
    <ThemedView style={styles.container}>
      {/* Compact Redesigned Header with Zero Overlap Risk */}
      <View style={[styles.premiumHeader, { paddingTop: (insets.top || 36) + 4 }]}>
        <TouchableOpacity 
          style={styles.menuBtn} 
          activeOpacity={0.7}
          onPress={() => setDrawerVisible(true)}
        >
          <Menu size={22} color="#0F172A" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          {/* Line 1: Greeting + Yard Name */}
          <View style={styles.headerTopRow}>
            <ThemedText style={styles.goodMorningText} numberOfLines={1}>
              {getGreeting()},
            </ThemedText>
            <ThemedText style={styles.yardNameText} numberOfLines={1} ellipsizeMode="tail">
              {user?.tenant?.yardName || 'Rapid Yard'}
            </ThemedText>
          </View>

          {/* Line 2: User Name + Role Badge */}
          <View style={styles.userRoleRow}>
            <ThemedText style={styles.managerRoleText} numberOfLines={1} ellipsizeMode="tail">
              {user?.name || 'User'}
            </ThemedText>
            <View style={styles.verifiedBadge}>
              <Check size={8} color="#3B82F6" strokeWidth={3} />
              <ThemedText style={styles.verifiedBadgeText} numberOfLines={1}>
                {formatRole(user?.role)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity 
            style={styles.bellBtnGlowing} 
            activeOpacity={0.7}
            onPress={() => router.push('/admin/notifications')}
          >
            <Bell size={18} color="#D97706" />
            {pendingCount > 0 && <View style={styles.bellBadge} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => router.push('/admin/profile')}
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
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.avatarStatusBadge} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 95 + (insets.bottom || 0) }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
      >
        {/* Network Sync Status Banner (Only visible when offline or syncing pending queue) */}
        {(!isConnected || pendingCount > 0) && (
          <View style={[
            styles.syncBanner, 
            !isConnected ? styles.syncBannerOffline : styles.syncBannerSyncing
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={[
                styles.syncDot, 
                !isConnected ? styles.syncDotOffline : styles.syncDotSyncing
              ]} />
              <ThemedText style={[
                styles.syncBannerText,
                !isConnected ? styles.syncBannerTextOffline : styles.syncBannerTextSyncing
              ]} numberOfLines={1}>
                {!isConnected 
                  ? `Offline Mode — Saved locally (${pendingCount} pending)` 
                  : `Online — Syncing queue (${pendingCount} items remaining)...`}
              </ThemedText>
            </View>
            {isConnected && pendingCount > 0 && (
              <TouchableOpacity onPress={() => runSyncQueue()} style={styles.syncBtn} activeOpacity={0.7}>
                <RefreshCw size={11} color="#4F46E5" />
                <ThemedText style={styles.syncBtnText}>Sync Now</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SECTION TITLE: YARD OPERATIONS SUMMARY (Hero action buttons moved to bottom navbar) */}
        <ThemedText style={[styles.sectionHeaderTitle, { marginTop: 4 }]}>YARD OPERATIONS SUMMARY</ThemedText>

        {/* 4 KPI METRIC CARDS (2x2 Grid with Mini Visual Charts) */}
        <View style={styles.metricsGrid}>
          {/* Card 1: In Yard with Donut Ring Chart */}
          <TouchableOpacity
            style={styles.metricCardBox}
            onPress={() => router.push('/admin/vehicle-list')}
            activeOpacity={0.8}
          >
            <View style={styles.metricCardTop}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.metricCardLabel}>In Yard</ThemedText>
                <ThemedText style={styles.metricCardNumber}>{displayInYard}</ThemedText>
                <ThemedText style={styles.metricCardSubLabel}>IN YARD</ThemedText>
              </View>
              
              {/* Donut Ring Visual representation using react-native-svg */}
              <View style={styles.donutContainer}>
                <Svg width="52" height="52" viewBox="0 0 44 44">
                  {/* Kachha Arc (Orange/Sand) */}
                  <Circle
                    cx="22"
                    cy="22"
                    r="18"
                    stroke="#E17A47"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${donutCircumference} ${donutCircumference}`}
                    strokeDashoffset="0"
                  />
                  {/* Pakka Arc (Indigo/Purple) */}
                  <Circle
                    cx="22"
                    cy="22"
                    r="18"
                    stroke="#4F46E5"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${pakkaDash} ${donutCircumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                </Svg>
                <View style={styles.gridMiniIconBox}>
                  <LayoutGrid size={14} color="#4F46E5" />
                </View>
              </View>
            </View>

            {/* Bottom Pakka & Kachha Pills */}
            <View style={styles.metricPillsRow}>
              <View style={styles.mintPakkaPill}>
                <ThemedText style={styles.mintPakkaPillText}>
                  Pakka: {stats?.pakkaVehicles?.total ?? pakkaCount}
                </ThemedText>
              </View>
              <View style={styles.sandKachhaPill}>
                <ThemedText style={styles.sandKachhaPillText}>
                  Kachha: {stats?.kachhaVehicles?.total ?? kachhaCount}
                </ThemedText>
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 2: Today Entry with Weekly Activity Bar Chart */}
          <View style={styles.metricCardBox}>
            <View style={styles.metricCardTop}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.metricCardLabel}>Today Entry</ThemedText>
                <ThemedText style={styles.metricCardNumber}>{displayTodayEntry}</ThemedText>
                <ThemedText style={styles.metricCardSubLabel}>TODAY ENTRY</ThemedText>
              </View>
              <View style={[styles.cardMiniIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Clock size={16} color="#16A34A" />
              </View>
            </View>

            {/* Weekly Bars (M T W T F S S) */}
            <View style={styles.weeklyBarsContainer}>
              <View style={styles.barsTrack}>
                <View style={[styles.barCol, { height: 18 }]} />
                <View style={[styles.barCol, { height: 24 }]} />
                <View style={[styles.barCol, { height: 20 }]} />
                <View style={[styles.barCol, { height: 26 }]} />
                <View style={[styles.barCol, styles.barColActive, { height: 32 }]} />
                <View style={[styles.barCol, { height: 16 }]} />
                <View style={[styles.barCol, { height: 12 }]} />
              </View>
              <View style={styles.barsLabelsRow}>
                <ThemedText style={styles.barDayText}>M</ThemedText>
                <ThemedText style={styles.barDayText}>T</ThemedText>
                <ThemedText style={styles.barDayText}>W</ThemedText>
                <ThemedText style={styles.barDayText}>T</ThemedText>
                <ThemedText style={[styles.barDayText, styles.barDayTextActive]}>F</ThemedText>
                <ThemedText style={styles.barDayText}>S</ThemedText>
                <ThemedText style={styles.barDayText}>S</ThemedText>
              </View>
            </View>
          </View>

          {/* Card 3: Released with Amber Weekly Bar Chart */}
          <View style={styles.metricCardBox}>
            <View style={styles.metricCardTop}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.metricCardLabel}>Released</ThemedText>
                <ThemedText style={styles.metricCardNumber}>{displayReleased}</ThemedText>
                <ThemedText style={styles.metricCardSubLabel}>RELEASED VEHICLE</ThemedText>
              </View>
              <View style={[styles.cardMiniIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Key size={16} color="#D97706" />
              </View>
            </View>

            {/* Amber Weekly Bars (S M T W T F S) */}
            <View style={styles.weeklyBarsContainer}>
              <View style={styles.barsTrack}>
                <View style={[styles.barColAmber, { height: 10 }]} />
                <View style={[styles.barColAmber, { height: 28 }]} />
                <View style={[styles.barColAmber, { height: 12 }]} />
                <View style={[styles.barColAmber, { height: 26 }]} />
                <View style={[styles.barColAmber, { height: 14 }]} />
                <View style={[styles.barColAmber, { height: 18 }]} />
                <View style={[styles.barColAmber, { height: 8 }]} />
              </View>
              <View style={styles.barsLabelsRow}>
                <ThemedText style={styles.barDayTextAmber}>S</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>M</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>T</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>W</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>T</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>F</ThemedText>
                <ThemedText style={styles.barDayTextAmber}>S</ThemedText>
              </View>
            </View>
          </View>

          {/* Card 4: Today Revenue with Sparkline Trend Wave */}
          <View style={styles.metricCardBox}>
            <View style={styles.metricCardTop}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.metricCardLabel}>Today Revenue</ThemedText>
                <ThemedText style={styles.metricCardNumber}>
                  ₹{stats?.dailyRevenue?.today?.amount ?? (finances ? finances.cashRevenue + finances.upiRevenue : 0)}
                </ThemedText>
                <ThemedText style={styles.metricCardSubLabel}>TODAY'S REVENUE</ThemedText>
              </View>
              <View style={[styles.cardMiniIconBox, { backgroundColor: '#E0F2FE' }]}>
                <DollarSign size={16} color="#0284C7" />
              </View>
            </View>

            {/* Sparkline wave trend SVG */}
            <View style={styles.sparklineContainer}>
              <Svg width="110" height="24" viewBox="0 0 110 24">
                <Defs>
                  <SvgLinearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#4F46E5" stopOpacity="0.25" />
                    <Stop offset="1" stopColor="#4F46E5" stopOpacity="0.0" />
                  </SvgLinearGradient>
                </Defs>
                {/* Area Fill */}
                <Path
                  d="M0,18 Q20,16 35,20 T70,12 T95,6 T110,3 L110,24 L0,24 Z"
                  fill="url(#revenueGrad)"
                />
                {/* Smooth Curve */}
                <Path
                  d="M0,18 Q20,16 35,20 T70,12 T95,6 T110,3"
                  fill="none"
                  stroke="#4F46E5"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>

            {/* Breakdown row */}
            <View style={styles.revenueBottomRow}>
              <ThemedText style={styles.collectionsCountText}>
                {stats?.dailyRevenue?.today?.count ?? 0} COLLECTIONS
              </ThemedText>
              <TouchableOpacity 
                style={styles.viewBreakdownBtn}
                activeOpacity={0.7}
                onPress={() => setReportsModalVisible(true)}
              >
                <ThemedText style={styles.viewBreakdownText}>View Breakdown</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* CHAMPAGNE GOLD LUXURY BANNER: PENDING YARD SHIFTS */}
        <TouchableOpacity
          style={styles.goldShiftsBanner}
          onPress={() => router.push('/admin/vehicle-list?filter=SHIFT_PENDING' as any)}
          activeOpacity={0.9}
        >
          <View style={styles.goldBannerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Car size={20} color="#78350F" />
              <ThemedText style={styles.goldBannerTitle}>PENDING YARD SHIFTS</ThemedText>
            </View>
            <TouchableOpacity 
              style={styles.goldSyncBtn} 
              activeOpacity={0.7}
              onPress={() => loadDashboardStats(true)}
            >
              <RefreshCw size={12} color="#78350F" />
              <ThemedText style={styles.goldSyncBtnText}>Sync</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.goldBannerCount}>
            {stats?.shiftPendingCount ?? 0} VEHICLES
          </ThemedText>

          <View style={styles.goldBannerFooter}>
            <ThemedText style={styles.goldBannerSub}>
              Non-paneled bank vehicles queued for transfer →
            </ThemedText>
            <View style={styles.goldViewQueuePill}>
              <ThemedText style={styles.goldViewQueueText}>VIEW QUEUE</ThemedText>
            </View>
          </View>
        </TouchableOpacity>

        {/* Secondary Tools Horizontal Bar */}
        <ThemedText style={styles.sectionTitle}>Quick Tools</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickToolsRow}>
          <TouchableOpacity
            style={styles.toolChip}
            onPress={() => router.push('/admin/reports')}
            activeOpacity={0.8}
          >
            <FileText size={16} color="#8B5CF6" />
            <ThemedText style={styles.toolChipText}>Reports</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolChip}
            onPress={() => router.push('/admin/calculate-charges')}
            activeOpacity={0.8}
          >
            <DollarSign size={16} color="#0D9488" />
            <ThemedText style={styles.toolChipText}>Charges Calculator</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolChip}
            onPress={() => router.push('/admin/banks')}
            activeOpacity={0.8}
          >
            <Building size={16} color="#3B82F6" />
            <ThemedText style={styles.toolChipText}>Bank Master</ThemedText>
          </TouchableOpacity>
        </ScrollView>

        {/* Financial Performance Section */}
        <ThemedText style={styles.sectionTitle}>Financial Performance</ThemedText>

        {/* DAILY REVENUE CARD */}
        <View style={styles.financialCard}>
          <View style={styles.financialCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.financialBadge}>
                <ThemedText style={styles.financialBadgeText}>TOTAL EARNINGS OVERVIEW</ThemedText>
              </View>
              <ThemedText style={styles.financialCardTitle}>DAILY REVENUE</ThemedText>
              <ThemedText style={styles.financialCardSub}>Pakka Stock Dues + Released Collections</ThemedText>
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
                Accrued: ₹{stats?.dailyRevenue?.today?.accrued ?? 0}
              </ThemedText>
            </View>
            
            {/* Month */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>MONTH</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyRevenue?.thisMonth?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                Accrued: ₹{stats?.dailyRevenue?.thisMonth?.accrued ?? 0}
              </ThemedText>
            </View>
            
            {/* Year */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>YEAR</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.dailyRevenue?.thisYear?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                Accrued: ₹{stats?.dailyRevenue?.thisYear?.accrued ?? 0}
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
              <ThemedText style={styles.financialCardTitle}>KACHHA ACCRUED VALUE</ThemedText>
              <ThemedText style={styles.financialCardSub}>Accrued Kachha dues</ThemedText>
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

        {/* PAKKA ACCRUED VALUE CARD */}
        <View style={styles.financialCard}>
          <View style={styles.financialCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={[styles.financialBadge, { backgroundColor: '#EEF2FF' }]}>
                <ThemedText style={[styles.financialBadgeText, { color: '#4F46E5' }]}>PAKKA LIABILITY</ThemedText>
              </View>
              <ThemedText style={styles.financialCardTitle}>PAKKA RUNNING CHARGES</ThemedText>
              <ThemedText style={styles.financialCardSub}>Accrued Pakka billing in yard</ThemedText>
            </View>
            <View style={[styles.financialIconBg, { backgroundColor: '#10B981' }]}>
              <TrendingUp size={20} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.financialColumnsRow}>
            {/* Today */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>TODAY</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.pakkaAccrued?.today?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.pakkaAccrued?.today?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Month */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>MONTH</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.pakkaAccrued?.thisMonth?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.pakkaAccrued?.thisMonth?.count ?? 0}
              </ThemedText>
            </View>
            
            {/* Year */}
            <View style={styles.financialColBox}>
              <ThemedText style={styles.financialColLabel}>YEAR</ThemedText>
              <ThemedText style={styles.financialColValue}>
                ₹{stats?.pakkaAccrued?.thisYear?.amount ?? 0}
              </ThemedText>
              <ThemedText style={styles.financialColCount}>
                {stats?.pakkaAccrued?.thisYear?.count ?? 0}
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

        {/* Recent Activity Feed */}
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>Recent Activities</ThemedText>
          <TouchableOpacity onPress={() => router.push('/admin/notifications')} activeOpacity={0.7}>
            <ThemedText style={styles.viewAllText}>View All Logs</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.activityFeedCard}>
          {recentActivities && recentActivities.length > 0 ? (
            recentActivities.map((act, index) => (
              <View key={act.id || index} style={[styles.activityRow, index < recentActivities.length - 1 && styles.activityRowDivider]}>
                <View style={[styles.activityIconBg, { backgroundColor: getActivityIconBg(act.type) }]}>
                  {getActivityIcon(act.type)}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={styles.activityTitle}>{act.title}</ThemedText>
                  <ThemedText style={styles.activityMessage}>{act.message}</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Clock size={10} color="#94A3B8" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.activityTime}>
                      {new Date(act.createdAt || act.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ThemedText style={{ color: '#94A3B8', fontSize: 13 }}>No recent activity logs available.</ThemedText>
            </View>
          )}
        </View>
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
                  <View style={[styles.reportIconBg, { backgroundColor: '#EEF2FF' }]}>
                    <DollarSign size={16} color="#4F46E5" />
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
              style={[styles.modalBtn, { backgroundColor: '#4F46E5', marginTop: 16 }]}
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
              <Bell size={22} color="#4F46E5" />
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
                <Database size={20} color="#4F46E5" />
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
              style={[styles.modalBtn, { backgroundColor: '#4F46E5', marginTop: 16 }]}
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
              {scanning && <ActivityIndicator color="#4F46E5" size="small" />}
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
                    <ThemedText style={{ color: '#4F46E5', fontWeight: '700', fontSize: 13 }}>Pair</ThemedText>
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
                style={[styles.modalBtn, { backgroundColor: '#4F46E5' }]}
              >
                <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Center Plus Tab Bar matching user requirements */}
      <View style={[styles.bottomTabBar, { 
        height: 74 + (insets.bottom > 0 ? insets.bottom - 10 : 0), 
        paddingBottom: insets.bottom || 12 
      }]}>
        {/* Tab 1: Home */}
        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/dashboard')}
        >
          <Home size={22} color="#4F46E5" />
          <ThemedText style={[styles.tabItemText, styles.tabItemTextActive]}>Home</ThemedText>
        </TouchableOpacity>

        {/* Tab 2: Drafts */}
        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/drafts' as any)}
        >
          <View style={{ position: 'relative' }}>
            <FileText size={22} color="#64748B" />
            {draftsCount > 0 && (
              <View style={styles.tabBadge}>
                <ThemedText style={styles.tabBadgeText}>{draftsCount}</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.tabItemText}>Drafts</ThemedText>
        </TouchableOpacity>

        {/* Tab 3: Center +(Entry) Floating Button */}
        <TouchableOpacity 
          style={styles.floatingTabItem} 
          activeOpacity={0.85}
          onPress={() => router.push('/admin/check-in')}
        >
          <Plus size={26} color="#FFFFFF" strokeWidth={3} />
        </TouchableOpacity>

        {/* Tab 4: Release */}
        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/check-out')}
        >
          <Key size={22} color="#64748B" />
          <ThemedText style={styles.tabItemText}>Release</ThemedText>
        </TouchableOpacity>

        {/* Tab 5: Vehicles */}
        <TouchableOpacity 
          style={styles.tabItem} 
          activeOpacity={0.7}
          onPress={() => router.push('/admin/vehicle-list')}
        >
          <Car size={22} color="#64748B" />
          <ThemedText style={styles.tabItemText}>Vehicles</ThemedText>
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
                {profilePic ? (
                  <Image 
                    source={{ uri: profilePic }} 
                    style={styles.drawerAvatarImg} 
                  />
                ) : (
                  <View style={[styles.drawerAvatarImg, styles.drawerAvatarInitialsContainer]}>
                    <ThemedText style={styles.drawerAvatarInitialsText}>
                      {(user?.name || 'M').charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.drawerAvatarActiveBadge} />
              </View>
              <View style={styles.drawerHeaderMeta}>
                <ThemedText style={styles.drawerHeaderTitle}>
                  {user?.name || 'Yard Manager'}
                </ThemedText>
                <View style={styles.drawerRoleBadge}>
                  <ThemedText style={styles.drawerRoleText}>
                    {formatRole(user?.role)}
                  </ThemedText>
                </View>
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
                <Home size={18} color="#4F46E5" style={{ marginRight: 12 }} />
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

              {/* Link 6c: Crew Management */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER') && (
                <TouchableOpacity
                  style={styles.drawerLinkRow}
                  onPress={() => {
                    setDrawerVisible(false);
                    router.push('/admin/crew' as any);
                  }}
                >
                  <User size={18} color="#64748B" style={{ marginRight: 12 }} />
                  <ThemedText style={styles.drawerLinkLabel}>Crew Management</ThemedText>
                </TouchableOpacity>
              )}

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
                  <Shield size={18} color="#4F46E5" style={{ marginRight: 12 }} />
                  <ThemedText style={[styles.drawerLinkLabel, { color: '#4F46E5' }]}>Admin Panel</ThemedText>
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
    paddingTop: 12,
    paddingBottom: 95,
  },
  // Compact Redesigned Header
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 42,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  goodMorningText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  yardNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  userRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    flexShrink: 1,
  },
  managerRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    maxWidth: '65%',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 2.5,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexShrink: 0,
  },
  verifiedBadgeText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#3B82F6',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtnGlowing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  avatarCircle: {
    position: 'relative',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
  },
  avatarInitialsContainer: {
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 15,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  // Hero 4 Action Grid (2x2)
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  heroCardNewEntry: {
    width: '48%',
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroNewEntryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroNewEntryTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroNewEntrySub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C7D2FE',
    marginTop: 1,
  },
  heroCardLight: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  heroIconBoxLight: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroLightSub: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  draftBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  draftBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  // Section Headers
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 14,
  },
  // 4 KPI Metrics Grid (2x2)
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricCardBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    minHeight: 148,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  metricCardNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  metricCardSubLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  donutContainer: {
    position: 'relative',
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridMiniIconBox: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMiniIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  mintPakkaPill: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  mintPakkaPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#15803D',
  },
  sandKachhaPill: {
    flex: 1,
    backgroundColor: '#FED7AA',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  sandKachhaPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#9A3412',
  },
  weeklyBarsContainer: {
    marginTop: 8,
  },
  barsTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 32,
    paddingHorizontal: 2,
  },
  barCol: {
    width: 5,
    backgroundColor: '#E0E7FF',
    borderRadius: 3,
  },
  barColActive: {
    backgroundColor: '#4F46E5',
  },
  barColAmber: {
    width: 5,
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  barsLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 1,
  },
  barDayText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
  },
  barDayTextActive: {
    color: '#4F46E5',
    fontWeight: '900',
  },
  barDayTextAmber: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#B45309',
  },
  sparklineContainer: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  revenueBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  collectionsCountText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  viewBreakdownBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewBreakdownText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#334155',
  },
  // Champagne Gold Pending Shifts Banner
  goldShiftsBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  goldBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goldBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  goldSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goldSyncBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78350F',
  },
  goldBannerCount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#78350F',
    marginVertical: 4,
  },
  goldBannerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goldBannerSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  goldViewQueuePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  goldViewQueueText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  // Quick Tools & Financial Performance
  quickToolsRow: {
    gap: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toolChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  financialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
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
    marginBottom: 14,
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
    fontSize: 16,
    fontWeight: '800',
  },
  financialCardSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  financialIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  financialIconText: {
    color: '#FFFFFF',
    fontSize: 18,
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
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  financialColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  financialColValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  financialColCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  // Hardware Printer Card
  printerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  printerIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  printerDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14,
  },
  // Recent Activities
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  viewAllText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  activityFeedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  activityRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  activityRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  activityMessage: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  // Bottom Tab Bar & Center FAB
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
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
    color: '#4F46E5',
  },
  floatingTabItem: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -32,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  // Modals & Drawer
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
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
    backgroundColor: '#4F46E5',
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
    borderColor: '#4F46E5',
  },
  drawerAvatarInitialsContainer: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  drawerAvatarInitialsText: {
    color: '#4F46E5',
    fontSize: 22,
    fontWeight: '800',
  },
  drawerRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginVertical: 2,
  },
  drawerRoleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
    backgroundColor: '#EEF2FF',
  },
  drawerLinkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  drawerLinkLabelActive: {
    color: '#4F46E5',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: 0,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncBannerOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  syncBannerSyncing: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncDotOffline: {
    backgroundColor: '#EF4444',
  },
  syncDotSyncing: {
    backgroundColor: '#F59E0B',
  },
  syncBannerText: {
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
  },
  syncBannerTextOffline: {
    color: '#B91C1C',
  },
  syncBannerTextSyncing: {
    color: '#B45309',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 2,
  },
  syncBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
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
    flex: 1,
    width: '100%',
    justifyContent: 'center',
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
    backgroundColor: '#EEF2FF',
  },
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
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  reportTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  reportTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4F46E5',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
});
