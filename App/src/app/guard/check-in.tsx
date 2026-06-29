import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { queueOfflineJob, getCachedVehicleByNumber } from '@/services/sqlite';
import { apiRequest, getUserInfo } from '@/services/api';
import { bluetoothService } from '@/services/bluetooth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  ImageIcon,
  Trash2,
  Scan,
  Printer,
  Database,
  Building,
  ChevronDown,
  Search,
  Plus,
  Calendar,
  Clock,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// Gurgaon Parking Yard Standard Checklist items
const INITIAL_CHECKLIST = [
  { itemName: 'RC-Original', isPresent: false, remarks: '' },
  { itemName: 'key', isPresent: false, remarks: '' },
  { itemName: 'Battery', isPresent: false, remarks: '' },
  { itemName: 'Horn', isPresent: false, remarks: '' },
  { itemName: 'Front Tyre', isPresent: false, make: '', remarks: '' },
  { itemName: 'Back Tyre', isPresent: false, make: '', remarks: '' },
  { itemName: 'Spare Tyre', isPresent: false, remarks: '' },
  { itemName: 'Tool Kit', isPresent: false, remarks: '' },
  { itemName: 'Side Mirror (Left)', isPresent: false, remarks: '' },
  { itemName: 'Side Mirror (Right)', isPresent: false, remarks: '' },
  { itemName: 'Light Front', isPresent: false, remarks: '' },
  { itemName: 'Light Back', isPresent: false, remarks: '' },
  { itemName: 'Light Indicator', isPresent: false, remarks: '' },
  { itemName: 'Music System', isPresent: false, remarks: '' },
  { itemName: 'Meter Running Condition', isPresent: false, remarks: '' },
];

const uriToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URI to base64:', error);
    return uri;
  }
};

type VehicleType = 'TW' | 'THREE_W' | 'FW' | 'CV';

export default function CheckInScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Bank Selection State
  const [banks, setBanks] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankCategory, setBankCategory] = useState<'direct' | 'third_party' | ''>('');
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState('');
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [bankId, setBankId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pickerMode, setPickerMode] = useState<'direct' | 'third_party' | 'sub'>('direct');

  // Step 1: Specs Form
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('');
  const [vehicleTypePickerVisible, setVehicleTypePickerVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [placeOfPossession, setPlaceOfPossession] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(entryDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setEntryDate(newDate);
      if (Platform.OS === 'android') {
        setTimeout(() => setShowTimePicker(true), 200);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(entryDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setEntryDate(newDate);
    }
  };

  const [repoAgentName, setRepoAgentName] = useState('');
  const [repoAgencyName, setRepoAgencyName] = useState('');

  // Step 2: Photos
  const [photos, setPhotos] = useState<Array<{ type: string; uri: string }>>([]);
  const [extraPhotoSlots, setExtraPhotoSlots] = useState<string[]>([]);

  // Step 3: Checklist / Review
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [bodyCondition, setBodyCondition] = useState<'Good' | 'Average' | 'Bad'>('Average');
  const [yardRemarks, setYardRemarks] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');

  // Tenant Details for Dynamic Prints
  const [tenantName, setTenantName] = useState('SHREE PARKING YARD');
  const [tenantAddress, setTenantAddress] = useState('GURUGRAM VILLAGE, HARYANA');
  const [serialNumber, setSerialNumber] = useState<number | null>(null);

  const checkDuplicateVehicle = async (plateNumber: string) => {
    try {
      const formattedPlate = plateNumber.trim().toUpperCase();
      if (!formattedPlate) return true;

      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        const response = await apiRequest(`/api/vehicles?search=${formattedPlate}`);
        if (response.success && response.data && response.data.length > 0) {
          const matched = response.data.find(
            (v: any) => v.vehicleNumber.toUpperCase() === formattedPlate
          );
          if (matched) {
            if (matched.yardStatus === 'KACHHA' || matched.yardStatus === 'PAKKA') {
              Alert.alert(
                'Vehicle Already In Yard',
                `This vehicle is already inside the yard.\n\nStatus: ${matched.yardStatus}\nIn Yard Date: ${new Date(matched.entryDate).toLocaleString('en-IN')}`,
                [{ text: 'OK' }]
              );
              return false; // block continuation
            } else if (matched.yardStatus === 'RELEASED') {
              const releaseDate = matched.release?.releasedAt 
                ? new Date(matched.release.releasedAt).toLocaleString('en-IN') 
                : 'N/A';
              const releaseReason = matched.release?.releaseType || 'Standard Release';
              return new Promise<boolean>((resolve) => {
                Alert.alert(
                  'Previous Vehicle Record Found',
                  `This vehicle was previously in the yard and released.\n\nIn Yard Date: ${new Date(matched.entryDate).toLocaleString('en-IN')}\nRelease Date: ${releaseDate}\nReason: ${releaseReason}\n\nDo you want to check-in this vehicle again?`,
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Proceed', onPress: () => resolve(true) }
                  ]
                );
              });
            }
          }
        }
      } else {
        // Offline check
        const cached = getCachedVehicleByNumber(formattedPlate);
        if (cached) {
          if (cached.yardStatus === 'KACHHA' || cached.yardStatus === 'PAKKA') {
            Alert.alert(
              'Vehicle Already In Yard (Offline Cache)',
              `This vehicle is already inside the yard.\n\nStatus: ${cached.yardStatus}\nIn Yard Date: ${cached.entryDate ? new Date(cached.entryDate).toLocaleString('en-IN') : 'N/A'}`,
              [{ text: 'OK' }]
            );
            return false;
          } else if (cached.yardStatus === 'RELEASED') {
            return new Promise<boolean>((resolve) => {
              Alert.alert(
                'Previous Vehicle Record Found (Offline Cache)',
                `This vehicle was previously in the yard and released.\n\nIn Yard Date: ${cached.entryDate ? new Date(cached.entryDate).toLocaleString('en-IN') : 'N/A'}\n\nDo you want to check-in this vehicle again?`,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Proceed', onPress: () => resolve(true) }
                ]
              );
            });
          }
        }
      }
      return true;
    } catch (err) {
      console.warn('Failed to verify duplicate vehicle:', err);
      return true; // fail-open so operations aren't blocked
    }
  };

  const loadBanks = useCallback(async () => {
    setLoadingBanks(true);
    try {
      const res = await apiRequest('/api/banks');
      if (res.success && res.data) {
        setBanks(res.data);
      }
    } catch (e) {
      console.warn('[CheckIn] Failed to load banks:', e);
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    loadBanks();

    // Fetch registered tenant info on load
    const fetchTenantDetails = async () => {
      try {
        const userInfo = await getUserInfo();
        if (userInfo && userInfo.tenant) {
          if (userInfo.tenant.yardName) {
            setTenantName(userInfo.tenant.yardName);
          }
          if (userInfo.tenant.address) {
            setTenantAddress(userInfo.tenant.address);
          }
        }
      } catch (err) {
        console.warn('Failed to load tenant details for printing:', err);
      }
    };
    fetchTenantDetails();
  }, []);

  // OCR Plate Scanner Simulation States
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanningStatus, setScanningStatus] = useState('Aligning viewfinder...');

  const toggleChecklistItem = (index: number) => {
    const updated = [...checklist];
    updated[index].isPresent = !updated[index].isPresent;
    setChecklist(updated);
  };

  const handleChecklistRemarks = (index: number, text: string) => {
    const updated = [...checklist];
    updated[index].remarks = text;
    setChecklist(updated);
  };

  const handleChecklistMake = (index: number, text: string) => {
    const updated = [...checklist];
    updated[index].make = text;
    setChecklist(updated);
  };

  const addExtraPhotoSlot = () => {
    const nextIndex = extraPhotoSlots.length + 1;
    const newSlot = `extra_${nextIndex}`;
    setExtraPhotoSlots((prev) => [...prev, newSlot]);
  };

  const takePhoto = async (photoType: string) => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to capture vehicle handover photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const originalUri = result.assets[0].uri;

        // Perform compression using ImageManipulator
        const compressed = await ImageManipulator.manipulateAsync(
          originalUri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Save photo details
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.type !== photoType);
          return [...filtered, { type: photoType, uri: compressed.uri }];
        });
      }
    } catch (error) {
      console.error('[CheckIn] Photo capturing failed:', error);
      Alert.alert('Camera Error', 'Could not open camera');
    }
  };

  const deletePhoto = (photoType: string) => {
    setPhotos((prev) => prev.filter((p) => p.type !== photoType));
  };

  const generateHTMLReport = async () => {
    // Convert all photos to base64 and display in a clean 3-column layout (fit containment)
    const photoElements = await Promise.all(
      photos.map(async (p) => {
        const base64 = await uriToBase64(p.uri);
        return `
          <div style="width: 31.3%; margin: 1%; text-align: center; border: 1px solid #cbd5e1; padding: 4px; border-radius: 6px; box-sizing: border-box; background-color: #f1f5f9; page-break-inside: avoid;">
            <p style="margin: 0 0 4px 0; font-size: 8px; font-weight: bold; text-transform: uppercase; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.type.replace('_', ' ')}</p>
            <img src="${base64}" style="width: 100%; height: 100px; object-fit: contain; background-color: #e2e8f0; border-radius: 4px;" />
          </div>
        `;
      })
    );

    // Group the checklist items in a 2-column layout to save vertical space
    let checklistRows = '';
    for (let i = 0; i < checklist.length; i += 2) {
      const item1 = checklist[i];
      const item2 = checklist[i + 1];

      const renderCell = (item: any) => {
        if (!item) return '<td style="border: 1px solid #cbd5e1; width: 50%;"></td>';
        let details = '';
        if (item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre') {
          details = item.make ? ` (${item.make})` : '';
        }
        
        const isPresentBadge = item.isPresent
          ? '<span style="background-color: #def7ec; color: #03543f; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 9px; text-transform: uppercase;">YES</span>'
          : '<span style="background-color: #fde8e8; color: #9b1c1c; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 9px; text-transform: uppercase;">NO</span>';

        return `
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; width: 50%; color: #0f172a; line-height: 1.3;">
            <span style="font-weight: 700; color: #334155;">${item.itemName}${details}:</span> ${isPresentBadge} ${item.remarks ? `<span style="font-size: 10px; color: #64748b; font-style: italic;">[${item.remarks}]</span>` : ''}
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
            <td><strong>License Plate:</strong> ${vehicleNumber.toUpperCase()}</td>
            <td><strong>Vehicle Category:</strong> ${
              vehicleType === 'TW'
                ? '2 Wheeler (TW)'
                : vehicleType === 'THREE_W'
                ? '3 Wheeler (THREE_W)'
                : vehicleType === 'FW'
                ? '4 Wheeler (FW)'
                : vehicleType === 'CV'
                ? 'Commercial Vehicle (CV)'
                : '-'
            }</td>
          </tr>
          <tr>
            <td><strong>Brand / Maker:</strong> ${brand || '-'}</td>
            <td><strong>Model Name:</strong> ${model || '-'}</td>
          </tr>
          <tr>
            <td><strong>Engine Number:</strong> ${engineNumber || '-'}</td>
            <td><strong>Chassis Number:</strong> ${chassisNumber || '-'}</td>
          </tr>
          <tr>
            <td><strong>Entry Date & Time:</strong> ${entryDate.toLocaleString('en-IN')}</td>
            <td><strong>Possession Place:</strong> ${placeOfPossession || '-'}</td>
          </tr>
        </table>

        <div class="section-title">Financer & Repossession Info</div>
        <table class="info-table">
          <tr>
            <td><strong>Financer Category:</strong> ${bankCategory === 'direct' ? 'Direct Bank' : 'Third Party'}</td>
            <td><strong>Bank / Financer Name:</strong> ${bankName || '-'}</td>
          </tr>
          <tr>
            <td><strong>Repo Agency:</strong> ${repoAgencyName || '-'}</td>
            <td><strong>Repo Agent Name:</strong> ${repoAgentName || '-'}</td>
          </tr>
          <tr>
            <td><strong>Customer Name:</strong> ${customerName || '-'}</td>
            <td><strong>Customer Mobile:</strong> ${customerPhone || '-'}</td>
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

  const printAirPrint = async () => {
    try {
      setSubmitting(true);
      const html = await generateHTMLReport();
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert('AirPrint Error', e.message || 'Could not trigger AirPrint');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadAndSharePDF = async () => {
    try {
      setSubmitting(true);
      const html = await generateHTMLReport();
      const { uri } = await Print.printToFileAsync({ html });

      // Clean vehicle number to form a safe, lowercase alphanumeric filename
      const cleanPlate = vehicleNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `${cleanPlate || 'vehicle'}.pdf`;
      const targetUri = `${FileSystem.cacheDirectory}${filename}`;

      // Copy the file to specify custom filename on sharing
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });

      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${vehicleNumber.toUpperCase()} Gate Pass`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message || 'Could not generate or share PDF');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Error', 'License plate number is required');
      return;
    }
    if (!vehicleType) {
      Alert.alert('Error', 'Vehicle category is required');
      return;
    }

    setSubmitting(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      const combinedRepoAgency = `Agency: ${repoAgencyName.trim()} | Agent: ${repoAgentName.trim()} | Place: ${placeOfPossession.trim()}`;

      const databaseChecklist = [
        ...checklist.map(item => {
          if (item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre') {
            return {
              itemName: item.itemName,
              isPresent: item.isPresent,
              remarks: `${item.remarks || ''} (Tyre Make: ${item.make || 'Unknown'})`.trim(),
            };
          }
          return {
            itemName: item.itemName,
            isPresent: item.isPresent,
            remarks: item.remarks || '',
          };
        }),
        { itemName: 'Body Condition', isPresent: true, remarks: bodyCondition },
        { itemName: 'Yard Remarks', isPresent: true, remarks: yardRemarks },
        { itemName: 'Customer Remarks', isPresent: true, remarks: customerRemarks },
      ];

      const payload = {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType,
        brand: brand.trim(),
        model: model.trim(),
        bankName: bankName.trim(),
        bankId: bankId || undefined,
        chassisNumber: chassisNumber.trim() || undefined,
        engineNumber: engineNumber.trim() || undefined,
        repoAgency: combinedRepoAgency,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        inventory: databaseChecklist,
        entryDate: entryDate.toISOString(),
      };

      if (isOnline) {
        console.log('[CheckIn] App is online. Direct upload...');
        setIsOfflineSaved(false);
        
        // Step 1: Submit vehicle basic specs
        const checkinResponse = await apiRequest('/api/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const vehicleId = checkinResponse.data.id;
        const sNo = checkinResponse.data.serialNumber;
        setSerialNumber(sNo || null);
        console.log(`[CheckIn] Vehicle entry created in DB: ${vehicleId}, Serial: ${sNo}`);

        // Step 2: Upload images to presigned URL
        for (const photo of photos) {
          try {
            const presignedRes = await apiRequest(
              `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=100000`
            );
            const { uploadUrl, publicUrl } = presignedRes.data;

            if (uploadUrl.includes('mock-s3-bucket')) {
              console.log('[CheckIn] Simulating mock photo upload...');
            } else {
              const fileBlob = await fetch(photo.uri).then((r) => r.blob());
              await fetch(uploadUrl, {
                method: 'PUT',
                body: fileBlob,
                headers: { 'Content-Type': 'image/jpeg' },
              });
            }

            // Reference upload in database
            await apiRequest(`/api/vehicles/${vehicleId}/photos`, {
              method: 'POST',
              body: JSON.stringify({
                photoType: photo.type,
                s3Url: publicUrl,
                fileSize: 100000,
              }),
            });
          } catch (photoErr) {
            console.error(`[CheckIn] Failed to upload photo type ${photo.type}:`, photoErr);
          }
        }
        
        // Advance to success page
        setStep(4);
      } else {
        // App is offline, queue to local SQLite queue
        console.log('[CheckIn] App is offline. Queuing in SQLite...');
        setIsOfflineSaved(true);
        setSerialNumber(null);
        queueOfflineJob('CHECK_IN', payload, photos);
        
        // Advance to success page
        setStep(4);
      }
    } catch (error: any) {
      console.error('[CheckIn] Submit Error:', error);
      Alert.alert('Submission Error', error.message || 'Verification / submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarcodeScan = () => {
    setScannerVisible(true);
    setScanningStatus('Aligning plate viewfinder...');

    setTimeout(() => {
      setScanningStatus('Reading characters...');
      
      setTimeout(() => {
        setScanningStatus('Extracting vehicle number...');
        
        setTimeout(() => {
          const plates = ['MH-12-PQ-9876', 'DL-3C-AY-4321', 'HR-26-BQ-8811', 'KA-03-MM-5566', 'MH-14-EU-2045'];
          const randomPlate = plates[Math.floor(Math.random() * plates.length)];
          setVehicleNumber(randomPlate);
          setScannerVisible(false);
        }, 700);
      }, 700);
    }, 700);
  };

  const printGatePass = async () => {
    const payload = {
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleType: vehicleType || 'FW',
      brand: brand.trim(),
      model: model.trim(),
      bankName: bankName.trim(),
      chassisNumber: chassisNumber.trim(),
      inventory: checklist,
    };
    try {
      const text = bluetoothService.generateGatePassReceipt(payload);
      await bluetoothService.printReceipt(text);
      Alert.alert('Success', 'Receipt sent to paired thermal printer.');
    } catch (e: any) {
      Alert.alert('Print Error', e.message || 'Could not print gate pass');
    }
  };

  // Render photo section slot
  const renderPhotoSlot = (photoType: string, label: string) => {
    const existing = photos.find((p) => p.type === photoType);

    return (
      <View style={styles.photoSlot} key={photoType}>
        <ThemedText style={styles.photoLabel}>{label}</ThemedText>
        {existing ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: existing.uri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.deletePhotoBtn}
              onPress={() => deletePhoto(photoType)}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => takePhoto(photoType)}
            activeOpacity={0.7}
          >
            <View style={styles.cameraIconBg}>
              <Camera size={18} color="#059669" />
            </View>
            <ThemedText style={styles.captureBtnText}>Tap to Capture</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPhotoSlots = () => {
    const standardSlots = [
      { key: 'customer', label: 'Customer with Vehicle' },
      { key: 'front', label: 'Front View' },
      { key: 'back', label: 'Rear View' },
      { key: 'right', label: 'Right Profile' },
      { key: 'left', label: 'Left Profile' },
      { key: 'engine', label: 'Engine Number' },
      { key: 'chassis', label: 'Chassis Number' },
    ];

    return (
      <View style={styles.photoGrid}>
        {standardSlots.map((slot) => renderPhotoSlot(slot.key, slot.label))}
        {extraPhotoSlots.map((slot, index) => renderPhotoSlot(slot, `Extra Photo ${index + 1}`))}
        
        {/* Dynamic "+" Button */}
        <TouchableOpacity
          style={styles.addExtraPhotoSlotBtn}
          onPress={addExtraPhotoSlot}
          activeOpacity={0.7}
        >
          <Plus size={24} color="#2563EB" />
          <ThemedText style={styles.addExtraPhotoSlotText}>Add More Photo</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
      style={{ flex: 1 }}
    >
      <ThemedView style={styles.container}>
      {/* Wizard Header Bar */}
      <View style={styles.header}>
        {step < 4 ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <ThemedText style={styles.headerTitle}>
          {step === 4 ? 'Status Screen' : 'New Vehicle Entry'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Wizard Steps Indicator (Only visible if not on success screen) */}
      {step < 4 && (
        <View style={styles.progressRow}>
          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.progressStep, step >= 1 && styles.progressActive]}>
              <FileText size={14} color={step >= 1 ? '#FFFFFF' : '#64748B'} />
            </View>
            <ThemedText style={[styles.stepText, step >= 1 && styles.stepTextActive]}>Basic Info</ThemedText>
          </View>
          
          <View style={[styles.progressLine, step >= 2 && styles.lineActive]} />
          
          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.progressStep, step >= 2 && styles.progressActive]}>
              <ImageIcon size={14} color={step >= 2 ? '#FFFFFF' : '#64748B'} />
            </View>
            <ThemedText style={[styles.stepText, step >= 2 && styles.stepTextActive]}>Photos</ThemedText>
          </View>
          
          <View style={[styles.progressLine, step >= 3 && styles.lineActive]} />
          
          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.progressStep, step >= 3 && styles.progressActive]}>
              <ClipboardList size={14} color={step >= 3 ? '#FFFFFF' : '#64748B'} />
            </View>
            <ThemedText style={[styles.stepText, step >= 3 && styles.stepTextActive]}>Review</ThemedText>
          </View>
        </View>
      )}

      {/* Forms Section */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={styles.stepContainer}>
            <ThemedText style={styles.stepTitle}>Vehicle Information</ThemedText>
            
            {/* Bank Category & Bank Select Side-by-Side */}
            <View style={styles.sideBySideRow}>
              {/* Category Dropdown */}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.fieldLabel}>Bank Category *</ThemedText>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setCategoryPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.pickerBtnText, !bankCategory && { color: '#94A3B8' }]} numberOfLines={1}>
                    {bankCategory === 'direct' ? 'Direct Bank' : bankCategory === 'third_party' ? 'Third Party' : '-- Select --'}
                  </ThemedText>
                  <ChevronDown size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Bank/Group Dropdown */}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.fieldLabel}>Select Bank/Group *</ThemedText>
                <TouchableOpacity
                  style={[styles.pickerBtn, !bankCategory && { opacity: 0.5 }]}
                  disabled={!bankCategory}
                  onPress={() => {
                    if (bankCategory === 'direct') {
                      setPickerMode('direct');
                      setBankSearch('');
                      setBankPickerVisible(true);
                    } else if (bankCategory === 'third_party') {
                      setPickerMode('third_party');
                      setBankSearch('');
                      setBankPickerVisible(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.pickerBtnText, !bankName && !selectedGroupName && { color: '#94A3B8' }]} numberOfLines={1}>
                    {bankCategory === 'third_party' 
                      ? (selectedGroupName || '-- Select Group --')
                      : (bankName || '-- Select Bank --')}
                  </ThemedText>
                  <ChevronDown size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-bank picker — shown after selecting parent */}
            {bankCategory === 'third_party' && selectedThirdPartyId && (
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Select Sub-Bank *</ThemedText>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => { setPickerMode('sub'); setBankSearch(''); setBankPickerVisible(true); }}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.pickerBtnText, !bankName && { color: '#94A3B8' }]}>
                    {bankName || '-- Select Sub-Bank --'}
                  </ThemedText>
                  <ChevronDown size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            {/* License Plate */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>License Plate *</ThemedText>
              <View style={styles.inputSearchWrapper}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  placeholder="e.g. MH-12-PQ-1234"
                  placeholderTextColor="#94A3B8"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={handleBarcodeScan}
                  activeOpacity={0.8}
                >
                  <Scan size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Vehicle Category Dropdown */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Vehicle Category *</ThemedText>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setVehicleTypePickerVisible(true)}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.pickerBtnText, !vehicleType && { color: '#94A3B8' }]}>
                  {vehicleType === 'TW'
                    ? '2 Wheeler (TW)'
                    : vehicleType === 'THREE_W'
                    ? '3 Wheeler (THREE_W)'
                    : vehicleType === 'FW'
                    ? '4 Wheeler (FW)'
                    : vehicleType === 'CV'
                    ? 'Commercial (CV)'
                    : '-- Select Vehicle Category --'}
                </ThemedText>
                <ChevronDown size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Customer Name */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Customer Name *</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="Enter customer name"
                placeholderTextColor="#94A3B8"
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            {/* Customer Mob NO */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Customer Mob NO</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="Enter customer mobile number"
                placeholderTextColor="#94A3B8"
                value={customerPhone}
                onChangeText={(text) => setCustomerPhone(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* Vehicle Make */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Vehicle Make</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Tata Motors, Maruti Suzuki"
                placeholderTextColor="#94A3B8"
                value={brand}
                onChangeText={setBrand}
              />
            </View>

            {/* Model Name */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Model Name</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Swift, Nexon"
                placeholderTextColor="#94A3B8"
                value={model}
                onChangeText={setModel}
              />
            </View>

            {/* Chassis NO */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Chassis NO</ThemedText>
              <View style={styles.naRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Enter chassis number"
                  placeholderTextColor="#94A3B8"
                  value={chassisNumber}
                  onChangeText={setChassisNumber}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.naBtn} onPress={() => setChassisNumber('NA')} activeOpacity={0.7}>
                  <ThemedText style={styles.naBtnText}>NA</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Engine No */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Engine No</ThemedText>
              <View style={styles.naRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Enter engine number"
                  placeholderTextColor="#94A3B8"
                  value={engineNumber}
                  onChangeText={setEngineNumber}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.naBtn} onPress={() => setEngineNumber('NA')} activeOpacity={0.7}>
                  <ThemedText style={styles.naBtnText}>NA</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Place */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Place of Possession</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Gurugram, Delhi"
                placeholderTextColor="#94A3B8"
                value={placeOfPossession}
                onChangeText={setPlaceOfPossession}
              />
            </View>

            {/* Date & Time with Edit Calendar option */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Date & Time *</ThemedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.pickerBtn, { flex: 1 }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.pickerBtnText}>
                    {entryDate.toLocaleDateString('en-IN')}
                  </ThemedText>
                  <Calendar size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerBtn, { flex: 1 }]}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.pickerBtnText}>
                    {entryDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                  <Clock size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Repo Agent Name */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Repo Agent Name</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="Enter repo agent name"
                placeholderTextColor="#94A3B8"
                value={repoAgentName}
                onChangeText={setRepoAgentName}
              />
            </View>

            {/* Repo Agency Name */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Repo Agency Name</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="Enter repo agency name"
                placeholderTextColor="#94A3B8"
                value={repoAgencyName}
                onChangeText={setRepoAgencyName}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepInfoBlock}>
              <ThemedText style={styles.stepTitle}>Inspection Photos</ThemedText>
              <ThemedText style={styles.stepSubtitle}>
                Capture required photos and add any extra viewpoints as needed.
              </ThemedText>
            </View>
            {renderPhotoSlots()}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <ThemedText style={styles.stepTitle}>Review & Inventory Details</ThemedText>

            {/* Basic Info Summary Card */}
            <View style={styles.summarySectionCard}>
              <ThemedText style={styles.summarySectionHeader}>Vehicle Specifications</ThemedText>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>License Plate:</ThemedText>
                <ThemedText style={styles.summaryValue}>{vehicleNumber.toUpperCase()}</ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Type Class:</ThemedText>
                <ThemedText style={styles.summaryValue}>{vehicleType}</ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Brand / Model:</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {brand || 'N/A'} / {model || 'N/A'}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Bank / Party:</ThemedText>
                <ThemedText style={styles.summaryValue}>{bankName || 'N/A'}</ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Chassis Number:</ThemedText>
                <ThemedText style={styles.summaryValue}>{chassisNumber || 'N/A'}</ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Customer Name:</ThemedText>
                <ThemedText style={styles.summaryValue}>{customerName || 'N/A'}</ThemedText>
              </View>
            </View>

            {/* Photos Summary Bar */}
            <View style={styles.summarySectionCard}>
              <ThemedText style={styles.summarySectionHeader}>Captured Photos</ThemedText>
              <View style={styles.photosThumbRow}>
                {photos.length === 0 ? (
                  <ThemedText style={{ color: '#64748B', fontSize: 13 }}>No inspection photos captured.</ThemedText>
                ) : (
                  photos.map((p) => (
                    <View key={p.type} style={styles.photoThumbWrapper}>
                      <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                      <View style={styles.photoThumbLabelBg}>
                        <ThemedText style={styles.photoThumbLabel}>{p.type}</ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Checklist items list */}
            <View style={styles.summarySectionCard}>
              <ThemedText style={styles.summarySectionHeader}>Accessories Inventory</ThemedText>
              {checklist.map((item, index) => {
                const isTyre = item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre';
                return (
                  <View key={item.itemName} style={styles.checklistRow}>
                    <View style={styles.checkTitleRow}>
                      <Switch
                        value={item.isPresent}
                        onValueChange={() => toggleChecklistItem(index)}
                        trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                        thumbColor={item.isPresent ? '#059669' : '#94A3B8'}
                      />
                      <ThemedText style={[styles.checkItemName, item.isPresent && { color: '#0F172A', fontWeight: '700' }]}>
                        {item.itemName}
                      </ThemedText>
                    </View>

                    {item.isPresent && (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        {isTyre && (
                          <TextInput
                            style={styles.checkRemarksInput}
                            placeholder="Enter Tyre Company Name (e.g. CEAT, TVS)"
                            placeholderTextColor="#94A3B8"
                            value={item.make || ''}
                            onChangeText={(text) => handleChecklistMake(index, text)}
                          />
                        )}
                        <TextInput
                          style={styles.checkRemarksInput}
                          placeholder="Add remarks (optional)"
                          placeholderTextColor="#94A3B8"
                          value={item.remarks}
                          onChangeText={(text) => handleChecklistRemarks(index, text)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Body Condition Selector */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <ThemedText style={styles.fieldLabel}>Body Condition *</ThemedText>
                <View style={styles.bodyConditionRow}>
                  {(['Good', 'Average', 'Bad'] as const).map((cond) => (
                    <TouchableOpacity
                      key={cond}
                      style={[styles.bodyConditionOption, bodyCondition === cond && styles.bodyConditionOptionSelected]}
                      onPress={() => setBodyCondition(cond)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.bodyConditionOptionText, bodyCondition === cond && styles.bodyConditionOptionTextSelected]}>
                        {cond}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Yard Remarks */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <ThemedText style={styles.fieldLabel}>Yard Remarks</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter remarks for the yard"
                  placeholderTextColor="#94A3B8"
                  value={yardRemarks}
                  onChangeText={setYardRemarks}
                />
              </View>

              {/* Customer Remarks */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <ThemedText style={styles.fieldLabel}>Customer Remarks</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter remarks from the customer"
                  placeholderTextColor="#94A3B8"
                  value={customerRemarks}
                  onChangeText={setCustomerRemarks}
                />
              </View>
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.successWrapper}>
            <View style={styles.successCheckCircle}>
              <Check size={48} color="#FFFFFF" />
            </View>
            
            <ThemedText style={styles.successTitle}>Inventory Generated</ThemedText>
            <ThemedText style={styles.successSubtitle}>
              Vehicle record has been saved successfully.
            </ThemedText>

            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <Database size={16} color="#2563EB" />
                <ThemedText style={styles.receiptTitle}>गुरुग्राम Parking Yard Copy</ThemedText>
              </View>

              <View style={styles.receiptDashedLine} />

              <View style={styles.receiptBody}>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>SERIAL NUMBER</ThemedText>
                  <ThemedText style={styles.receiptVal}>{serialNumber ? `#${serialNumber}` : 'Pending Sync'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>LICENSE PLATE</ThemedText>
                  <ThemedText style={styles.receiptVal}>{vehicleNumber.toUpperCase()}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>VEHICLE TYPE</ThemedText>
                  <ThemedText style={styles.receiptVal}>{vehicleType}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>MAKE / MODEL</ThemedText>
                  <ThemedText style={styles.receiptVal}>{brand || 'N/A'} / {model || 'N/A'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>FINANCER / BANK</ThemedText>
                  <ThemedText style={styles.receiptVal}>{bankName || 'N/A'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>REPO AGENCY / AGENT</ThemedText>
                  <ThemedText style={styles.receiptVal} numberOfLines={1}>{repoAgencyName || 'N/A'} / {repoAgentName || 'N/A'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>CUSTOMER NAME</ThemedText>
                  <ThemedText style={styles.receiptVal}>{customerName || 'N/A'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>POSSESSION PLACE</ThemedText>
                  <ThemedText style={styles.receiptVal}>{placeOfPossession || 'N/A'}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>DATE & TIME</ThemedText>
                  <ThemedText style={styles.receiptVal}>{entryDate.toLocaleString('en-IN')}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={styles.receiptLabel}>SYNC STATUS</ThemedText>
                  <ThemedText style={[styles.receiptVal, { color: isOfflineSaved ? '#B45309' : '#059669', fontWeight: 'bold' }]}>
                    {isOfflineSaved ? 'Queued Offline (SQLite)' : 'Online API Synced'}
                  </ThemedText>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.printActionBtn}
              onPress={printAirPrint}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <FileText size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <ThemedText style={styles.printActionBtnText}>Print Invoice/PDF (AirPrint)</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.printActionBtn, { backgroundColor: '#10B981', shadowColor: '#10B981' }]}
              onPress={downloadAndSharePDF}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <Plus size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <ThemedText style={styles.printActionBtnText}>Download & Share PDF</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.printActionBtn, { backgroundColor: '#475569', shadowColor: '#475569' }]}
              onPress={printGatePass}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <Printer size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <ThemedText style={styles.printActionBtnText}>Print Slip (Thermal)</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneActionBtn}
              onPress={() => router.replace('/admin/dashboard')}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.doneActionBtnText}>Go to Home Dashboard</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Controls Row */}
        {step < 4 && (
          <View style={styles.actionRow}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.btn, styles.secondaryBtn]}
                onPress={() => setStep(step - 1)}
                activeOpacity={0.7}
              >
                <ChevronLeft size={16} color="#0F172A" />
                <ThemedText style={styles.secondaryBtnText}>
                  Back
                </ThemedText>
              </TouchableOpacity>
            )}

            {step < 3 ? (
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={async () => {
                  if (step === 1) {
                    if (!bankCategory) {
                      Alert.alert('Error', 'Please select a bank category');
                      return;
                    }
                    if (bankCategory === 'direct' && !bankName) {
                      Alert.alert('Error', 'Please select a Direct Bank');
                      return;
                    }
                    if (bankCategory === 'third_party' && (!selectedThirdPartyId || !bankName)) {
                      Alert.alert('Error', 'Please select a Third Party Group and Sub-Bank');
                      return;
                    }
                    if (!vehicleNumber.trim()) {
                      Alert.alert('Error', 'Please enter license plate number');
                      return;
                    }
                    if (!vehicleType) {
                      Alert.alert('Error', 'Please select a vehicle category');
                      return;
                    }
                    if (!customerName.trim()) {
                      Alert.alert('Error', 'Customer name is required');
                      return;
                    }
                    if (customerPhone.trim()) {
                      const cleanPhone = customerPhone.trim().replace(/[^0-9]/g, '');
                      if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
                        Alert.alert('Error', 'Please enter a valid 10-digit Indian mobile number');
                        return;
                      }
                    }

                    // Run duplicate checks
                    setSubmitting(true);
                    const canContinue = await checkDuplicateVehicle(vehicleNumber);
                    setSubmitting(false);
                    if (!canContinue) return;
                  }
                  setStep(step + 1);
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.primaryBtnText}>
                  Continue
                </ThemedText>
                <ChevronRight size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.successBtn]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.successBtnText}>Complete Check-In</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* OCR plate scanner overlay simulator */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={scannerVisible}
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerContainer}>
            <ThemedText style={styles.scannerHeader}>License Plate OCR Scanner</ThemedText>
            
            <View style={styles.viewfinder}>
              <View style={styles.viewfinderCornerTL} />
              <View style={styles.viewfinderCornerTR} />
              <View style={styles.viewfinderCornerBL} />
              <View style={styles.viewfinderCornerBR} />
              <View style={styles.laserLine} />
              
              <ThemedText style={styles.viewfinderText}>ALIGN NUMBER PLATE HERE</ThemedText>
            </View>

            <View style={styles.scanStatusBox}>
              <ActivityIndicator color="#10B981" size="small" style={{ marginRight: 10 }} />
              <ThemedText style={styles.scanStatusText}>{scanningStatus}</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.cancelScanBtn}
              onPress={() => setScannerVisible(false)}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Cancel Scan</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={categoryPickerVisible}
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalHeader}>Select Bank Category</ThemedText>
            
            <TouchableOpacity
              style={styles.bankOptionRow}
              onPress={() => {
                setBankCategory('direct');
                setBankId('');
                setBankName('');
                setSelectedThirdPartyId('');
                setSelectedGroupName('');
                setCategoryPickerVisible(false);
                setTimeout(() => {
                  setPickerMode('direct');
                  setBankSearch('');
                  setBankPickerVisible(true);
                }, 300);
              }}
              activeOpacity={0.7}
            >
              <Building size={16} color="#2563EB" style={{ marginRight: 10 }} />
              <ThemedText style={styles.bankOptionName}>Direct Bank</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bankOptionRow}
              onPress={() => {
                setBankCategory('third_party');
                setBankId('');
                setBankName('');
                setSelectedThirdPartyId('');
                setSelectedGroupName('');
                setCategoryPickerVisible(false);
                setTimeout(() => {
                  setPickerMode('third_party');
                  setBankSearch('');
                  setBankPickerVisible(true);
                }, 300);
              }}
              activeOpacity={0.7}
            >
              <Building size={16} color="#2563EB" style={{ marginRight: 10 }} />
              <ThemedText style={styles.bankOptionName}>Third Party</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneActionBtn, { marginTop: 16 }]}
              onPress={() => setCategoryPickerVisible(false)}
            >
              <ThemedText style={styles.doneActionBtnText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vehicle Type Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={vehicleTypePickerVisible}
        onRequestClose={() => setVehicleTypePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalHeader}>Select Vehicle Category</ThemedText>
            
            {([
              { key: 'TW', label: '2 Wheeler' },
              { key: 'THREE_W', label: '3 Wheeler' },
              { key: 'FW', label: '4 Wheeler' },
              { key: 'CV', label: 'Commercial' }
            ] as const).map((vt) => (
              <TouchableOpacity
                key={vt.key}
                style={styles.bankOptionRow}
                onPress={() => {
                  setVehicleType(vt.key);
                  setVehicleTypePickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.bankOptionName}>{vt.label}</ThemedText>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.doneActionBtn, { marginTop: 16 }]}
              onPress={() => setVehicleTypePickerVisible(false)}
            >
              <ThemedText style={styles.doneActionBtnText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bank Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bankPickerVisible}
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalHeader}>
                {pickerMode === 'direct' ? 'Select Direct Bank' : pickerMode === 'third_party' ? 'Select Third Party Group' : 'Select Sub-Bank'}
              </ThemedText>

            <View style={styles.modalSearchBox}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search bank name..."
                placeholderTextColor="#94A3B8"
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(() => {
                let options: any[] = [];
                if (pickerMode === 'direct') {
                  options = banks.filter(b => !b.isThirdParty && !b.parentId);
                } else if (pickerMode === 'third_party') {
                  options = banks.filter(b => b.isThirdParty);
                } else {
                  options = banks.filter(b => b.parentId === selectedThirdPartyId);
                }
                const filtered = bankSearch.trim()
                  ? options.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
                  : options;

                if (filtered.length === 0) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ThemedText style={{ color: '#94A3B8', fontSize: 13 }}>No banks found</ThemedText>
                    </View>
                  );
                }

                return filtered.map((b: any) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.bankOptionRow}
                    onPress={() => {
                      if (pickerMode === 'third_party') {
                        setSelectedThirdPartyId(b.id);
                        setSelectedGroupName(b.name);
                        setBankId('');
                        setBankName('');
                        setPickerMode('sub');
                        setBankSearch('');
                        return;
                      } else {
                        setBankId(b.id);
                        setBankName(b.name);
                        setBankPickerVisible(false);
                        // Auto-open Vehicle Category picker next
                        setTimeout(() => {
                          setVehicleTypePickerVisible(true);
                        }, 300);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Building size={16} color="#2563EB" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.bankOptionName}>{b.name}</ThemedText>
                      {b.parkingRates && b.parkingRates.length > 0 && (
                        <ThemedText style={styles.bankOptionRate}>
                          Rates: TW ₹{b.parkingRates.find((r: any) => r.vehicleType === 'TW')?.dailyRate ?? '-'} · FW ₹{b.parkingRates.find((r: any) => r.vehicleType === 'FW')?.dailyRate ?? '-'}
                        </ThemedText>
                      )}
                    </View>
                    {((pickerMode !== 'third_party' && bankId === b.id) || (pickerMode === 'third_party' && selectedThirdPartyId === b.id)) && (
                      <Check size={16} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneActionBtn, { marginTop: 16 }]}
              onPress={() => setBankPickerVisible(false)}
            >
              <ThemedText style={styles.doneActionBtnText}>Cancel</ThemedText>
            </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={entryDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={entryDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepIndicatorWrapper: {
    alignItems: 'center',
    gap: 3,
  },
  progressStep: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  progressLine: {
    height: 2,
    width: 40,
    backgroundColor: '#E2E8F0',
    marginTop: -12,
  },
  lineActive: {
    backgroundColor: '#2563EB',
  },
  stepText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 80,
  },
  stepContainer: {
    gap: 12,
  },
  stepInfoBlock: {
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  inputSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#0F172A',
    height: 42,
    fontSize: 14,
  },
  scanBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#2563EB',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classOption: {
    flex: 1,
    minWidth: '45%',
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  classOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  classOptionText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  classOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  summarySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 8,
  },
  summarySectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  photosThumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbWrapper: {
    width: 74,
    height: 74,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoThumbLabelBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  photoThumbLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  checklistRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  checkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  checkRemarksInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    color: '#0F172A',
    fontSize: 12,
    marginTop: 8,
    paddingVertical: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  photoSlot: {
    width: (width - 54) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  captureBtn: {
    height: 90,
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  cameraIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  captureBtnText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  photoContainer: {
    position: 'relative',
    height: 90,
    alignSelf: 'stretch',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFFFFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  successWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 24,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    marginBottom: 24,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receiptDashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  receiptBody: {
    gap: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  receiptVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  printActionBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 48,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  printActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  doneActionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    height: 48,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneActionBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginRight: 4,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    marginLeft: 4,
  },
  successBtn: {
    backgroundColor: '#10B981',
  },
  successBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Scanner Modal Styles
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerContainer: {
    width: '90%',
    alignItems: 'center',
    gap: 24,
  },
  scannerHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewfinder: {
    width: width * 0.8,
    height: 140,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  viewfinderCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#10B981',
  },
  viewfinderCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#10B981',
  },
  viewfinderCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#10B981',
  },
  viewfinderCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#10B981',
  },
  laserLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  viewfinderText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.8,
  },
  scanStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scanStatusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelScanBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    marginTop: 12,
    alignItems: 'center',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerBtnText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  naRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  naBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  naBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  bankOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bankOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bankOptionRate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },
  sideBySideRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  addExtraPhotoSlotBtn: {
    width: (width - 54) / 2,
    height: 124,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  addExtraPhotoSlotText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 6,
  },
  bodyConditionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bodyConditionOption: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyConditionOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  bodyConditionOptionText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  bodyConditionOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
});

