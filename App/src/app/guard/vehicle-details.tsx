import { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiRequest, getUserInfo, UserSession } from '@/services/api';
import { bluetoothService } from '@/services/bluetooth';
import { getCachedVehicleByNumber, CachedVehicle } from '@/services/sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
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
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [photosVisible, setPhotosVisible] = useState(false);
  const [calcVisible, setCalcVisible] = useState(false);
  
  // Custom Calculator States
  const [calcDays, setCalcDays] = useState('30');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // Edit Vehicle States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editVehicleNumber, setEditVehicleNumber] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editChassisNumber, setEditChassisNumber] = useState('');
  const [editEngineNumber, setEditEngineNumber] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');

  // Photo Sharing & Viewer States
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [sharingInProgress, setSharingInProgress] = useState(false);

  // Downloads a remote AWS S3 url to local device temporary storage and shares/saves it
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

  const fetchVehicleDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        // Fetch from live REST API
        const res = await apiRequest(`/api/vehicles/${id}`);
        if (res.success && res.data) {
          setVehicle(res.data);
          
          // Try fetching calculated billing
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
        // Offline: try loading from SQLite cache (we use search plate or query all for match)
        setError('Offline mode. Please check connection to view detailed logs.');
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

  // Daily rate fallback
  const getDailyRate = () => {
    if (billing?.dailyRate) return billing.dailyRate;
    
    if (vehicle?.bank?.parkingRates) {
      const match = vehicle.bank.parkingRates.find((r: any) => r.vehicleType === vehicle.vehicleType);
      if (match) return match.dailyRate;
    }

    const type = vehicle?.vehicleType;
    if (type === 'TW') return 50;
    if (type === 'THREE_W') return 100;
    if (type === 'CV') return 400;
    return 150; // FW default
  };

  // Duration Days
  const getDurationDays = () => {
    if (billing?.totalDays) return billing.totalDays;
    if (!vehicle?.entryDate) return 1;
    const entryDate = new Date(vehicle.entryDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  // Total calculated charges
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

  // Helper to convert URIs (local or remote) to base64
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
      return uri; // fallback
    }
  };

  const generateHTMLReport = async () => {
    // Convert remote photos to base64
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

    // Group the checklist items in a 2-column layout to save vertical space
    let checklistRows = '';
    const activeInventory = vehicle?.inventory || [];
    for (let i = 0; i < activeInventory.length; i += 2) {
      const item1 = activeInventory[i];
      const item2 = activeInventory[i + 1];

      const renderCell = (item: any) => {
        if (!item) return '<td style="border: 1px solid #cbd5e1; width: 50%;"></td>';
        
        // Filter out body condition and remarks from checklist rows
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

    const htmlContent = `
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
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; background-color: #eff6ff; padding: 5px 10px; margin: 14px 0 6px 0; border-left: 5px solid #1e3a8a; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
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
          <p style="font-size: 10px; margin-top: 5px; border: 1px solid #1e3a8a; display: inline-block; padding: 3px 10px; border-radius: 4px; color: #1e3a8a; background-color: #eff6ff; font-weight: bold; letter-spacing: 0.5px;">
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
    return htmlContent;
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

  const handleSaveEdit = async () => {
    if (!editVehicleNumber.trim()) {
      Alert.alert('Error', 'License plate is required');
      return;
    }
    if (editCustomerPhone.trim()) {
      const cleanPhone = editCustomerPhone.trim().replace(/[^0-9]/g, '');
      if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
        Alert.alert('Error', 'Please enter a valid 10-digit Indian mobile number');
        return;
      }
    }

    try {
      setLoading(true);
      const res = await apiRequest(`/api/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          vehicleNumber: editVehicleNumber.trim().toUpperCase(),
          brand: editBrand.trim(),
          model: editModel.trim(),
          chassisNumber: editChassisNumber.trim(),
          engineNumber: editEngineNumber.trim(),
          customerName: editCustomerName.trim(),
          customerPhone: editCustomerPhone.trim(),
        }),
      });
      if (res.success) {
        Alert.alert('Success', 'Vehicle details updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              setEditModalVisible(false);
              fetchVehicleDetails();
            }
          }
        ]);
      } else {
        Alert.alert('Error', res.error || 'Failed to update vehicle');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update vehicle');
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

  // Delete vehicle (Admin only)
  const handleDelete = () => {
    if (currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'TENANT_ADMIN') {
      Alert.alert('Permission Denied', 'Only Tenant Admins can delete vehicle records.');
      return;
    }

    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to permanently delete vehicle ${vehicle?.vehicleNumber}? This action is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
    const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN';
    
    Alert.alert('Vehicle Actions', 'Select an action to perform:', [
      {
        text: 'Share Condition Report PDF',
        onPress: downloadAndSharePDF
      },
      {
        text: 'Edit Vehicle Details',
        onPress: () => {
          setEditVehicleNumber(vehicle?.vehicleNumber || '');
          setEditBrand(vehicle?.brand || '');
          setEditModel(vehicle?.model || '');
          setEditChassisNumber(vehicle?.chassisNumber || '');
          setEditEngineNumber(vehicle?.engineNumber || '');
          setEditCustomerName(vehicle?.customerName || '');
          setEditCustomerPhone(vehicle?.customerPhone || '');
          setEditModalVisible(true);
        }
      },
      {
        text: 'Print Gatepass Receipt',
        onPress: handlePrint
      },
      {
        text: 'Share Details Text',
        onPress: () => {
          const detailStr = `Vehicle: ${vehicle?.brand || ''} ${vehicle?.model || ''}\nNumber: ${vehicle?.vehicleNumber}\nStatus: ${vehicle?.yardStatus}\nDays: ${getDurationDays()}\nCharges: ₹${getTotalCharges()}`;
          Alert.alert('Share Details (Simulated)', detailStr);
        }
      },
      ...(isAdmin ? [
        {
          text: 'Delete Vehicle Record',
          style: 'destructive' as const,
          onPress: handleDelete
        }
      ] : []),
      {
        text: 'Cancel',
        style: 'cancel' as const
      }
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <ThemedText style={styles.loadingText}>Fetching details from cloud...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !vehicle) {
    return (
      <ThemedView style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>{error || 'Vehicle not found.'}</ThemedText>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicleDetails}>
          <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#64748B', marginTop: 10 }]} onPress={() => router.back()}>
          <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=400';
  const displayPhoto = vehicle.photos && vehicle.photos.length > 0 ? vehicle.photos[0].s3Url : defaultPhoto;
  
  // Format dates
  const entryDateObj = vehicle.entryDate ? new Date(vehicle.entryDate) : new Date();
  const formattedEntryDate = entryDateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Parser for repoAgency
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

  const parsedRepo = parseRepoAgency(vehicle.repoAgency);

  // Helper to find checklist items (backward compatible with Battery/battry)
  const getInventoryItem = (itemName: string) => {
    const searchName = itemName.toLowerCase() === 'battery' ? 'battry' : itemName;
    return vehicle.inventory?.find((item: any) => 
      item.itemName.toLowerCase() === itemName.toLowerCase() ||
      item.itemName.toLowerCase() === searchName.toLowerCase()
    );
  };

  // Parser for tyre make
  const getTyreMake = (itemName: string) => {
    const item = getInventoryItem(itemName);
    if (!item || !item.isPresent) return 'Absent';
    if (!item.remarks) return 'Present (Unknown Make)';
    const match = item.remarks.match(/\(Tyre Make:\s*(.*?)\)/i);
    const make = match ? match[1]?.trim() : '';
    const cleanRemarks = item.remarks.replace(/\s*\(Tyre Make:\s*.*?\)/i, '').trim();
    return make ? `${make}${cleanRemarks ? ` - ${cleanRemarks}` : ''}` : `Present ${cleanRemarks ? `(${cleanRemarks})` : ''}`;
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

  const renderAccessoryCard = (item: { key: string; label: string }) => {
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
      <View key={item.key} style={[styles.accessoryCard, isPresent ? styles.accessoryPresent : styles.accessoryAbsent]}>
        <View style={styles.accessoryHeader}>
          <ThemedText style={[styles.accessoryLabel, isPresent ? styles.textPresent : styles.textAbsent]}>
            {item.label}
          </ThemedText>
          {isPresent ? (
            <View style={styles.checkIconBg}><ThemedText style={styles.checkIconText}>✓</ThemedText></View>
          ) : (
            <View style={styles.crossIconBg}><ThemedText style={styles.crossIconText}>✗</ThemedText></View>
          )}
        </View>
        {isPresent && subtext ? (
          <ThemedText style={styles.accessorySubtext} numberOfLines={1}>{subtext}</ThemedText>
        ) : null}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Top Header Navigation */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Vehicle Details</ThemedText>
        <TouchableOpacity onPress={handleMoreMenu} style={styles.iconButton} activeOpacity={0.7}>
          <MoreVertical size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Blue Profile Card Banner */}
        <View style={styles.profileCard}>
          <Image source={{ uri: displayPhoto }} style={styles.vehicleThumbnail} />
          <View style={styles.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <ThemedText style={styles.plateNumber}>{vehicle.vehicleNumber.toUpperCase()}</ThemedText>
              {vehicle.serialNumber !== undefined && vehicle.serialNumber !== null && (
                <View style={styles.serialBadge}>
                  <ThemedText style={styles.serialBadgeText}>#{vehicle.serialNumber}</ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={styles.modelName}>
              {vehicle.brand || 'No brand'} {vehicle.model || ''}
            </ThemedText>
            <View style={styles.statusBadge}>
              <ThemedText style={styles.statusBadgeText}>
                {vehicle.yardStatus === 'KACHHA' ? 'In Yard (Kachha)' : vehicle.yardStatus === 'PAKKA' ? 'In Yard' : vehicle.yardStatus}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Card 1: Specifications & Yard Info */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Specifications & Yard Info</ThemedText>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Serial No.</ThemedText>
            <ThemedText style={[styles.detailValue, { color: '#2563EB', fontWeight: '800' }]}>
              #{vehicle.serialNumber || 'N/A'}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Inventory No.</ThemedText>
            <ThemedText style={styles.detailValue}>
              INV-{new Date(vehicle.createdAt).getFullYear()}-{vehicle.id.substring(0, 6).toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Entry Date</ThemedText>
            <ThemedText style={styles.detailValue}>{formattedEntryDate}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Yard Location</ThemedText>
            <ThemedText style={styles.detailValue}>
              {vehicle.yardLocation ? `${vehicle.yardLocation.zone} - ${vehicle.yardLocation.slot}` : 'Awaiting Slot Allocation'}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Vehicle Category</ThemedText>
            <ThemedText style={styles.detailValue}>
              {vehicle.vehicleType === 'TW' ? 'Two Wheeler (2W)' :
               vehicle.vehicleType === 'THREE_W' ? 'Three Wheeler (3W)' :
               vehicle.vehicleType === 'CV' ? 'Commercial Vehicle (CV)' : 'Four Wheeler (4W)'}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Color</ThemedText>
            <ThemedText style={styles.detailValue}>{vehicle.color || 'N/A'}</ThemedText>
          </View>
        </View>

        {/* Card 2: Repossession & Customer Details */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Repossession & Customer Details</ThemedText>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Customer Name</ThemedText>
            <ThemedText style={styles.detailValue}>{vehicle.customerName || 'N/A'}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Customer Mob No.</ThemedText>
            <ThemedText style={styles.detailValue}>{vehicle.customerPhone || 'N/A'}</ThemedText>
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
            <ThemedText style={styles.detailValue}>{vehicle.chassisNumber || 'N/A'}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Engine Number</ThemedText>
            <ThemedText style={styles.detailValue}>{vehicle.engineNumber || 'N/A'}</ThemedText>
          </View>
        </View>

        {/* Card 3: Condition & Remarks */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Condition & Remarks</ThemedText>
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
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Front Tyre Make</ThemedText>
            <ThemedText style={styles.detailValue}>{getTyreMake('Front Tyre')}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Back Tyre Make</ThemedText>
            <ThemedText style={styles.detailValue}>{getTyreMake('Back Tyre')}</ThemedText>
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

        {/* Card 4: Accessories Checklist */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Accessories Checklist</ThemedText>
          <View style={styles.accessoriesGrid}>
            {accessoryItems.map(renderAccessoryCard)}
          </View>
        </View>

        {/* Side-by-Side Slabs Cards */}
        <View style={styles.slabsRow}>
          <View style={styles.slabCard}>
            <Clock size={16} color="#64748B" style={{ marginBottom: 6 }} />
            <ThemedText style={styles.slabTitle}>Parking Duration</ThemedText>
            <ThemedText style={styles.slabValue}>{getDurationDays()} Days</ThemedText>
            <ThemedText style={styles.slabSub}>
              (As on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
            </ThemedText>
          </View>

          <View style={styles.slabCard}>
            <DollarSign size={16} color="#64748B" style={{ marginBottom: 6 }} />
            <ThemedText style={styles.slabTitle}>Total Charges</ThemedText>
            <ThemedText style={[styles.slabValue, { color: '#10B981' }]}>₹{getTotalCharges()}</ThemedText>
            <ThemedText style={styles.slabSub}>
              (₹{getDailyRate()} / Day)
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Kachha → Pakka Action Banner (shown only when KACHHA) */}
      {vehicle.yardStatus === 'KACHHA' && (
        <TouchableOpacity
          style={styles.kachhaBanner}
          onPress={() => router.push({ pathname: '/guard/kachha-to-pakka', params: { id: vehicle.id } })}
          activeOpacity={0.85}
        >
          <View style={styles.kachhaBannerLeft}>
            <View style={styles.kachhaDot} />
            <View>
              <ThemedText style={styles.kachhaBannerTitle}>Billing Not Started Yet</ThemedText>
              <ThemedText style={styles.kachhaBannerSub}>Submit Repo Kit to convert to PAKKA</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.kachhaBannerArrow}>Submit →</ThemedText>
        </TouchableOpacity>
      )}

      {/* Bottom Actions Tab Bar */}
      <View style={styles.actionTabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setPhotosVisible(true)} activeOpacity={0.7}>
          <Camera size={20} color="#2563EB" />
          <ThemedText style={styles.tabLabelText}>Photos</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => router.push({ pathname: '/guard/calculate-charges', params: { id: vehicle.id } })} 
          activeOpacity={0.7}
        >
          <Calculator size={20} color="#2563EB" />
          <ThemedText style={styles.tabLabelText}>Calculate</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => router.push({ pathname: '/guard/check-out', params: { plate: vehicle.vehicleNumber } })} 
          activeOpacity={0.7}
        >
          <Key size={20} color="#2563EB" />
          <ThemedText style={styles.tabLabelText}>Release</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} onPress={handleMoreMenu} activeOpacity={0.7}>
          <MoreHorizontal size={20} color="#2563EB" />
          <ThemedText style={styles.tabLabelText}>More</ThemedText>
        </TouchableOpacity>
      </View>

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
              <ThemedText style={styles.modalTitle}>Inspection Photos</ThemedText>
              <ThemedText style={styles.modalSub}>
                {vehicle.photos?.length || 0} photos captured {selectedPhotos.length > 0 ? `| ${selectedPhotos.length} selected` : ''}
              </ThemedText>
            </View>

            <FlatList
              data={vehicle.photos}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
              columnWrapperStyle={{ gap: 10 }}
              ListEmptyComponent={() => (
                <View style={styles.emptyPhotosContainer}>
                  <Camera size={38} color="#94A3B8" />
                  <ThemedText style={{ color: '#64748B', marginTop: 10 }}>No photos logged for this vehicle.</ThemedText>
                </View>
              )}
              renderItem={({ item }) => {
                const isSelected = selectedPhotos.includes(item.s3Url);
                return (
                  <View style={styles.gridPhotoWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setActivePhotoUrl(item.s3Url)}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <Image source={{ uri: item.s3Url }} style={styles.gridPhoto} />
                    </TouchableOpacity>

                    {/* Selection Checkbox */}
                    <TouchableOpacity
                      style={[styles.photoSelectCheckbox, isSelected && styles.photoSelectCheckboxActive]}
                      onPress={() => togglePhotoSelection(item.s3Url)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.checkboxTick}>{isSelected ? '✓' : ''}</ThemedText>
                    </TouchableOpacity>

                    {/* Single Photo Share Button */}
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

            {/* Batch Sharing Action Bar */}
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

      {/* Fullscreen Photo Viewer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activePhotoUrl !== null}
        onRequestClose={() => setActivePhotoUrl(null)}
      >
        <View style={styles.fullscreenOverlay}>
          {activePhotoUrl && (
            <>
              {/* Top Bar inside Fullscreen Viewer */}
              <View style={styles.fullscreenHeader}>
                <TouchableOpacity
                  onPress={() => setActivePhotoUrl(null)}
                  style={styles.fullscreenHeaderBtn}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.fullscreenHeaderBtnText}>← Back</ThemedText>
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
                    <ThemedText style={styles.fullscreenHeaderBtnText}>Share / Save</ThemedText>
                  )}
                </TouchableOpacity>
              </View>

              {/* Main Photo */}
              <View style={styles.fullscreenImageContainer}>
                <Image
                  source={{ uri: activePhotoUrl }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Charge Calculator Drawer Modal */}
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
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Estimate Parking Fees</ThemedText>
              <ThemedText style={styles.modalSub}>Rate Plan: ₹{getDailyRate()}/Day</ThemedText>
            </View>

            <View style={styles.calcBody}>
              <ThemedText style={styles.calcLabel}>Enter Number of Days</ThemedText>
              <View style={styles.calcInputWrapper}>
                <Clock size={16} color="#64748B" style={{ marginRight: 8 }} />
                <FlatList // A stub flatlist or simple textinput
                  style={{ display: 'none' }}
                  data={[]}
                  renderItem={() => null}
                />
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
                <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Calculate Fees</ThemedText>
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
              <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Vehicle Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '85%' }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Edit Vehicle Details</ThemedText>
                <ThemedText style={styles.modalSub}>Update basic registration and customer info</ThemedText>
              </View>

              <ScrollView style={{ flex: 1, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <View>
                    <ThemedText style={styles.inputLabel}>License Plate *</ThemedText>
                    <TextInput
                      style={styles.textEditInput}
                      value={editVehicleNumber}
                      onChangeText={setEditVehicleNumber}
                      autoCapitalize="characters"
                      placeholder="e.g. MH12PQ1234"
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.inputLabel}>Brand / Maker</ThemedText>
                      <TextInput
                        style={styles.textEditInput}
                        value={editBrand}
                        onChangeText={setEditBrand}
                        placeholder="e.g. Tata Motors"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.inputLabel}>Model Name</ThemedText>
                      <TextInput
                        style={styles.textEditInput}
                        value={editModel}
                        onChangeText={setEditModel}
                        placeholder="e.g. Nexon"
                      />
                    </View>
                  </View>

                  <View>
                    <ThemedText style={styles.inputLabel}>Chassis Number</ThemedText>
                    <TextInput
                      style={styles.textEditInput}
                      value={editChassisNumber}
                      onChangeText={setEditChassisNumber}
                      autoCapitalize="characters"
                      placeholder="Enter Chassis No."
                    />
                  </View>

                  <View>
                    <ThemedText style={styles.inputLabel}>Engine Number</ThemedText>
                    <TextInput
                      style={styles.textEditInput}
                      value={editEngineNumber}
                      onChangeText={setEditEngineNumber}
                      autoCapitalize="characters"
                      placeholder="Enter Engine No."
                    />
                  </View>

                  <View>
                    <ThemedText style={styles.inputLabel}>Customer Name</ThemedText>
                    <TextInput
                      style={styles.textEditInput}
                      value={editCustomerName}
                      onChangeText={setEditCustomerName}
                      placeholder="Enter Customer Name"
                    />
                  </View>

                  <View>
                    <ThemedText style={styles.inputLabel}>Customer Mob No.</ThemedText>
                    <TextInput
                      style={styles.textEditInput}
                      value={editCustomerPhone}
                      onChangeText={(val) => setEditCustomerPhone(val.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      maxLength={10}
                      placeholder="Enter 10 digit Indian number"
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#22C55E' }]}
                  onPress={handleSaveEdit}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Save Changes</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 160,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 18,
    gap: 16,
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  vehicleThumbnail: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  plateNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modelName: {
    fontSize: 13,
    color: '#E0F2FE',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  remarksBlock: {
    marginTop: 4,
    gap: 4,
  },
  remarksLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  remarksValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  serialBadge: {
    backgroundColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serialBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  conditionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bgGood: { backgroundColor: '#DCFCE7' },
  bgAverage: { backgroundColor: '#FEF3C7' },
  bgBad: { backgroundColor: '#FEE2E2' },
  textGood: { color: '#15803D' },
  textAverage: { color: '#B45309' },
  textBad: { color: '#B91C1C' },
  accessoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accessoryCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  accessoryPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  accessoryAbsent: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  accessoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accessoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '80%',
  },
  textPresent: {
    color: '#166534',
  },
  textAbsent: {
    color: '#64748B',
  },
  checkIconBg: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  crossIconBg: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossIconText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  accessorySubtext: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  slabsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  slabCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  slabTitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  slabValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
    marginTop: 6,
    marginBottom: 4,
  },
  slabSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  actionTabBar: {
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
    paddingBottom: 12,
    zIndex: 10,
    elevation: 5,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  emptyPhotosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    width: '100%',
  },
  gridPhotoWrapper: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
  },
  photoTypeTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoTypeTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  closeModalBtn: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  calcBody: {
    gap: 14,
    paddingVertical: 10,
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  calcInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  calcInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  calculateBtn: {
    backgroundColor: '#2563EB',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcResultBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  calcResultTitle: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calcResultValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#166534',
    marginVertical: 4,
  },
  calcResultSub: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
  },
  // Kachha Banner
  kachhaBanner: {
    position: 'absolute',
    bottom: 76,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    elevation: 4,
  },
  kachhaBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kachhaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  kachhaBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  kachhaBannerSub: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '500',
  },
  kachhaBannerArrow: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  photoSelectCheckbox: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSelectCheckboxActive: {
    backgroundColor: '#22C55E',
    borderColor: '#FFFFFF',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  photoShareMiniBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  drawerActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActionBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  drawerActionBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerActionBtnClose: {
    backgroundColor: '#64748B',
    maxWidth: 80,
  },
  drawerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  drawerActionBtnTextSecondary: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  drawerActionBtnTextClose: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  fullscreenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fullscreenHeaderBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  textEditInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  modalActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

