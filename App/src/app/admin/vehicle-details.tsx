import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Image,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { apiRequest, getUserInfo, UserSession } from '@/services/api';
import { bluetoothService } from '@/services/bluetooth';
import { getCachedVehicleById } from '@/services/sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { getParkingDailyRate } from '@/constants/rates';
import {
  ChevronLeft,
  MoreVertical,
  Camera,
  Calculator,
  Key,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Car,
  Clock,
  Printer,
  Share2,
  Trash2,
  FileText,
  Pencil,
  ChevronDown,
  Building,
  User,
  Phone,
  Shield,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// ----------------------------------------------------------------------
// Skeleton Loading Placeholder Component
// ----------------------------------------------------------------------
function VehicleDetailsSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHeaderCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonMeta}>
          <View style={[styles.skeletonLine, { width: '70%', height: 26 }]} />
          <View style={[styles.skeletonLine, { width: '50%', height: 16, marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '40%', height: 14, marginTop: 6 }]} />
        </View>
      </View>
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
        <View style={styles.skeletonGridBox} />
      </View>
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </View>
  );
}

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [calcVisible, setCalcVisible] = useState(false);
  const [photosVisible, setPhotosVisible] = useState(false);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [photoFilterTab, setPhotoFilterTab] = useState<'all' | 'images' | 'pdfs'>('all');

  // Custom Calculator States
  const [calcDays, setCalcDays] = useState('30');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // Collapsible Accordion Sections State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,       // Default open
    vehicleDetails: false,
    repoDetails: false,
    checklist: false,
    billing: false,
    photos: false,
    advanced: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Navigation state
  const navigation = useNavigation();

  // Photo Sharing & Viewer States
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [parkingCalculation, setParkingCalculation] = useState<any | null>(null);

  // Fetch Vehicle Details
  const fetchVehicleDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        const res = await apiRequest(`/api/vehicles/${id}`);
        if (res.success && res.data) {
          setVehicle(res.data);

          try {
            const calcRes = await apiRequest(`/api/vehicles/${id}/parking-calculation`);
            if (calcRes.success && calcRes.data) {
              setParkingCalculation(calcRes.data);
            }
          } catch (calcErr) {
            console.warn('[VehicleDetails] Failed to fetch parking calculation:', calcErr);
          }

          try {
            const billRes = await apiRequest(`/api/billing/${id}`);
            if (billRes.success && billRes.data) {
              setBilling(billRes.data);
            }
          } catch (billingErr) {
            console.warn('[VehicleDetails] Failed to fetch live billing:', billingErr);
          }
        } else {
          setError('Could not retrieve vehicle information.');
        }
      } else {
        const cached = getCachedVehicleById(id as string);
        if (cached) {
          setVehicle(cached as any);
          setBilling({
            vehicleId: cached.id,
            dailyRate: getParkingDailyRate(cached as any),
            totalDays: 0,
            totalAmount: 0,
            paidAmount: 0,
            paymentStatus: 'PENDING',
            billingStartDate: cached.entryDate,
          } as any);
        } else {
          setError('Offline mode. Vehicle details not found in cache.');
        }
      }
    } catch (err: any) {
      console.error('[VehicleDetails] Error fetching:', err);
      setError(err.message || 'Server connection failed.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      const info = await getUserInfo();
      setCurrentUser(info);
      fetchVehicleDetails();
    };
    init();
  }, [id]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchVehicleDetails();
    });
    return unsubscribeFocus;
  }, [navigation, fetchVehicleDetails]);

  // Billing calculation helpers
  const getDailyRate = () => {
    if (billing?.dailyRate) return billing.dailyRate;
    return getParkingDailyRate(vehicle);
  };

  const getDurationDays = () => {
    if (billing?.totalDays) return billing.totalDays;
    if (!vehicle?.entryDate) return 1;
    const entryDate = new Date(vehicle.entryDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const getTotalCharges = () => {
    if (billing?.totalAmount) return billing.totalAmount;
    return getDurationDays() * getDailyRate();
  };

  // Run Calculator
  const handleCalculate = () => {
    const days = parseInt(calcDays);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days');
      return;
    }
    setCalcResult(days * getDailyRate());
  };

  // Downloads & shares single photo
  const handleSharePhoto = async (url: string) => {
    try {
      setSharingInProgress(true);
      const fileExtension = url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `Vehicle_Inspection_${Date.now()}.${fileExtension}`;
      const localUri = `${documentDirectory}${fileName}`;

      const downloadResult = await downloadAsync(url, localUri);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
          dialogTitle: 'Share / Save Vehicle Photo',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (error: any) {
      console.error('[VehicleDetails] Error sharing photo:', error);
      Alert.alert('Share Error', error.message || 'Could not download and share photo.');
    } finally {
      setSharingInProgress(false);
    }
  };

  // Downloads and shares multiple photos sequentially
  const handleShareBatchPhotos = async (urls: string[]) => {
    if (urls.length === 0) {
      Alert.alert('No Photos', 'Please select at least one photo to share.');
      return;
    }

    try {
      setSharingInProgress(true);
      Alert.alert(
        'Downloading Photos',
        `Preparing ${urls.length} photo(s). You will be prompted to share them one by one.`,
        [{ text: 'Proceed', style: 'default' }]
      );

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const fileExtension = url.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `Vehicle_Inspection_${i + 1}_${Date.now()}.${fileExtension}`;
        const localUri = `${documentDirectory}${fileName}`;

        const downloadResult = await downloadAsync(url, localUri);
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
            dialogTitle: `Share Photo ${i + 1} of ${urls.length}`,
          });
        }
      }
    } catch (error: any) {
      console.error('[VehicleDetails] Batch sharing failed:', error);
      Alert.alert('Share Error', error.message || 'Failed to batch share photos.');
    } finally {
      setSharingInProgress(false);
    }
  };

  const togglePhotoSelection = (url: string) => {
    setSelectedPhotos(prev =>
      prev.includes(url) ? prev.filter(p => p !== url) : [...prev, url]
    );
  };

  // Base64 helper for PDF reports
  const uriToBase64 = async (uri: string): Promise<string> => {
    try {
      if (uri.startsWith('http')) {
        const fileExtension = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const filename = `temp_img_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const localUri = `${FileSystem.cacheDirectory}${filename}`;
        const downloadResult = await FileSystem.downloadAsync(uri, localUri);
        const base64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return `data:image/jpeg;base64,${base64}`;
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (err) {
      console.warn('Error converting URI to base64:', err);
      return uri;
    }
  };

  const generateHTMLReport = async () => {
    const photoElements = await Promise.all(
      (vehicle?.photos || []).map(async (p: any) => {
        const base64 = await uriToBase64(p.s3Url);
        return `
          <div style="width: 31.3%; margin: 1%; text-align: center; border: 1px solid #cbd5e1; padding: 4px; border-radius: 6px; box-sizing: border-box; background-color: #f1f5f9; page-break-inside: avoid;">
            <p style="margin: 0 0 4px 0; font-size: 8px; font-weight: bold; text-transform: uppercase; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.photoType.replace('_', ' ')}</p>
            <img src="${base64}" style="width: 100%; height: 100px; object-fit: contain; background-color: #e2e8f0; border-radius: 4px;" />
          </div>
        `;
      })
    );

    let checklistRows = '';
    const activeInventory = vehicle?.inventory || [];
    for (let i = 0; i < activeInventory.length; i += 2) {
      const item1 = activeInventory[i];
      const item2 = activeInventory[i + 1];

      const renderCell = (item: any) => {
        if (!item) return '<td style="border: 1px solid #cbd5e1; width: 50%;"></td>';

        const ignoreList = ['Body Condition', 'Yard Remarks', 'Customer Remarks'];
        if (ignoreList.includes(item.itemName)) {
          return '<td style="border: 1px solid #cbd5e1; width: 50%;"></td>';
        }

        let details = '';
        if (item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre') {
          const match = item.remarks?.match(/\(Tyre Make:\s*(.*?)\)/i);
          const make = match ? match[1]?.trim() : '';
          details = make ? ` (${make})` : '';
        }

        const isPresentBadge = item.isPresent
          ? '<span style="background-color: #def7ec; color: #03543f; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 9px; text-transform: uppercase;">YES</span>'
          : '<span style="background-color: #fde8e8; color: #9b1c1c; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 9px; text-transform: uppercase;">NO</span>';

        const cleanRemarks = item.remarks && (item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre')
          ? item.remarks.replace(/\s*\(Tyre Make:\s*.*?\)/i, '').trim()
          : item.remarks || '';

        return `
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; width: 50%; color: #0f172a; line-height: 1.3;">
            <span style="font-weight: 700; color: #334155;">${item.itemName}${details}:</span> ${isPresentBadge} ${cleanRemarks ? `<span style="font-size: 10px; color: #64748b; font-style: italic;">[${cleanRemarks}]</span>` : ''}
          </td>
        `;
      };

      checklistRows += `
        <tr>
          ${renderCell(item1)}
          ${renderCell(item2)}
        </tr>
      `;
    }

    const tenantName = vehicle?.tenant?.yardName || 'SHREE PARKING YARD';
    const tenantAddress = vehicle?.tenant?.address || 'GURUGRAM VILLAGE, HARYANA';
    const entryDateStr = vehicle?.entryDate ? new Date(vehicle.entryDate).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gate Pass Receipt - ${tenantName}</title>
        <style>
          @page { size: A4; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0; color: #0f172a; font-size: 12px; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 3px double #1e3a8a; padding-bottom: 8px; }
          .header h1 { margin: 0; font-size: 24px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.75px; font-weight: 800; }
          .header p { margin: 4px 0 0 0; font-size: 11px; color: #475569; font-weight: 600; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; background-color: #EEF2FF; padding: 5px 10px; margin: 14px 0 6px 0; border-left: 5px solid #1e3a8a; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
          td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; color: #1e293b; }
          .info-table td { width: 50%; }
          .info-table tr:nth-child(even) { background-color: #f8fafc; }
          .photos-grid { display: flex; flex-wrap: wrap; justify-content: flex-start; margin-top: 8px; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${tenantName}</h1>
          <p>${tenantAddress}</p>
          <p style="font-size: 10px; margin-top: 5px; border: 1px solid #1e3a8a; display: inline-block; padding: 3px 10px; border-radius: 4px; color: #1e3a8a; background-color: #EEF2FF; font-weight: bold; letter-spacing: 0.5px;">
            YARD POSSESSION & VEHICLE CONDITION REPORT
          </p>
        </div>

        <div class="section-title">Vehicle Specifications</div>
        <table class="info-table">
          <tr>
            <td><strong>License Plate:</strong> ${vehicle.vehicleNumber.toUpperCase()}</td>
            <td><strong>Vehicle Category:</strong> ${
              vehicle.vehicleType === 'TW'
                ? '2 Wheeler (TW)'
                : vehicle.vehicleType === 'THREE_W'
                ? '3 Wheeler (THREE_W)'
                : vehicle.vehicleType === 'FW'
                ? '4 Wheeler (FW)'
                : vehicle.vehicleType === 'CV'
                ? 'Commercial Vehicle (CV)'
                : '-'
            }</td>
          </tr>
          <tr>
            <td><strong>Brand / Maker:</strong> ${vehicle.brand || '-'}</td>
            <td><strong>Model Name:</strong> ${vehicle.model || '-'}</td>
          </tr>
          <tr>
            <td><strong>Engine Number:</strong> ${vehicle.engineNumber || '-'}</td>
            <td><strong>Chassis Number:</strong> ${vehicle.chassisNumber || '-'}</td>
          </tr>
          <tr>
            <td><strong>Entry Date & Time:</strong> ${entryDateStr}</td>
            <td><strong>Possession Place:</strong> ${parsedRepo.place || '-'}</td>
          </tr>
        </table>

        <div class="section-title">Financer & Repossession Info</div>
        <table class="info-table">
          <tr>
            <td><strong>Financer Category:</strong> ${vehicle.bank?.isThirdParty ? 'Third Party' : 'Direct Bank'}</td>
            <td><strong>Bank / Financer Name:</strong> ${vehicle.bankName || '-'}</td>
          </tr>
          <tr>
            <td><strong>Repo Agency:</strong> ${parsedRepo.agency || '-'}</td>
            <td><strong>Repo Agent Name:</strong> ${parsedRepo.agent || '-'}</td>
          </tr>
          <tr>
            <td><strong>Customer Name:</strong> ${vehicle.customerName || '-'}</td>
            <td><strong>Customer Mobile:</strong> ${vehicle.customerPhone || '-'}</td>
          </tr>
        </table>

        <div class="section-title">Accessories Checklist</div>
        <table>
          <tbody>
            ${checklistRows}
          </tbody>
        </table>

        <div class="section-title">Yard Remarks & General Condition</div>
        <table class="info-table">
          <tr>
            <td><strong>Body Condition:</strong> ${bodyCondition}</td>
            <td><strong>Yard Remarks:</strong> ${yardRemarks || 'N/A'}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Customer Remarks:</strong> ${customerRemarks || 'N/A'}</td>
          </tr>
        </table>

        ${
          photoElements.length > 0
            ? `
          <div class="section-title">Possession Photographs</div>
          <div class="photos-grid">
            ${photoElements.join('')}
          </div>
        `
            : ''
        }

        <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 10px; font-weight: bold; color: #64748b; letter-spacing: 0.5px;">
          *** THIS IS A COMPUTER SYSTEM GENERATED DOCUMENT. PHYSICAL SIGNATURE NOT REQUIRED. ***
        </div>
      </body>
      </html>
    `;
  };

  const downloadAndSharePDF = async () => {
    if (!vehicle) return;
    try {
      setLoading(true);
      const html = await generateHTMLReport();
      const { uri } = await Print.printToFileAsync({ html });

      const cleanPlate = vehicle.vehicleNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `${cleanPlate || 'vehicle'}.pdf`;
      const targetUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });

      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${vehicle.vehicleNumber.toUpperCase()} Gate Pass`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message || 'Could not generate or share PDF');
    } finally {
      setLoading(false);
    }
  };

  // Print Gate Pass Receipt
  const handlePrint = async () => {
    if (!vehicle) return;
    try {
      const payload = {
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        brand: vehicle.brand || undefined,
        model: vehicle.model || undefined,
        bankName: vehicle.bankName || undefined,
        chassisNumber: vehicle.chassisNumber || undefined,
        inventory: vehicle.inventory || [],
      };
      const text = bluetoothService.generateGatePassReceipt(payload);
      await bluetoothService.printReceipt(text);
      Alert.alert('Success', 'Receipt sent to thermal printer.');
    } catch (e: any) {
      Alert.alert('Print Error', e.message || 'Could not print gate pass');
    }
  };

  // Delete vehicle with strong confirmation
  const handleDelete = () => {
    Alert.alert(
      'Permanent Deletion Warning',
      `Are you sure you want to permanently delete vehicle ${vehicle?.vehicleNumber}? All associated records, inventory, and photos will be removed permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiRequest(`/api/vehicles/${id}`, { method: 'DELETE' });
              Alert.alert('Deleted', 'Vehicle record removed successfully.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete vehicle.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleMoreMenu = () => {
    setActionsSheetVisible(true);
  };

  // Format dates & repo data
  const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=400';
  const imagePhotos = useMemo(() => {
    return vehicle?.photos?.filter((p: any) => !p.s3Url.toLowerCase().split('?')[0].endsWith('.pdf')) || [];
  }, [vehicle]);

  const pdfPhotos = useMemo(() => {
    return vehicle?.photos?.filter((p: any) => p.s3Url.toLowerCase().split('?')[0].endsWith('.pdf')) || [];
  }, [vehicle]);

  const displayPhoto = imagePhotos.length > 0 ? imagePhotos[0].s3Url : defaultPhoto;

  const entryDateObj = vehicle?.entryDate ? new Date(vehicle.entryDate) : new Date();
  const formattedEntryDate = entryDateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parseRepoAgency = (repoAgencyStr: string | null | undefined) => {
    if (!repoAgencyStr) return { agency: 'N/A', agent: 'N/A', place: 'N/A' };
    const match = repoAgencyStr.match(/Agency:\s*(.*?)\s*\|\s*Agent:\s*(.*?)\s*\|\s*Place:\s*(.*)/i);
    if (match) {
      return {
        agency: match[1]?.trim() || 'N/A',
        agent: match[2]?.trim() || 'N/A',
        place: match[3]?.trim() || 'N/A'
      };
    }
    return {
      agency: repoAgencyStr.trim() || 'N/A',
      agent: 'N/A',
      place: 'N/A'
    };
  };

  const parsedRepo = parseRepoAgency(vehicle?.repoAgency);

  const getInventoryItem = (itemName: string) => {
    const searchName = itemName.toLowerCase() === 'battery' ? 'battry' : itemName;
    return vehicle?.inventory?.find((item: any) =>
      item.itemName.toLowerCase() === itemName.toLowerCase() ||
      item.itemName.toLowerCase() === searchName.toLowerCase()
    );
  };

  const bodyCondition = getInventoryItem('Body Condition')?.remarks || 'Average';
  const yardRemarks = getInventoryItem('Yard Remarks')?.remarks || 'N/A';
  const customerRemarks = getInventoryItem('Customer Remarks')?.remarks || 'N/A';

  const accessoryItems = [
    { key: 'RC-Original', label: 'RC Original' },
    { key: 'key', label: 'Keys' },
    { key: 'Battery', label: 'Battery' },
    { key: 'Horn', label: 'Horn' },
    { key: 'Front Tyre', label: 'Front Tyre' },
    { key: 'Back Tyre', label: 'Back Tyre' },
    { key: 'Spare Tyre', label: 'Spare Tyre' },
    { key: 'Tool Kit', label: 'Tool Kit' },
    { key: 'Side Mirror (Left)', label: 'Side Mirror (L)' },
    { key: 'Side Mirror (Right)', label: 'Side Mirror (R)' },
    { key: 'Light Front', label: 'Front Light' },
    { key: 'Light Back', label: 'Back Light' },
    { key: 'Light Indicator', label: 'Indicator Lights' },
    { key: 'Music System', label: 'Music System' },
    { key: 'Meter Running Condition', label: 'Meter Running' },
  ];

  // Accessory Checked / Missing Counts
  const accessoryCounts = useMemo(() => {
    let checked = 0;
    let missing = 0;
    accessoryItems.forEach(item => {
      const inv = getInventoryItem(item.key);
      if (inv?.isPresent) checked++;
      else missing++;
    });
    return { checked, missing };
  }, [vehicle]);

  // Loading State
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top', 'bottom']}>
        <ThemedView style={styles.container}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <ChevronLeft size={24} color="#0F172A" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Vehicle Profile</ThemedText>
            <View style={styles.iconButton} />
          </View>
          <VehicleDetailsSkeleton />
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Error State
  if (error || !vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top', 'bottom']}>
        <ThemedView style={styles.errorContainer}>
          <AlertTriangle size={48} color="#EF4444" style={{ marginBottom: 12 }} />
          <ThemedText style={styles.errorText}>{error || 'Vehicle not found.'}</ThemedText>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicleDetails}>
            <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#64748B', marginTop: 10 }]} onPress={() => router.back()}>
            <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Determine Operator Status Badge
  const getStatusBadge = () => {
    if (vehicle.shiftStatus === 'SHIFT_PENDING') {
      return { label: 'Shift Pending', bg: '#FEF3C7', color: '#B45309' };
    }
    if (vehicle.yardStatus === 'KACHHA') {
      return { label: 'Pending Verification', bg: '#FEF3C7', color: '#D97706' };
    }
    if (vehicle.yardStatus === 'RELEASED' || vehicle.status === 'RELEASED' || vehicle.status === 'CHECKED_OUT') {
      return { label: 'Released', bg: '#DBEAFE', color: '#2563EB' };
    }
    return { label: 'Active Parking', bg: '#DCFCE7', color: '#16A34A' };
  };

  const statusBadge = getStatusBadge();

  // Filtered Photo Drawer Data
  const displayedDrawerPhotos = photoFilterTab === 'images' ? imagePhotos : photoFilterTab === 'pdfs' ? pdfPhotos : (vehicle.photos || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        {/* Top Operational Navigation Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Vehicle Profile</ThemedText>
          <TouchableOpacity onPress={handleMoreMenu} style={styles.iconButton} activeOpacity={0.7}>
            <MoreVertical size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 130 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. TOP OPERATOR HERO PROFILE CARD */}
          <View style={styles.heroProfileCard}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setActivePhotoUrl(displayPhoto)}
              style={styles.heroPhotoWrapper}
            >
              <Image source={{ uri: displayPhoto }} style={styles.heroPhoto} />
              {imagePhotos.length > 1 && (
                <View style={styles.heroPhotoBadge}>
                  <Camera size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <ThemedText style={styles.heroPhotoBadgeText}>{imagePhotos.length}</ThemedText>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.heroInfo}>
              <ThemedText style={styles.heroVehicleNumber}>{vehicle.vehicleNumber.toUpperCase()}</ThemedText>
              <ThemedText style={styles.heroSubText}>
                {vehicle.brand || 'Vehicle'} {vehicle.model || ''} {vehicle.color ? `• ${vehicle.color}` : ''}
              </ThemedText>

              <View style={[styles.heroStatusBadge, { backgroundColor: statusBadge.bg }]}>
                <ThemedText style={[styles.heroStatusText, { color: statusBadge.color }]}>
                  {statusBadge.label}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* 2. OPERATOR 4-METRIC QUICK SUMMARY GRID */}
          <View style={styles.quickMetricsGrid}>
            <View style={styles.metricBox}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#EEF2FF' }]}>
                <Building size={16} color="#4F46E5" />
              </View>
              <ThemedText style={styles.metricLabel}>YARD SLOT</ThemedText>
              <ThemedText style={styles.metricValue} numberOfLines={1}>
                {vehicle.yardLocation ? `${vehicle.yardLocation.zone}-${vehicle.yardLocation.slot}` : 'Unassigned'}
              </ThemedText>
            </View>

            <View style={styles.metricBox}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={16} color="#D97706" />
              </View>
              <ThemedText style={styles.metricLabel}>DURATION</ThemedText>
              <ThemedText style={styles.metricValue}>
                {getDurationDays()} Days
              </ThemedText>
            </View>

            <View style={styles.metricBox}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <DollarSign size={16} color="#16A34A" />
              </View>
              <ThemedText style={styles.metricLabel}>DUE CHARGES</ThemedText>
              <ThemedText style={[styles.metricValue, { color: '#16A34A' }]}>
                ₹{getTotalCharges().toLocaleString('en-IN')}
              </ThemedText>
            </View>

            <View style={styles.metricBox}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Building size={16} color="#64748B" />
              </View>
              <ThemedText style={styles.metricLabel}>BANK / FINANCER</ThemedText>
              <ThemedText style={styles.metricValue} numberOfLines={1}>
                {vehicle.bankName || 'Direct'}
              </ThemedText>
            </View>
          </View>

          {/* 3. CONTEXTUAL OPERATOR ACTION BANNER */}
          {vehicle.shiftStatus === 'SHIFT_PENDING' && (
            <View style={styles.contextBannerShift}>
              <View style={styles.contextBannerRow}>
                <RefreshCw size={20} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.contextBannerTitle}>Shift Pending — Non-Paneled Bank</ThemedText>
                  <ThemedText style={styles.contextBannerSub}>Bank is not paneled. Queued for transfer.</ThemedText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.contextBannerBtnShift}
                onPress={() => router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } })}
                activeOpacity={0.85}
              >
                <ThemedText style={styles.contextBannerBtnText}>Transfer →</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {vehicle.yardStatus === 'KACHHA' && vehicle.shiftStatus !== 'SHIFT_PENDING' && (
            <TouchableOpacity
              style={styles.contextBannerKachha}
              onPress={() => router.push({ pathname: '/admin/kachha-to-pakka', params: { id: vehicle.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.contextBannerRow}>
                <Shield size={20} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.contextBannerTitle}>Verification & Repo Kit Pending</ThemedText>
                  <ThemedText style={styles.contextBannerSub}>Tap to complete Repo Kit & start active billing</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.contextBannerBtnKachha}>Verify →</ThemedText>
            </TouchableOpacity>
          )}

          {/* 4. EXPANDABLE COLLAPSIBLE SECTIONS */}
          
          {/* SECTION 1: Overview & Specifications (Default Open) */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection('overview')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <Car size={18} color="#4F46E5" />
                <ThemedText style={styles.accordionTitle}>Overview & Specifications</ThemedText>
              </View>
              {expandedSections.overview ? (
                <ChevronDown size={18} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {expandedSections.overview && (
              <View style={styles.accordionContent}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Entry Date & Time</ThemedText>
                  <ThemedText style={styles.detailValue}>{formattedEntryDate}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Category</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {vehicle.vehicleType === 'TW' ? 'Two Wheeler (2W)' :
                     vehicle.vehicleType === 'THREE_W' ? 'Three Wheeler (3W)' :
                     vehicle.vehicleType === 'CV' ? 'Commercial (CV)' : 'Four Wheeler (4W)'}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Color</ThemedText>
                  <ThemedText style={styles.detailValue}>{vehicle.color || 'N/A'}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Yard Serial No.</ThemedText>
                  <ThemedText style={styles.detailValue}>{vehicle.serialNumber ? `#${vehicle.serialNumber}` : 'N/A'}</ThemedText>
                </View>
              </View>
            )}
          </View>

          {/* SECTION 2: Customer & Repossession Details (Default Closed) */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection('repoDetails')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <User size={18} color="#4F46E5" />
                <ThemedText style={styles.accordionTitle}>Customer & Repo Details</ThemedText>
              </View>
              {expandedSections.repoDetails ? (
                <ChevronDown size={18} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {expandedSections.repoDetails && (
              <View style={styles.accordionContent}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Customer Name</ThemedText>
                  <ThemedText style={styles.detailValue}>{vehicle.customerName || 'N/A'}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Customer Mobile</ThemedText>
                  <TouchableOpacity
                    onPress={() => vehicle.customerPhone && Linking.openURL(`tel:${vehicle.customerPhone}`)}
                    disabled={!vehicle.customerPhone}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    {vehicle.customerPhone && <Phone size={14} color="#4F46E5" />}
                    <ThemedText style={[styles.detailValue, vehicle.customerPhone ? { color: '#4F46E5', fontWeight: '700' } : null]}>
                      {vehicle.customerPhone || 'N/A'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Bank Name</ThemedText>
                  <ThemedText style={styles.detailValue}>{vehicle.bankName || 'N/A'}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Repo Agency</ThemedText>
                  <ThemedText style={styles.detailValue}>{parsedRepo.agency}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Repo Agent</ThemedText>
                  <ThemedText style={styles.detailValue}>{parsedRepo.agent}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Place of Possession</ThemedText>
                  <ThemedText style={styles.detailValue}>{parsedRepo.place}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Chassis Number</ThemedText>
                  <ThemedText style={[styles.detailValue, { fontFamily: 'monospace', fontWeight: '700' }]}>
                    {vehicle.chassisNumber || 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Engine Number</ThemedText>
                  <ThemedText style={[styles.detailValue, { fontFamily: 'monospace', fontWeight: '700' }]}>
                    {vehicle.engineNumber || 'N/A'}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>

          {/* SECTION 3: Condition & Remarks (Default Closed) */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection('vehicleDetails')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <FileText size={18} color="#4F46E5" />
                <ThemedText style={styles.accordionTitle}>Condition Report & Remarks</ThemedText>
              </View>
              {expandedSections.vehicleDetails ? (
                <ChevronDown size={18} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {expandedSections.vehicleDetails && (
              <View style={styles.accordionContent}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Body Condition</ThemedText>
                  <View style={[
                    styles.conditionBadge,
                    bodyCondition === 'Good' ? styles.bgGood : bodyCondition === 'Bad' ? styles.bgBad : styles.bgAverage
                  ]}>
                    <ThemedText style={[
                      styles.conditionBadgeText,
                      bodyCondition === 'Good' ? styles.textGood : bodyCondition === 'Bad' ? styles.textBad : styles.textAverage
                    ]}>
                      {bodyCondition}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.remarksBlock}>
                  <ThemedText style={styles.remarksLabel}>Yard Remarks</ThemedText>
                  <ThemedText style={styles.remarksValue}>{yardRemarks}</ThemedText>
                </View>

                <View style={[styles.remarksBlock, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 }]}>
                  <ThemedText style={styles.remarksLabel}>Customer Remarks</ThemedText>
                  <ThemedText style={styles.remarksValue}>{customerRemarks}</ThemedText>
                </View>
              </View>
            )}
          </View>

          {/* SECTION 4: Compact Accessories Checklist (Default Closed) */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection('checklist')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <FileText size={18} color="#4F46E5" />
                <ThemedText style={styles.accordionTitle}>Accessories Checklist</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.accessorySummaryPill}>
                  <ThemedText style={styles.accessorySummaryText}>
                    {accessoryCounts.checked} Checked  •  {accessoryCounts.missing} Missing
                  </ThemedText>
                </View>
                {expandedSections.checklist ? (
                  <ChevronDown size={18} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
                ) : (
                  <ChevronDown size={18} color="#64748B" />
                )}
              </View>
            </TouchableOpacity>

            {expandedSections.checklist && (
              <View style={styles.accordionContent}>
                <View style={styles.compactAccessoryList}>
                  {accessoryItems.map(item => {
                    const invItem = getInventoryItem(item.key);
                    const isPresent = !!invItem?.isPresent;
                    let subtext = '';
                    if (isPresent) {
                      if (item.key === 'Front Tyre' || item.key === 'Back Tyre') {
                        const match = invItem.remarks?.match(/\(Tyre Make:\s*(.*?)\)/i);
                        subtext = match ? match[1]?.trim() : '';
                      } else {
                        subtext = invItem.remarks || '';
                      }
                    }

                    return (
                      <View key={item.key} style={styles.compactAccessoryRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          {isPresent ? (
                            <Check size={16} color="#16A34A" />
                          ) : (
                            <X size={16} color="#EF4444" />
                          )}
                          <ThemedText style={[styles.compactAccessoryText, !isPresent && { color: '#94A3B8' }]}>
                            {item.label}
                          </ThemedText>
                        </View>
                        {isPresent ? (
                          <ThemedText style={styles.compactAccessoryStatusPresent}>
                            {subtext ? `${subtext}` : 'Present'}
                          </ThemedText>
                        ) : (
                          <ThemedText style={styles.compactAccessoryStatusAbsent}>Missing</ThemedText>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* SECTION 5: Dynamic Billing Breakdown (Default Closed) */}
          <View style={styles.accordionCard}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection('billing')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <DollarSign size={18} color="#16A34A" />
                <ThemedText style={styles.accordionTitle}>Billing & Daily Rates</ThemedText>
              </View>
              {expandedSections.billing ? (
                <ChevronDown size={18} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {expandedSections.billing && (
              <View style={styles.accordionContent}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Daily Rate</ThemedText>
                  <ThemedText style={[styles.detailValue, { fontWeight: '700' }]}>₹{getDailyRate()} / Day</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Total Days Stayed</ThemedText>
                  <ThemedText style={styles.detailValue}>{getDurationDays()} Days</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Accrued Dues</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: '#16A34A', fontWeight: '800', fontSize: 16 }]}>
                    ₹{getTotalCharges().toLocaleString('en-IN')}
                  </ThemedText>
                </View>
                {parkingCalculation?.phaseBreakdown && (
                  <View style={{ marginTop: 8, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                    <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>Phase Breakdown</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: '#334155' }}>
                      Kachha: ₹{parkingCalculation.phaseBreakdown.kachhaCharge || 0} ({parkingCalculation.phaseBreakdown.kachhaDays || 0} days)
                    </ThemedText>
                    <ThemedText style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                      Pakka: ₹{parkingCalculation.phaseBreakdown.pakkaCharge || 0} ({parkingCalculation.phaseBreakdown.pakkaDays || 0} days)
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* SECTION 6: Advanced / Admin Actions (Default Closed) */}
          <View style={[styles.accordionCard, { borderColor: '#FEE2E2' }]}>
            <TouchableOpacity
              style={[styles.accordionHeader, { backgroundColor: '#FEF2F2' }]}
              onPress={() => toggleSection('advanced')}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <Shield size={18} color="#EF4444" />
                <ThemedText style={[styles.accordionTitle, { color: '#991B1B' }]}>Advanced / Admin Actions</ThemedText>
              </View>
              {expandedSections.advanced ? (
                <ChevronDown size={18} color="#991B1B" style={{ transform: [{ rotate: '180deg' }] }} />
              ) : (
                <ChevronDown size={18} color="#991B1B" />
              )}
            </TouchableOpacity>

            {expandedSections.advanced && (
              <View style={styles.accordionContent}>
                <TouchableOpacity
                  style={styles.dangerZoneBtn}
                  onPress={handleDelete}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                    Permanently Delete Vehicle Record
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* 5. STICKY OPERATOR BOTTOM ACTION BAR */}
        <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Primary Action Button */}
          {vehicle.yardStatus === 'KACHHA' && vehicle.shiftStatus !== 'SHIFT_PENDING' && (
            <TouchableOpacity
              style={[styles.primaryStickyBtn, { backgroundColor: '#D97706' }]}
              onPress={() => router.push({ pathname: '/admin/kachha-to-pakka', params: { id: vehicle.id } })}
              activeOpacity={0.85}
            >
              <Shield size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.primaryStickyBtnText}>Complete Verification</ThemedText>
            </TouchableOpacity>
          )}

          {vehicle.shiftStatus === 'SHIFT_PENDING' && (
            <TouchableOpacity
              style={[styles.primaryStickyBtn, { backgroundColor: '#D97706' }]}
              onPress={() => router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } })}
              activeOpacity={0.85}
            >
              <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.primaryStickyBtnText}>Shift Vehicle</ThemedText>
            </TouchableOpacity>
          )}

          {vehicle.yardStatus === 'PAKKA' && (
            <TouchableOpacity
              style={[styles.primaryStickyBtn, { backgroundColor: '#16A34A' }]}
              onPress={() => router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } })}
              activeOpacity={0.85}
            >
              <Key size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.primaryStickyBtnText}>Release Vehicle</ThemedText>
            </TouchableOpacity>
          )}

          {(vehicle.yardStatus === 'RELEASED' || vehicle.status === 'RELEASED' || vehicle.status === 'CHECKED_OUT') && (
            <TouchableOpacity
              style={[styles.primaryStickyBtn, { backgroundColor: '#2563EB' }]}
              onPress={downloadAndSharePDF}
              activeOpacity={0.85}
            >
              <Printer size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.primaryStickyBtnText}>Share Gatepass PDF</ThemedText>
            </TouchableOpacity>
          )}

          {/* Quick Action Navigation Bar */}
          <View style={styles.quickTabBar}>
            <TouchableOpacity style={styles.quickTabBtn} onPress={() => setPhotosVisible(true)} activeOpacity={0.7}>
              <Camera size={18} color="#4F46E5" />
              <ThemedText style={styles.quickTabLabel}>Photos ({imagePhotos.length})</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTabBtn}
              onPress={() => setCalcVisible(true)}
              activeOpacity={0.7}
            >
              <Calculator size={18} color="#4F46E5" />
              <ThemedText style={styles.quickTabLabel}>Calculator</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickTabBtn} onPress={downloadAndSharePDF} activeOpacity={0.7}>
              <FileText size={18} color="#4F46E5" />
              <ThemedText style={styles.quickTabLabel}>PDF Report</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickTabBtn} onPress={handleMoreMenu} activeOpacity={0.7}>
              <MoreHorizontal size={18} color="#4F46E5" />
              <ThemedText style={styles.quickTabLabel}>More</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------------------------------------------------------------------- */}
        {/* MODALS */}
        {/* ---------------------------------------------------------------------- */}

        {/* Inspection Photos Drawer Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={photosVisible}
          onRequestClose={() => {
            setSelectedPhotos([]);
            setPhotosVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.modalTitle}>Inspection Attachments</ThemedText>
                  <ThemedText style={styles.modalSub}>
                    {vehicle.photos?.length || 0} items captured {selectedPhotos.length > 0 ? `| ${selectedPhotos.length} selected` : ''}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => setPhotosVisible(false)} style={styles.closeIconBtn}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Photo Filter Tabs */}
              <View style={styles.photoFilterRow}>
                <TouchableOpacity
                  style={[styles.photoFilterChip, photoFilterTab === 'all' && styles.photoFilterChipActive]}
                  onPress={() => setPhotoFilterTab('all')}
                >
                  <ThemedText style={[styles.photoFilterChipText, photoFilterTab === 'all' && styles.photoFilterChipTextActive]}>
                    All ({vehicle.photos?.length || 0})
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoFilterChip, photoFilterTab === 'images' && styles.photoFilterChipActive]}
                  onPress={() => setPhotoFilterTab('images')}
                >
                  <ThemedText style={[styles.photoFilterChipText, photoFilterTab === 'images' && styles.photoFilterChipTextActive]}>
                    📷 Images ({imagePhotos.length})
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoFilterChip, photoFilterTab === 'pdfs' && styles.photoFilterChipActive]}
                  onPress={() => setPhotoFilterTab('pdfs')}
                >
                  <ThemedText style={[styles.photoFilterChipText, photoFilterTab === 'pdfs' && styles.photoFilterChipTextActive]}>
                    📄 PDFs ({pdfPhotos.length})
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <FlatList
                data={displayedDrawerPhotos}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
                columnWrapperStyle={{ gap: 10 }}
                ListEmptyComponent={() => (
                  <View style={styles.emptyPhotosContainer}>
                    <Camera size={38} color="#94A3B8" />
                    <ThemedText style={{ color: '#64748B', marginTop: 10 }}>No attachments in this category.</ThemedText>
                  </View>
                )}
                renderItem={({ item }) => {
                  const isSelected = selectedPhotos.includes(item.s3Url);
                  const isPdf = item.s3Url.toLowerCase().split('?')[0].endsWith('.pdf');
                  return (
                    <View style={styles.gridPhotoWrapper}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setActivePhotoUrl(item.s3Url)}
                        style={{ width: '100%', height: '100%' }}
                      >
                        {isPdf ? (
                          <View style={[styles.gridPhoto, styles.pdfGridPlaceholder]}>
                            <FileText size={32} color="#EF4444" />
                            <ThemedText style={styles.pdfGridText}>PDF File</ThemedText>
                          </View>
                        ) : (
                          <Image source={{ uri: item.s3Url }} style={styles.gridPhoto} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.photoSelectCheckbox, isSelected && styles.photoSelectCheckboxActive]}
                        onPress={() => togglePhotoSelection(item.s3Url)}
                        activeOpacity={0.7}
                      >
                        <ThemedText style={styles.checkboxTick}>{isSelected ? '✓' : ''}</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.photoShareMiniBtn}
                        onPress={() => handleSharePhoto(item.s3Url)}
                        activeOpacity={0.7}
                      >
                        <Share2 size={12} color="#FFFFFF" />
                      </TouchableOpacity>

                      <View style={styles.photoTypeTag}>
                        <ThemedText style={styles.photoTypeTagText}>{item.photoType.toUpperCase()}</ThemedText>
                      </View>
                    </View>
                  );
                }}
              />

              <View style={styles.drawerActionsRow}>
                {selectedPhotos.length > 0 ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleShareBatchPhotos(selectedPhotos)}
                      style={[styles.drawerActionBtn, styles.drawerActionBtnPrimary]}
                      disabled={sharingInProgress}
                    >
                      {sharingInProgress ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.drawerActionBtnText}>
                          Share Selected ({selectedPhotos.length})
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedPhotos([])}
                      style={[styles.drawerActionBtn, styles.drawerActionBtnSecondary]}
                    >
                      <ThemedText style={styles.drawerActionBtnTextSecondary}>Clear</ThemedText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      const allUrls = vehicle.photos?.map((p: any) => p.s3Url) || [];
                      handleShareBatchPhotos(allUrls);
                    }}
                    style={[styles.drawerActionBtn, styles.drawerActionBtnPrimary, { flex: 2 }]}
                    disabled={sharingInProgress || !vehicle.photos || vehicle.photos.length === 0}
                  >
                    {sharingInProgress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.drawerActionBtnText}>Share All Photos</ThemedText>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setSelectedPhotos([]);
                    setPhotosVisible(false);
                  }}
                  style={[styles.drawerActionBtn, styles.drawerActionBtnClose]}
                >
                  <ThemedText style={styles.drawerActionBtnTextClose}>Close</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Fullscreen Photo Lightbox Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={activePhotoUrl !== null}
          onRequestClose={() => setActivePhotoUrl(null)}
        >
          <View style={styles.fullscreenOverlay}>
            {activePhotoUrl && (
              <>
                <View style={styles.fullscreenHeader}>
                  <TouchableOpacity
                    onPress={() => setActivePhotoUrl(null)}
                    style={styles.fullscreenHeaderBtn}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={20} color="#FFFFFF" />
                    <ThemedText style={styles.fullscreenHeaderBtnText}>Back</ThemedText>
                  </TouchableOpacity>

                  <ThemedText style={styles.fullscreenTitle}>Photo Preview</ThemedText>

                  <TouchableOpacity
                    onPress={() => handleSharePhoto(activePhotoUrl)}
                    style={styles.fullscreenHeaderBtn}
                    activeOpacity={0.7}
                    disabled={sharingInProgress}
                  >
                    {sharingInProgress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Share2 size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.fullscreenImageContainer}>
                  {activePhotoUrl.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                    <View style={styles.pdfFullscreenWrapper}>
                      <FileText size={72} color="#EF4444" style={{ marginBottom: 16 }} />
                      <ThemedText style={styles.pdfFullscreenTitle}>PDF Document File</ThemedText>
                      <ThemedText style={styles.pdfFullscreenSubtitle}>
                        This document cannot be previewed directly as an image.
                      </ThemedText>

                      <TouchableOpacity
                        style={styles.openPdfBtn}
                        onPress={() => Linking.openURL(activePhotoUrl)}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.openPdfBtnText}>Open in Browser / Viewer</ThemedText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: activePhotoUrl }}
                      style={styles.fullscreenImage}
                      resizeMode="contain"
                    />
                  )}
                </View>
              </>
            )}
          </View>
        </Modal>

        {/* Fee Calculator Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={calcVisible}
          onRequestClose={() => setCalcVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '55%' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.modalTitle}>Fee Estimator</ThemedText>
                    <ThemedText style={styles.modalSub}>Daily Rate: ₹{getDailyRate()}/Day</ThemedText>
                  </View>
                  <TouchableOpacity onPress={() => setCalcVisible(false)} style={styles.closeIconBtn}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.calcBody}>
                  <ThemedText style={styles.calcLabel}>Enter Number of Days</ThemedText>
                  <View style={styles.calcInputWrapper}>
                    <Clock size={16} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.calcInput}
                      keyboardType="numeric"
                      value={calcDays}
                      onChangeText={(val: string) => {
                        setCalcDays(val);
                        setCalcResult(null);
                      }}
                      placeholder="30"
                    />
                  </View>

                  <TouchableOpacity style={styles.calculateBtn} onPress={handleCalculate}>
                    <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Calculate Charges</ThemedText>
                  </TouchableOpacity>

                  {calcResult !== null && (
                    <View style={styles.calcResultBox}>
                      <ThemedText style={styles.calcResultTitle}>Estimated Charges</ThemedText>
                      <ThemedText style={styles.calcResultValue}>₹{calcResult.toLocaleString('en-IN')}</ThemedText>
                      <ThemedText style={styles.calcResultSub}>
                        For {calcDays} Days at ₹{getDailyRate()}/Day
                      </ThemedText>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setCalcVisible(false);
                    setCalcResult(null);
                  }}
                  style={[styles.closeModalBtn, { backgroundColor: '#64748B', marginTop: 12 }]}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Custom Actions Sheet Drawer */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={actionsSheetVisible}
          onRequestClose={() => setActionsSheetVisible(false)}
        >
          <TouchableOpacity
            style={styles.actionsSheetOverlay}
            activeOpacity={1}
            onPress={() => setActionsSheetVisible(false)}
          >
            <View style={styles.actionsSheetContent}>
              <View style={styles.actionsSheetHeader}>
                <View style={styles.actionsSheetIndicator} />
                <ThemedText style={styles.actionsSheetTitle}>Vehicle Actions</ThemedText>
              </View>

              <View style={styles.actionsSheetList}>
                <TouchableOpacity
                  style={styles.actionsSheetItem}
                  onPress={() => {
                    setActionsSheetVisible(false);
                    downloadAndSharePDF();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionsSheetIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <FileText size={18} color="#4F46E5" />
                  </View>
                  <ThemedText style={styles.actionsSheetText}>Share Condition Report (PDF)</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionsSheetItem}
                  onPress={() => {
                    setActionsSheetVisible(false);
                    router.push({
                      pathname: '/admin/check-in',
                      params: { editVehicleId: id },
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionsSheetIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Pencil size={18} color="#059669" />
                  </View>
                  <ThemedText style={styles.actionsSheetText}>Edit Vehicle Record</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionsSheetItem}
                  onPress={() => {
                    setActionsSheetVisible(false);
                    handlePrint();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionsSheetIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Printer size={18} color="#7C3AED" />
                  </View>
                  <ThemedText style={styles.actionsSheetText}>Print Thermal Gate Pass</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionsSheetItem}
                  onPress={async () => {
                    setActionsSheetVisible(false);
                    const detailStr = `Vehicle: ${vehicle?.brand || ''} ${vehicle?.model || ''}\nNumber: ${vehicle?.vehicleNumber}\nStatus: ${statusBadge.label}\nDays: ${getDurationDays()}\nCharges: ₹${getTotalCharges()}`;
                    try {
                      await Sharing.shareAsync({ message: detailStr } as any);
                    } catch {
                      Alert.alert('Vehicle Details', detailStr);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionsSheetIconBox, { backgroundColor: '#FFF7ED' }]}>
                    <Share2 size={18} color="#EA580C" />
                  </View>
                  <ThemedText style={styles.actionsSheetText}>Share Details Text</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionsSheetItem, styles.actionsSheetItemDelete]}
                  onPress={() => {
                    setActionsSheetVisible(false);
                    setTimeout(() => {
                      handleDelete();
                    }, 150);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionsSheetIconBox, { backgroundColor: '#FEF2F2' }]}>
                    <Trash2 size={18} color="#EF4444" />
                  </View>
                  <ThemedText style={[styles.actionsSheetText, { color: '#EF4444' }]}>Delete Vehicle Record</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionsSheetCancel}
                  onPress={() => setActionsSheetVisible(false)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.actionsSheetCancelText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------
// STYLESHEET
// ----------------------------------------------------------------------
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
    paddingVertical: 12,
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
  scrollContent: {
    padding: 16,
  },

  // Skeleton Loading Styles
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  skeletonHeaderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  skeletonMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonGridBox: {
    width: '48%',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonCard: {
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Error Container
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },

  // Hero Card
  heroProfileCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroPhotoWrapper: {
    position: 'relative',
  },
  heroPhoto: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  heroPhotoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPhotoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  heroVehicleNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  heroSubText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  heroStatusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // 4-Metric Grid
  quickMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  metricBox: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  // Context Banners
  contextBannerKachha: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contextBannerShift: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contextBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  contextBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  contextBannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  contextBannerBtnKachha: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  contextBannerBtnShift: {
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  contextBannerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Accordion Section Cards
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  accordionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },

  // Detail Rows inside Accordion
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'right',
  },

  // Remarks
  remarksBlock: {
    marginTop: 8,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  remarksValue: {
    fontSize: 13,
    color: '#1E293B',
  },

  // Condition Badges
  conditionBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  conditionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bgGood: { backgroundColor: '#DCFCE7' },
  textGood: { color: '#15803D' },
  bgAverage: { backgroundColor: '#FEF3C7' },
  textAverage: { color: '#B45309' },
  bgBad: { backgroundColor: '#FEE2E2' },
  textBad: { color: '#B91C1C' },

  // Compact Accessories List
  accessorySummaryPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  accessorySummaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  compactAccessoryList: {
    gap: 6,
  },
  compactAccessoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  compactAccessoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  compactAccessoryStatusPresent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  compactAccessoryStatusAbsent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },

  // Danger Zone
  dangerZoneBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // Sticky Bottom Bar
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  primaryStickyBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  primaryStickyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  quickTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  quickTabBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  quickTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 3,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  closeIconBtn: {
    padding: 6,
  },

  // Photo Filter Tabs
  photoFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  photoFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  photoFilterChipActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  photoFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  photoFilterChipTextActive: {
    color: '#4F46E5',
  },

  // Photo Grid
  gridPhotoWrapper: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  pdfGridPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  pdfGridText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 4,
  },
  photoSelectCheckbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSelectCheckboxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoShareMiniBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoTypeTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  photoTypeTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  emptyPhotosContainer: {
    padding: 30,
    alignItems: 'center',
  },

  // Drawer Actions
  drawerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  drawerActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActionBtnPrimary: {
    backgroundColor: '#4F46E5',
  },
  drawerActionBtnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  drawerActionBtnClose: {
    backgroundColor: '#64748B',
    flex: 0.7,
  },
  drawerActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  drawerActionBtnTextSecondary: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 13,
  },
  drawerActionBtnTextClose: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Fullscreen Viewer
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  fullscreenHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  fullscreenHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: width,
    height: '100%',
  },
  pdfFullscreenWrapper: {
    alignItems: 'center',
    padding: 24,
  },
  pdfFullscreenTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  pdfFullscreenSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  openPdfBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  openPdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Fee Calculator Modal
  calcBody: {
    gap: 12,
    paddingVertical: 10,
  },
  calcLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  calcInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  calcInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '700',
  },
  calculateBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  calcResultBox: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  calcResultTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
    textTransform: 'uppercase',
  },
  calcResultValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4338CA',
    marginVertical: 4,
  },
  calcResultSub: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  closeModalBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  // Actions Sheet
  actionsSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  actionsSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  actionsSheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionsSheetIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  actionsSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionsSheetList: {
    gap: 8,
  },
  actionsSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  actionsSheetItemDelete: {
    backgroundColor: '#FEF2F2',
  },
  actionsSheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsSheetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionsSheetCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actionsSheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
