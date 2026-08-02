import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
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
  Calculator,
  Car,
  Clock,
  DollarSign,
  Trash2,
  FileText,
  Pencil,
  Building,
  User,
  Phone,
  Shield,
  AlertTriangle,
  RefreshCw,
  X,
  Camera,
} from 'lucide-react-native';

import {
  VehicleData,
  BillingData,
  ParkingCalculation,
  VehicleHeroCard,
  MetricCard,
  AccordionSection,
  ChecklistCard,
  ACCESSORY_ITEMS,
  BillingCard,
  PhotoGalleryModal,
  ActionBottomBar,
  ActionSheetModal,
  VehicleDetailsSkeleton,
} from '@/components/vehicle-details';

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal & Drawer States
  const [calcVisible, setCalcVisible] = useState(false);
  const [photosVisible, setPhotosVisible] = useState(false);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);

  // Custom Fee Calculator States
  const [calcDays, setCalcDays] = useState('30');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // Expandable Accordion State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,       // Default open
    repoDetails: false,
    remarks: false,
    checklist: false,
    billing: false,
    advanced: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navigation = useNavigation();

  // Photo Sharing & Lightbox States
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [parkingCalculation, setParkingCalculation] = useState<ParkingCalculation | null>(null);

  // Fetch Vehicle Details API
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

  // Billing calculations
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

  const handleCalculate = () => {
    const days = parseInt(calcDays);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days');
      return;
    }
    setCalcResult(days * getDailyRate());
  };

  // Download & Share Photo
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

  // Share Batch Photos
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

  // Convert image URIs to Base64 for PDF Report
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
    if (!vehicle) return '';
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

  // Print Thermal Gate Pass
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

  // Format dates & photo lists
  const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=400';
  const imagePhotos = useMemo(() => {
    return vehicle?.photos?.filter((p: any) => !p.s3Url.toLowerCase().split('?')[0].endsWith('.pdf')) || [];
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

  // Accessories count summary
  const accessoryCounts = useMemo(() => {
    let checked = 0;
    let missing = 0;
    ACCESSORY_ITEMS.forEach(item => {
      const inv = getInventoryItem(item.key);
      if (inv?.isPresent) checked++;
      else missing++;
    });
    return { checked, missing };
  }, [vehicle]);

  // Primary sticky CTA handler
  const handlePrimaryAction = () => {
    if (!vehicle) return;
    if (vehicle.shiftStatus === 'SHIFT_PENDING') {
      router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } });
    } else if (vehicle.yardStatus === 'KACHHA') {
      router.push({ pathname: '/admin/kachha-to-pakka', params: { id: vehicle.id } });
    } else if (
      vehicle.yardStatus === 'RELEASED' ||
      vehicle.status === 'RELEASED' ||
      vehicle.status === 'CHECKED_OUT'
    ) {
      downloadAndSharePDF();
    } else {
      router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } });
    }
  };

  // Loading Skeleton State
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
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: '#64748B', marginTop: 10 }]}
            onPress={() => router.back()}
          >
            <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Back</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        {/* Top Operations Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Vehicle Operations Profile</ThemedText>
          <TouchableOpacity
            onPress={() => setActionsSheetVisible(true)}
            style={styles.iconButton}
            activeOpacity={0.7}
            accessibilityLabel="More options"
          >
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
          {/* 1. PREMIUM VEHICLE HERO CARD */}
          <VehicleHeroCard
            vehicle={vehicle}
            displayPhoto={displayPhoto}
            imageCount={imagePhotos.length}
            totalDays={getDurationDays()}
            totalCharges={getTotalCharges()}
            onPressPhoto={() => setActivePhotoUrl(displayPhoto)}
          />

          {/* 2. DASHBOARD METRIC CARDS GRID */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="PARKING DURATION"
              value={`${getDurationDays()} Days`}
              subValue={`Entry: ${formattedEntryDate.split(',')[0]}`}
              icon={<Clock size={16} color="#D97706" />}
              theme="amber"
            />

            <MetricCard
              label="OUTSTANDING DUE"
              value={`₹${getTotalCharges().toLocaleString('en-IN')}`}
              subValue={`Rate: ₹${getDailyRate()}/day`}
              icon={<DollarSign size={16} color="#16A34A" />}
              theme="green"
            />

            <MetricCard
              label="YARD SLOT"
              value={vehicle.yardLocation ? `${vehicle.yardLocation.zone}-${vehicle.yardLocation.slot}` : 'Unassigned'}
              subValue="Possession Zone"
              icon={<Car size={16} color="#4F46E5" />}
              theme="indigo"
            />

            <MetricCard
              label="BANK / FINANCER"
              value={vehicle.bankName || 'Direct'}
              subValue={vehicle.bank?.isThirdParty ? 'Third Party Partner' : 'Direct Bank'}
              icon={<Building size={16} color="#64748B" />}
              theme="slate"
            />
          </View>

          {/* 3. CONTEXTUAL OPERATOR ACTION BANNERS */}
          {vehicle.shiftStatus === 'SHIFT_PENDING' && (
            <View style={styles.shiftBanner}>
              <View style={styles.bannerRow}>
                <RefreshCw size={20} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.bannerTitle}>Shift Pending — Non-Paneled Bank</ThemedText>
                  <ThemedText style={styles.bannerSub}>Bank is not paneled. Queued for transfer.</ThemedText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.shiftBtn}
                onPress={() => router.push({ pathname: '/admin/check-out', params: { plate: vehicle.vehicleNumber } })}
                activeOpacity={0.85}
              >
                <ThemedText style={styles.shiftBtnText}>Transfer →</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {vehicle.yardStatus === 'KACHHA' && vehicle.shiftStatus !== 'SHIFT_PENDING' && (
            <TouchableOpacity
              style={styles.kachhaBanner}
              onPress={() => router.push({ pathname: '/admin/kachha-to-pakka', params: { id: vehicle.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.bannerRow}>
                <Shield size={20} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.bannerTitle}>Verification & Repo Kit Pending</ThemedText>
                  <ThemedText style={styles.bannerSub}>Tap to complete Repo Kit & start active billing</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.kachhaBtnText}>Verify →</ThemedText>
            </TouchableOpacity>
          )}

          {/* 4. SMART ACCORDION SECTIONS */}

          {/* Section A: Overview & Specifications */}
          <AccordionSection
            title="Overview & Specifications"
            summaryText={`${vehicle.brand || 'Vehicle'} ${vehicle.model || ''} • ${vehicle.color || 'Default Color'} • ${formattedEntryDate.split(',')[0]}`}
            icon={<Car size={18} color="#4F46E5" />}
            isExpanded={expandedSections.overview}
            onToggle={() => toggleSection('overview')}
          >
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Entry Date & Time</ThemedText>
              <ThemedText style={styles.detailValue}>{formattedEntryDate}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Vehicle Category</ThemedText>
              <ThemedText style={styles.detailValue}>
                {vehicle.vehicleType === 'TW'
                  ? 'Two Wheeler (2W)'
                  : vehicle.vehicleType === 'THREE_W'
                  ? 'Three Wheeler (3W)'
                  : vehicle.vehicleType === 'CV'
                  ? 'Commercial (CV)'
                  : 'Four Wheeler (4W)'}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Color</ThemedText>
              <ThemedText style={styles.detailValue}>{vehicle.color || 'N/A'}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Yard Serial Number</ThemedText>
              <ThemedText style={styles.detailValue}>
                {vehicle.serialNumber ? `#${vehicle.serialNumber}` : 'N/A'}
              </ThemedText>
            </View>
          </AccordionSection>

          {/* Section B: Customer & Repossession Details */}
          <AccordionSection
            title="Customer & Repo Details"
            summaryText={`Bank: ${vehicle.bankName || 'Direct'} • Customer: ${vehicle.customerName || 'N/A'}`}
            icon={<User size={18} color="#4F46E5" />}
            isExpanded={expandedSections.repoDetails}
            onToggle={() => toggleSection('repoDetails')}
          >
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
                {vehicle.customerPhone ? <Phone size={14} color="#4F46E5" /> : null}
                <ThemedText
                  style={[
                    styles.detailValue,
                    vehicle.customerPhone ? { color: '#4F46E5', fontWeight: '700' } : null,
                  ]}
                >
                  {vehicle.customerPhone || 'N/A'}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Financer / Bank</ThemedText>
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
          </AccordionSection>

          {/* Section C: Vehicle Condition & Remarks */}
          <AccordionSection
            title="Condition Report & Remarks"
            summaryText={`Body: ${bodyCondition} • Yard Remarks Recorded`}
            icon={<FileText size={18} color="#4F46E5" />}
            isExpanded={expandedSections.remarks}
            onToggle={() => toggleSection('remarks')}
          >
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Body Condition</ThemedText>
              <View
                style={[
                  styles.conditionBadge,
                  bodyCondition === 'Good'
                    ? styles.bgGood
                    : bodyCondition === 'Bad'
                    ? styles.bgBad
                    : styles.bgAverage,
                ]}
              >
                <ThemedText
                  style={[
                    styles.conditionText,
                    bodyCondition === 'Good'
                      ? styles.textGood
                      : bodyCondition === 'Bad'
                      ? styles.textBad
                      : styles.textAverage,
                  ]}
                >
                  {bodyCondition}
                </ThemedText>
              </View>
            </View>

            <View style={styles.remarksBox}>
              <ThemedText style={styles.remarksLabel}>Yard Remarks</ThemedText>
              <ThemedText style={styles.remarksVal}>{yardRemarks}</ThemedText>
            </View>

            <View style={[styles.remarksBox, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 }]}>
              <ThemedText style={styles.remarksLabel}>Customer Remarks</ThemedText>
              <ThemedText style={styles.remarksVal}>{customerRemarks}</ThemedText>
            </View>
          </AccordionSection>

          {/* Section D: Visual Accessories Checklist (Missing items FIRST in Red) */}
          <AccordionSection
            title="Accessories Checklist"
            summaryText={`${accessoryCounts.checked} Available • ${accessoryCounts.missing} Missing`}
            icon={<FileText size={18} color="#4F46E5" />}
            isExpanded={expandedSections.checklist}
            onToggle={() => toggleSection('checklist')}
            warningPillText={accessoryCounts.missing > 0 ? `${accessoryCounts.missing} Missing` : undefined}
          >
            <ChecklistCard inventory={vehicle.inventory} />
          </AccordionSection>

          {/* Section E: Financial Summary & Billing */}
          <AccordionSection
            title="Billing & Daily Rates"
            summaryText={`₹${getTotalCharges().toLocaleString('en-IN')} Due • ${getDurationDays()} Days Stay`}
            icon={<DollarSign size={18} color="#16A34A" />}
            isExpanded={expandedSections.billing}
            onToggle={() => toggleSection('billing')}
          >
            <BillingCard
              dailyRate={getDailyRate()}
              totalDays={getDurationDays()}
              totalCharges={getTotalCharges()}
              parkingCalculation={parkingCalculation}
            />
          </AccordionSection>

          {/* Section F: Advanced / Admin Danger Zone */}
          <AccordionSection
            title="Advanced / Admin Actions"
            summaryText="Permanent Record Deletion & Controls"
            icon={<Shield size={18} color="#EF4444" />}
            isExpanded={expandedSections.advanced}
            onToggle={() => toggleSection('advanced')}
            isDanger={true}
          >
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.dangerBtnText}>
                Permanently Delete Vehicle Record
              </ThemedText>
            </TouchableOpacity>
          </AccordionSection>
        </ScrollView>

        {/* 5. OPERATIONAL STICKY BOTTOM ACTION BAR */}
        <ActionBottomBar
          vehicle={vehicle}
          photoCount={imagePhotos.length}
          insetsBottom={insets.bottom}
          onPressPrimaryAction={handlePrimaryAction}
          onPressPhotos={() => setPhotosVisible(true)}
          onPressCalculator={() => setCalcVisible(true)}
          onPressPdf={downloadAndSharePDF}
          onPressMore={() => setActionsSheetVisible(true)}
        />

        {/* ---------------------------------------------------------------------- */}
        {/* MODALS & DRAWERS */}
        {/* ---------------------------------------------------------------------- */}

        {/* Attachment Photo Gallery Drawer */}
        <PhotoGalleryModal
          visible={photosVisible}
          photos={vehicle.photos || []}
          sharingInProgress={sharingInProgress}
          selectedPhotos={selectedPhotos}
          activePhotoUrl={activePhotoUrl}
          onClose={() => {
            setSelectedPhotos([]);
            setPhotosVisible(false);
          }}
          onSelectPhoto={togglePhotoSelection}
          onClearSelection={() => setSelectedPhotos([])}
          onSharePhoto={handleSharePhoto}
          onShareBatchPhotos={handleShareBatchPhotos}
          setActivePhotoUrl={setActivePhotoUrl}
        />

        {/* Fee Estimator Calculator Modal */}
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
            <View style={styles.calcOverlay}>
              <View style={styles.calcContent}>
                <View style={styles.calcHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.calcTitle}>Fee Estimator</ThemedText>
                    <ThemedText style={styles.calcSub}>Daily Rate: ₹{getDailyRate()}/Day</ThemedText>
                  </View>
                  <TouchableOpacity onPress={() => setCalcVisible(false)} style={{ padding: 4 }}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.calcBody}>
                  <ThemedText style={styles.calcInputLabel}>Enter Number of Days</ThemedText>
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

                  <TouchableOpacity style={styles.calcSubmitBtn} onPress={handleCalculate}>
                    <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Calculate Fees</ThemedText>
                  </TouchableOpacity>

                  {calcResult !== null ? (
                    <View style={styles.calcResultBox}>
                      <ThemedText style={styles.calcResultTitle}>Estimated Charges</ThemedText>
                      <ThemedText style={styles.calcResultVal}>₹{calcResult.toLocaleString('en-IN')}</ThemedText>
                      <ThemedText style={styles.calcResultSub}>
                        For {calcDays} Days at ₹{getDailyRate()}/Day
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setCalcVisible(false);
                    setCalcResult(null);
                  }}
                  style={styles.calcDoneBtn}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Custom Actions Sheet Drawer */}
        <ActionSheetModal
          visible={actionsSheetVisible}
          onClose={() => setActionsSheetVisible(false)}
          onSharePDF={downloadAndSharePDF}
          onEditVehicle={() =>
            router.push({
              pathname: '/admin/check-in',
              params: { editVehicleId: id },
            })
          }
          onPrintThermal={handlePrint}
          onShareText={async () => {
            const detailStr = `Vehicle: ${vehicle?.brand || ''} ${vehicle?.model || ''}\nNumber: ${vehicle?.vehicleNumber}\nDays: ${getDurationDays()}\nCharges: ₹${getTotalCharges()}`;
            try {
              await Sharing.shareAsync({ message: detailStr } as any);
            } catch {
              Alert.alert('Vehicle Details', detailStr);
            }
          }}
          onDeleteVehicle={handleDelete}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------
// MAIN SCREEN STYLESHEET
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
  },
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

  // Metric grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  // Context banners
  shiftBanner: {
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
  kachhaBanner: {
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
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  bannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  kachhaBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shiftBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shiftBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Detail rows inside accordions
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
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'right',
  },

  // Remarks
  remarksBox: {
    marginTop: 8,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  remarksVal: {
    fontSize: 13,
    color: '#1E293B',
  },

  // Condition Badges
  conditionBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bgGood: { backgroundColor: '#DCFCE7' },
  textGood: { color: '#15803D' },
  bgAverage: { backgroundColor: '#FEF3C7' },
  textAverage: { color: '#B45309' },
  bgBad: { backgroundColor: '#FEE2E2' },
  textBad: { color: '#B91C1C' },

  // Danger zone
  dangerBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Fee Calculator Modal
  calcOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  calcContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  calcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calcTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  calcSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  calcBody: {
    gap: 12,
    paddingVertical: 10,
  },
  calcInputLabel: {
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
  calcSubmitBtn: {
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
  calcResultVal: {
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
  calcDoneBtn: {
    backgroundColor: '#64748B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
});
