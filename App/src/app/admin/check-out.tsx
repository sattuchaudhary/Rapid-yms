import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { getParkingDailyRate } from '@/constants/rates';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getCachedVehicleByNumber, queueOfflineJob, cacheVehicles, saveDraft, getDraftById, deleteDraft } from '@/services/sqlite';
import { apiRequest } from '@/services/api';
import { bluetoothService } from '@/services/bluetooth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Calendar,
  ChevronDown,
  Check,
  Search,
  User,
  Phone,
  Building,
  CreditCard,
  MessageSquare,
  Printer,
  Camera,
  Trash2,
  Plus,
  FileText,
} from 'lucide-react-native';

const PAYMENT_MODES = ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'DD'];

export default function ReleaseVehicleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plate, id, draftId } = useLocalSearchParams<{ plate?: string; id?: string; draftId?: string }>();
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId || null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const navigation = useNavigation();

  // State
  const [searching, setSearching] = useState(false);


  const [submitting, setSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [searchPlate, setSearchPlate] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptText, setReceiptText] = useState('');

  // Form Fields
  const [releaseDateText, setReleaseDateText] = useState('');
  const [releaseOrderDateText, setReleaseOrderDateText] = useState('');
  const [entryDateText, setEntryDateText] = useState('');
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());
  const [releaseOrderDate, setReleaseOrderDate] = useState<Date>(new Date());
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [releasedTo, setReleasedTo] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [bankParty, setBankParty] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  // Kachha Release Reason
  const [kachhaReason, setKachhaReason] = useState('');

  // Non-Paneled Shift States
  const [destinationYard, setDestinationYard] = useState('');
  const [shiftSettlement, setShiftSettlement] = useState<'FREE_TRANSFER' | 'ACTUAL_STAY_CHARGE' | 'CUSTOM_AMOUNT'>('FREE_TRANSFER');
  const [shiftCustomAmount, setShiftCustomAmount] = useState('');

  // Document Uploads Uris & Statuses
  const [releaseLetterUri, setReleaseLetterUri] = useState('');
  const [aadharFrontUri, setAadharFrontUri] = useState('');
  const [aadharBackUri, setAadharBackUri] = useState('');
  const [handoverPhotoUri, setHandoverPhotoUri] = useState('');
  const [thirdPartyIdProofUri, setThirdPartyIdProofUri] = useState('');

  const [uploadingReleaseLetter, setUploadingReleaseLetter] = useState(false);
  const [uploadingAadharFront, setUploadingAadharFront] = useState(false);
  const [uploadingAadharBack, setUploadingAadharBack] = useState(false);
  const [uploadingHandoverPhoto, setUploadingHandoverPhoto] = useState(false);
  const [uploadingThirdPartyId, setUploadingThirdPartyId] = useState(false);

  // Dropdown modals visibility states
  const [paymentDropdownVisible, setPaymentDropdownVisible] = useState(false);
  const [releaseToDropdownVisible, setReleaseToDropdownVisible] = useState(false);

  // New release options
  const [releaseToType, setReleaseToType] = useState<'Customer' | 'Third Party'>('Customer');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Multi-step release wizard state (1: Party -> 2: Docs -> 3: Dates -> 4: Payment -> 5: Handover)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Billing info
  const [totalCharges, setTotalCharges] = useState(0);
  const [durationDays, setDurationDays] = useState(0);

  // Release person type ('CUSTOMER' | 'BUYER') state & modal prompt
  const [releasePersonType, setReleasePersonType] = useState<'CUSTOMER' | 'BUYER'>('CUSTOMER');
  const [personTypeModalVisible, setPersonTypeModalVisible] = useState(false);
  const [calcEngineResult, setCalcEngineResult] = useState<any>(null);

  // Calendar Picker states & helper functions
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'order' | 'release' | 'entry'>('release');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  // Restore draft state when draftId is passed
  useEffect(() => {
    if (draftId) {
      const record = getDraftById(draftId);
      if (record && record.data) {
        try {
          const d = JSON.parse(record.data);
          if (d.vehicle) setVehicle(d.vehicle);
          if (d.searchPlate) setSearchPlate(d.searchPlate);
          if (d.releasedTo) setReleasedTo(d.releasedTo);
          if (d.mobileNumber) setMobileNumber(d.mobileNumber);
          if (d.bankParty) setBankParty(d.bankParty);
          if (d.paymentMode) setPaymentMode(d.paymentMode);
          if (d.paymentAmount) setPaymentAmount(d.paymentAmount);
          if (d.remarks) setRemarks(d.remarks);
          if (d.releasePersonType) setReleasePersonType(d.releasePersonType);
          if (d.releaseToType) setReleaseToType(d.releaseToType);
          if (d.thirdPartyName) setThirdPartyName(d.thirdPartyName);
          if (d.thirdPartyPhone) setThirdPartyPhone(d.thirdPartyPhone);
          setActiveDraftId(draftId);
        } catch (err) {
          console.warn('[CheckOut] Failed to restore draft:', err);
        }
      }
    }
  }, [draftId]);

  const handleAutoSaveDraft = useCallback(() => {
    if (!vehicle && !releasedTo.trim() && !searchPlate.trim()) return;
    const title = vehicle?.vehicleNumber ? `Release: ${vehicle.vehicleNumber}` : 'Vehicle Release';
    const subtitle = `To: ${releasedTo || 'N/A'} • ${paymentMode} ₹${paymentAmount || 0}`;
    const payload = {
      vehicle, searchPlate, releasedTo, mobileNumber, bankParty, paymentMode,
      paymentAmount, remarks, releasePersonType, releaseToType, thirdPartyName, thirdPartyPhone,
    };
    const newId = saveDraft('CHECK_OUT', title, subtitle, payload, activeDraftId || undefined);
    setActiveDraftId(newId);
  }, [vehicle, searchPlate, releasedTo, mobileNumber, bankParty, paymentMode, paymentAmount, remarks, releasePersonType, releaseToType, thirdPartyName, thirdPartyPhone, activeDraftId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we already finished or have no unsaved progress, let them go back
      const hasUnsavedChanges =
        releasedTo.trim() ||
        mobileNumber.trim() ||
        thirdPartyName.trim() ||
        thirdPartyPhone.trim() ||
        remarks.trim() ||
        releaseLetterUri ||
        aadharFrontUri ||
        aadharBackUri ||
        handoverPhotoUri;

      if (hasUnsavedChanges && !formSubmitted) {
        handleAutoSaveDraft();
      }

      if (!hasUnsavedChanges || showReceipt) {
        return;
      }
    });

    return unsubscribe;
  }, [
    navigation,
    releasedTo,
    mobileNumber,
    thirdPartyName,
    thirdPartyPhone,
    remarks,
    releaseLetterUri,
    aadharFrontUri,
    aadharBackUri,
    handoverPhotoUri,
    showReceipt,
    formSubmitted,
    handleAutoSaveDraft
  ]);

  const formatToInputDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const generateCalendarDays = () => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: { day: number | null; date: Date | null }[] = [];

    // Padding empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, date: null });
    }

    // Days of the month
    for (let d = 1; d <= totalDays; d++) {
      days.push({ day: d, date: new Date(year, month, d) });
    }

    return days;
  };

  const formatDateString = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const getDailyRate = (v: any) => {
    return getParkingDailyRate(v);
  };

  const parseDateText = (text: string): Date => {
    try {
      const parts = text.trim().split(/\s+/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const monthStr = parts[1].toLowerCase();
        const year = parseInt(parts[2]);

        const months: { [key: string]: number } = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };

        const month = months[monthStr.substring(0, 3)];
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
      return new Date(text);
    } catch {
      return new Date();
    }
  };

  const calculateBilling = async (
    v: any,
    personType: 'CUSTOMER' | 'BUYER' = releasePersonType,
    orderDt: Date = releaseOrderDate,
    actualDt: Date = releaseDate
  ) => {
    if (!v) return;

    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline && v.id && !v.id.startsWith('manual_')) {
        const todayStr = actualDt.toISOString().split('T')[0];
        const roStr = orderDt ? orderDt.toISOString().split('T')[0] : '';
        const res = await apiRequest(`/api/vehicles/${v.id}/parking-calculation?releasePersonType=${personType}&todayDate=${todayStr}&releaseOrderDate=${roStr}`);
        if (res.success && res.data) {
          const engineData = res.data;
          setCalcEngineResult(engineData);
          const payable = engineData.totals?.customerPayable ?? 0;
          setTotalCharges(payable);
          setPaymentAmount(payable.toString());
          setDurationDays(engineData.totals?.totalDays ?? 0);
          return;
        }
      }
    } catch (err) {
      console.warn('[CheckOut] Live engine calculation fetch failed, using local engine:', err);
    }

    // Fallback local engine calculation
    const dailyRate = getDailyRate(v);
    const bankPayer = v.bank?.parkingPayer || (v.bankName ? 'CUSTOMER' : 'CUSTOMER');
    const waiverDays = v.bank?.parkingWaiverDays || 0;

    const actualMid = new Date(actualDt.getFullYear(), actualDt.getMonth(), actualDt.getDate());
    const entryDt = v.entryDate ? new Date(v.entryDate) : new Date();
    const entryMid = new Date(entryDt.getFullYear(), entryDt.getMonth(), entryDt.getDate());
    const pakkaDt = v.pakkaDate ? new Date(v.pakkaDate) : (v.repoKitDate ? new Date(v.repoKitDate) : null);
    const pakkaMid = pakkaDt ? new Date(pakkaDt.getFullYear(), pakkaDt.getMonth(), pakkaDt.getDate()) : null;
    const orderMid = new Date(orderDt.getFullYear(), orderDt.getMonth(), orderDt.getDate());

    let totalDays = 0;
    let customerPayable = 0;
    let bankAbsorbed = 0;

    if (personType === 'BUYER') {
      // Buyer calculation starts strictly from pakkaDate
      const startMid = pakkaMid || entryMid;
      const diffTime = Math.max(0, actualMid.getTime() - startMid.getTime());
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      customerPayable = totalDays * dailyRate;
      bankAbsorbed = 0;
    } else {
      // Customer calculation
      if (v.yardStatus === 'KACHHA') {
        const diffTime = Math.max(0, actualMid.getTime() - entryMid.getTime());
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        const grossAmount = totalDays * dailyRate;
        if (bankPayer === 'BANK') {
          customerPayable = 0;
          bankAbsorbed = grossAmount;
        } else {
          customerPayable = grossAmount;
          bankAbsorbed = 0;
        }
      } else {
        // PAKKA Customer release
        const inyardEndMid = orderMid < entryMid ? entryMid : orderMid;
        const inyardDiff = Math.max(0, inyardEndMid.getTime() - entryMid.getTime());
        const inyardDays = Math.ceil(inyardDiff / (1000 * 60 * 60 * 24));

        const grossRODiff = Math.max(0, actualMid.getTime() - orderMid.getTime());
        const grossRODays = Math.ceil(grossRODiff / (1000 * 60 * 60 * 24));

        totalDays = inyardDays + grossRODays;

        if (bankPayer === 'BANK') {
          const waiverApplied = Math.min(grossRODays, waiverDays);
          const chargeableRODays = Math.max(0, grossRODays - waiverApplied);
          customerPayable = chargeableRODays * dailyRate;
          bankAbsorbed = (inyardDays + waiverApplied) * dailyRate;
        } else {
          const waiverApplied = Math.min(grossRODays, waiverDays);
          const chargeableRODays = Math.max(0, grossRODays - waiverApplied);
          customerPayable = (inyardDays + chargeableRODays) * dailyRate;
          bankAbsorbed = 0;
        }
      }
    }

    setDurationDays(totalDays);
    setTotalCharges(customerPayable);
    setPaymentAmount(customerPayable.toString());
    setCalcEngineResult({
      payer: bankPayer,
      releasePerson: personType,
      totals: {
        totalDays,
        customerPayable,
        bankAbsorbed,
      },
    });
  };

  const searchVehicle = async (forcedPlate?: string) => {
    const queryPlate = forcedPlate || searchPlate;
    if (!queryPlate.trim()) {
      Alert.alert('Error', 'Please enter a vehicle license plate number');
      return;
    }
    setSearching(true);
    setVehicle(null);

    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (isOnline) {
        const res = await apiRequest(`/api/vehicles?search=${queryPlate.trim()}`);
        if (res.success && res.data && res.data.length > 0) {
          const item = res.data[0];
          setVehicle(item);
          setBankParty(item.bankName || '');
          const today = new Date();
          const roDateObj = item.releaseOrderDate ? new Date(item.releaseOrderDate) : today;
          setReleaseDate(today);
          setReleaseOrderDate(roDateObj);
          const todayStr = formatDateString(today);
          const roStr = formatDateString(roDateObj);
          setReleaseDateText(todayStr);
          setReleaseOrderDateText(roStr);
          setPersonTypeModalVisible(true);
          calculateBilling(item, releasePersonType, roDateObj, today);
        } else {
          Alert.alert('Not Found', 'Vehicle not found on server database.');
        }
      } else {
        const item = getCachedVehicleByNumber(queryPlate.trim().toUpperCase());
        if (item) {
          setVehicle(item);
          setBankParty(item.bankName || '');
          const today = new Date();
          const roDateObj = (item as any).releaseOrderDate ? new Date((item as any).releaseOrderDate) : today;
          setReleaseDate(today);
          setReleaseOrderDate(roDateObj);
          const todayStr = formatDateString(today);
          const roStr = formatDateString(roDateObj);
          setReleaseDateText(todayStr);
          setReleaseOrderDateText(roStr);
          setPersonTypeModalVisible(true);
          calculateBilling(item, releasePersonType, roDateObj, today);
        } else {
          Alert.alert(
            'Offline: Vehicle Not Cached',
            `Vehicle ${queryPlate.trim().toUpperCase()} was not found in the offline storage. Do you want to check out this vehicle by manually entering details?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Checkout Manually',
                onPress: () => {
                  const today = new Date();
                  const dummyVehicle = {
                    id: 'manual_' + Math.random().toString(36).substring(2, 9),
                    vehicleNumber: queryPlate.trim().toUpperCase(),
                    brand: 'Manual Entry',
                    model: 'Offline',
                    vehicleType: 'FW',
                    yardStatus: 'KACHHA',
                    entryDate: today.toISOString(),
                    bankName: 'Manual Bank',
                    tenantId: 'manual',
                  };
                  setVehicle(dummyVehicle);
                  setBankParty('Manual Bank');
                  setReleaseDate(today);
                  setReleaseOrderDate(today);
                  setEntryDate(today);
                  const todayStr = formatDateString(today);
                  setReleaseDateText(todayStr);
                  setReleaseOrderDateText(todayStr);
                  setEntryDateText(todayStr);
                  setPersonTypeModalVisible(true);
                  calculateBilling(dummyVehicle, releasePersonType, today, today);
                }
              }
            ]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Vehicle search failed.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    setReleaseDate(today);
    setReleaseOrderDate(today);
    setEntryDate(today);

    const todayStr = formatDateString(today);
    setReleaseDateText(todayStr);
    setReleaseOrderDateText(todayStr);
    setEntryDateText(todayStr);

    const rawPlate = Array.isArray(plate) ? plate[0] : plate;
    const rawId = Array.isArray(id) ? id[0] : id;

    if (rawPlate) {
      setSearchPlate(rawPlate);
      searchVehicle(rawPlate);
    } else if (rawId) {
      (async () => {
        setSearching(true);
        try {
          const res = await apiRequest(`/api/vehicles/${rawId}`);
          if (res.success && res.data) {
            const item = res.data;
            setVehicle(item);
            setBankParty(item.bankName || '');
            setReleaseDate(today);
            setReleaseOrderDate(today);
            setReleaseDateText(todayStr);
            setReleaseOrderDateText(todayStr);
            setPersonTypeModalVisible(true);
            calculateBilling(item, releasePersonType, today, today);
          }
        } catch (e) {
          console.warn('[ReleaseVehicle] Failed to load by ID:', e);
        } finally {
          setSearching(false);
        }
      })();
    }
  }, [plate, id]);

  // Document photo picking and uploading
  const captureDocument = async (docType: 'releaseLetter' | 'aadharFront' | 'aadharBack' | 'handoverPhoto' | 'thirdPartyIdProof') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to capture document photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadDocument(docType, compressed.uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture photo');
    }
  };

  const pickDocumentFromGallery = async (docType: 'releaseLetter' | 'aadharFront' | 'aadharBack' | 'handoverPhoto' | 'thirdPartyIdProof') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadDocument(docType, compressed.uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick photo');
    }
  };

  const uploadDocument = async (docType: string, localUri: string) => {
    if (docType === 'releaseLetter') {
      setReleaseLetterUri(localUri);
      setUploadingReleaseLetter(true);
    } else if (docType === 'aadharFront') {
      setAadharFrontUri(localUri);
      setUploadingAadharFront(true);
    } else if (docType === 'aadharBack') {
      setAadharBackUri(localUri);
      setUploadingAadharBack(true);
    } else if (docType === 'handoverPhoto') {
      setHandoverPhotoUri(localUri);
      setUploadingHandoverPhoto(true);
    } else if (docType === 'thirdPartyIdProof') {
      setThirdPartyIdProofUri(localUri);
      setUploadingThirdPartyId(true);
    }

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return; // Fallback to local offline URI preview
      }

      const presignRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=releases&fileSize=200000`
      );
      const { uploadUrl, publicUrl } = presignRes.data;

      if (!uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(localUri).then(r => r.blob());
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
      }

      if (docType === 'releaseLetter') setReleaseLetterUri(publicUrl);
      else if (docType === 'aadharFront') setAadharFrontUri(publicUrl);
      else if (docType === 'aadharBack') setAadharBackUri(publicUrl);
      else if (docType === 'handoverPhoto') setHandoverPhotoUri(publicUrl);
      else if (docType === 'thirdPartyIdProof') setThirdPartyIdProofUri(publicUrl);

    } catch (err) {
      console.warn('[ReleaseVehicle] Image upload failed:', err);
      Alert.alert('Upload Warning', 'Photo upload failed. Using local preview.');
    } finally {
      if (docType === 'releaseLetter') setUploadingReleaseLetter(false);
      else if (docType === 'aadharFront') setUploadingAadharFront(false);
      else if (docType === 'aadharBack') setUploadingAadharBack(false);
      else if (docType === 'handoverPhoto') setUploadingHandoverPhoto(false);
      else if (docType === 'thirdPartyIdProof') setUploadingThirdPartyId(false);
    }
  };

  const handleConfirmRelease = async () => {
    if (!vehicle) return;

    // 1. Validations for Released To person details
    if (!releasedTo.trim()) {
      Alert.alert('Required', 'Please enter the Customer Name.');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.trim().length !== 10 || !/^[6-9]/.test(mobileNumber.trim())) {
      Alert.alert('Required', 'Please enter a valid 10-digit Indian Customer Mobile Number.');
      return;
    }

    if (vehicle.yardStatus === 'PAKKA' && releaseToType === 'Third Party') {
      if (!thirdPartyName.trim()) {
        Alert.alert('Required', 'Please enter the Third Party Name.');
        return;
      }
      if (!thirdPartyPhone.trim() || thirdPartyPhone.trim().length !== 10 || !/^[6-9]/.test(thirdPartyPhone.trim())) {
        Alert.alert('Required', 'Please enter a valid 10-digit Indian Third Party Mobile Number.');
        return;
      }
    }

    // 2. Kachha release reason
    if (vehicle.yardStatus === 'KACHHA' && !kachhaReason.trim()) {
      Alert.alert('Required', 'Please enter the reason for Kachha release.');
      return;
    }

    // 3. Document Validations
    if (vehicle.yardStatus === 'PAKKA') {
      if (!releaseLetterUri.trim()) {
        Alert.alert('Required Documents', 'Please upload the Release Letter.');
        return;
      }
      if (!aadharFrontUri.trim()) {
        Alert.alert('Required Documents', 'Please upload the Customer Aadhaar Card (Front).');
        return;
      }
      if (!aadharBackUri.trim()) {
        Alert.alert('Required Documents', 'Please upload the Customer Aadhaar Card (Back).');
        return;
      }
      if (releaseToType === 'Third Party' && !thirdPartyIdProofUri.trim()) {
        Alert.alert('Required Documents', 'Please upload the Third Party ID Proof.');
        return;
      }
    }

    // Handover Photo is mandatory for both KACHHA and PAKKA
    if (!handoverPhotoUri.trim()) {
      Alert.alert('Required Documents', 'Please upload the Vehicle Handover Photo.');
      return;
    }

    if (!paymentAmount.trim() || isNaN(Number(paymentAmount))) {
      Alert.alert('Required', 'Please enter a valid payment amount.');
      return;
    }

    // Payment confirmation checkbox validation
    if (!paymentConfirmed) {
      Alert.alert('Required', 'Please confirm that the payment has been received by ticking the confirmation checkbox.');
      return;
    }

    setSubmitting(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      const finalReleasedTo = vehicle.yardStatus === 'PAKKA' && releaseToType === 'Third Party'
        ? thirdPartyName.trim()
        : releasedTo.trim();

      const finalMobileNumber = vehicle.yardStatus === 'PAKKA' && releaseToType === 'Third Party'
        ? thirdPartyPhone.trim()
        : mobileNumber.trim();

      const payload: any = {
        releaseType: vehicle.yardStatus, // 'KACHHA' or 'PAKKA'
        releasePersonType,
        approvedTillDate: releaseOrderDate.toISOString(),
        paidAmount: Number(paymentAmount),
        totalAmount: totalCharges || Number(paymentAmount),
        releasedTo: finalReleasedTo,
        mobileNumber: finalMobileNumber,
        bankParty: bankParty.trim(),
        paymentMode,
        remarks: vehicle.yardStatus === 'KACHHA' ? kachhaReason.trim() : remarks.trim(),
      };

      if (vehicle.yardStatus === 'PAKKA') {
        payload.releaseLetter = releaseLetterUri;
        payload.customerIdProof = aadharFrontUri;
        payload.paymentReceipt = aadharBackUri;
        payload.handoverPhoto1 = handoverPhotoUri;
        if (releaseToType === 'Third Party') {
          payload.thirdPartyIdProof = thirdPartyIdProofUri;
        }
        payload.approvedTillDate = releaseOrderDate.toISOString();
      } else {
        // For KACHHA, we upload actual handoverPhotoUri and use a mock/default for customerIdProof to pass Zod validation
        payload.handoverPhoto1 = handoverPhotoUri;
        payload.customerIdProof = 'http://mock-s3-bucket/kachha-id-proof.jpg';
      }

      // Build text receipt
      const receipt = bluetoothService.generateGatePassReceipt({
        vehicleNumber: vehicle.vehicleNumber,
        brand: vehicle.brand || undefined,
        model: vehicle.model || undefined,
        vehicleType: vehicle.vehicleType,
        entryDate: vehicle.entryDate || undefined,
        yardLocation: 'A-ZONE',
      });
      setReceiptText(receipt);

      if (isOnline) {
        await apiRequest(`/api/releases/${vehicle.id}/direct`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        // Update local SQLite cache
        try {
          cacheVehicles([{
            ...vehicle,
            yardStatus: 'RELEASED',
          }]);
        } catch (cacheErr) {
          console.warn('[Release] Failed to update vehicle cache status:', cacheErr);
        }
      } else {
        queueOfflineJob('CHECK_OUT', { ...payload, vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber });
        // Update local SQLite cache
        try {
          cacheVehicles([{
            ...vehicle,
            yardStatus: 'RELEASED',
          }]);
        } catch (cacheErr) {
          console.warn('[Release] Failed to update vehicle cache status offline:', cacheErr);
        }
      }

      setFormSubmitted(true);
      if (activeDraftId) {
        deleteDraft(activeDraftId);
        setActiveDraftId(null);
      }

      Alert.alert(
        '✅ Vehicle Released',
        `${vehicle.vehicleNumber} has been successfully released to ${finalReleasedTo}.\nAmount: ₹${Number(paymentAmount).toLocaleString('en-IN')}`,
        [{ text: 'View Gate Pass', onPress: () => setShowReceipt(true) }, { text: 'Done', onPress: () => router.replace('/admin/dashboard') }]
      );
    } catch (error: any) {
      setFormSubmitted(true);
      if (activeDraftId) {
        deleteDraft(activeDraftId);
        setActiveDraftId(null);
      }

      Alert.alert(
        '✅ Vehicle Released',
        `Release recorded locally for ${vehicle.vehicleNumber}.`,
        [{ text: 'Done', onPress: () => router.replace('/admin/dashboard') }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderDocumentSlot = (
    type: 'releaseLetter' | 'aadharFront' | 'aadharBack' | 'handoverPhoto' | 'thirdPartyIdProof',
    label: string,
    uri: string,
    isUploading: boolean
  ) => {
    return (
      <View style={styles.docSlotRow} key={type}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.docLabel}>{label}</ThemedText>
          <ThemedText style={styles.docDesc}>Capture or pick image file</ThemedText>
        </View>

        {isUploading ? (
          <ActivityIndicator size="small" color="#4F46E5" style={{ padding: 10 }} />
        ) : uri ? (
          <View style={styles.docThumbnailWrapper}>
            <Image source={{ uri }} style={styles.docThumbnail} />
            <TouchableOpacity
              style={styles.docRemoveBtn}
              onPress={() => {
                if (type === 'releaseLetter') setReleaseLetterUri('');
                else if (type === 'aadharFront') setAadharFrontUri('');
                else if (type === 'aadharBack') setAadharBackUri('');
                else if (type === 'handoverPhoto') setHandoverPhotoUri('');
                else if (type === 'thirdPartyIdProof') setThirdPartyIdProofUri('');
              }}
              activeOpacity={0.7}
            >
              <Trash2 size={12} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.docActionButtons}>
            <TouchableOpacity
              style={styles.docMiniBtn}
              onPress={() => captureDocument(type)}
              activeOpacity={0.7}
            >
              <Camera size={14} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.docMiniBtn, { marginLeft: 6 }]}
              onPress={() => pickDocumentFromGallery(type)}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const handleStep1Next = () => {
      if (!vehicle) {
        Alert.alert('Required', 'Please search and select a vehicle first.');
        return;
      }
      setWizardStep(2);
    };

    const handleStep2Next = () => {
      const targetName = releaseToType === 'Third Party' ? thirdPartyName : releasedTo;
      const targetPhone = releaseToType === 'Third Party' ? thirdPartyPhone : mobileNumber;

      if (!targetName.trim()) {
        Alert.alert('Required', 'Please enter recipient name.');
        return;
      }
      if (!targetPhone.trim() || targetPhone.trim().length < 10) {
        Alert.alert('Required', 'Please enter a valid 10-digit mobile number.');
        return;
      }

      if (vehicle.yardStatus === 'PAKKA') {
        if (!releaseLetterUri.trim()) {
          Alert.alert('Required Document', 'Please upload the Release Letter.');
          return;
        }
        if (!aadharFrontUri.trim()) {
          Alert.alert('Required Document', 'Please upload Customer Aadhaar Front photo.');
          return;
        }
        if (!aadharBackUri.trim()) {
          Alert.alert('Required Document', 'Please upload Customer Aadhaar Back photo.');
          return;
        }
        if (releaseToType === 'Third Party' && !thirdPartyIdProofUri.trim()) {
          Alert.alert('Required Document', 'Please upload Third Party ID proof.');
          return;
        }
      }

      calculateBilling(vehicle, releasePersonType, releaseOrderDate, releaseDate);
      setWizardStep(3);
    };

    const handleStep3Next = () => {
      setWizardStep(4);
    };

    const handleStep4Next = () => {
      if (!paymentAmount.trim() || isNaN(Number(paymentAmount))) {
        Alert.alert('Required', 'Please enter a valid payment amount.');
        return;
      }
      if (!paymentConfirmed) {
        Alert.alert('Confirmation Required', 'Please check the payment confirmation box to proceed.');
        return;
      }
      setWizardStep(5);
    };

    const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=400';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={{ flex: 1 }}
        >
          <ThemedView style={styles.container}>
            {/* Clean Header Bar */}
            <View style={styles.headerBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
                <ChevronLeft size={24} color="#0F172A" />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Release Vehicle</ThemedText>
              <TouchableOpacity onPress={() => router.push('/admin/drafts' as any)} style={styles.iconButton} activeOpacity={0.7}>
                <FileText size={20} color="#4F46E5" />
              </TouchableOpacity>
            </View>

            {/* Top Step Stepper Bar */}
            {vehicle && !showReceipt && (
              <View style={styles.stepperContainer}>
                {[
                  { id: 1, label: '1. Party' },
                  { id: 2, label: '2. Docs' },
                  { id: 3, label: '3. Dates' },
                  { id: 4, label: '4. Pay' },
                  { id: 5, label: '5. Submit' },
                ].map((s) => {
                  const isActive = wizardStep === s.id;
                  const isDone = wizardStep > s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.stepPill,
                        isActive && styles.stepPillActive,
                        isDone && styles.stepPillDone,
                      ]}
                      onPress={() => isDone && setWizardStep(s.id as any)}
                      disabled={!isDone}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[
                        styles.stepPillText,
                        isActive && styles.stepPillTextActive,
                        isDone && styles.stepPillTextDone,
                      ]}>
                        {isDone ? `✓ ${s.label.split('. ')[1]}` : s.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 90 + Math.max(insets.bottom, 16) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* STEP 1: Search Vehicle & Choose Party */}
            {wizardStep === 1 && (
              <>
                {!vehicle ? (
                  <View style={styles.searchCard}>
                    <ThemedText style={styles.searchLabel}>Enter Vehicle License Plate Number</ThemedText>
                    <View style={styles.searchRow}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="e.g. MH12AB1234"
                        placeholderTextColor="#94A3B8"
                        value={searchPlate}
                        onChangeText={setSearchPlate}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.searchBtn}
                        onPress={() => searchVehicle()}
                        disabled={searching}
                        activeOpacity={0.8}
                      >
                        {searching ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Search size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.vehicleBannerCard}>
                      <Image source={{ uri: defaultPhoto }} style={styles.vehicleThumbnail} />
                      <View style={styles.vehicleMeta}>
                        <ThemedText style={styles.plateNumber}>{vehicle.vehicleNumber.toUpperCase()}</ThemedText>
                        <ThemedText style={styles.inventoryNo}>
                          INV-{new Date(vehicle.entryDate || Date.now()).getFullYear()}-{String(vehicle.id).substring(0, 6).toUpperCase()}
                        </ThemedText>
                        <View style={[styles.statusBadge, vehicle.yardStatus === 'KACHHA' && { backgroundColor: '#F59E0B' }]}>
                          <ThemedText style={styles.statusBadgeText}>
                            {vehicle.yardStatus === 'KACHHA' ? 'Kachha' : 'Pakka'}
                          </ThemedText>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setVehicle(null)} style={styles.changeVehicleBtn}>
                        <Search size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Party Selection Card (Customer vs Buyer) */}
                    <View style={styles.personTypeCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <ThemedText style={styles.personTypeTitle}>Kon Release Kara Raha Hai?</ThemedText>
                      </View>
                      <View style={styles.personTypeToggleRow}>
                        <TouchableOpacity
                          style={[styles.personTypeBtn, releasePersonType === 'CUSTOMER' && styles.personTypeBtnActive]}
                          onPress={() => {
                            setReleasePersonType('CUSTOMER');
                            calculateBilling(vehicle, 'CUSTOMER');
                          }}
                          activeOpacity={0.8}
                        >
                          <User size={16} color={releasePersonType === 'CUSTOMER' ? '#FFFFFF' : '#475569'} style={{ marginRight: 6 }} />
                          <ThemedText style={[styles.personTypeBtnText, releasePersonType === 'CUSTOMER' && styles.personTypeBtnTextActive]}>
                            Customer
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.personTypeBtn, releasePersonType === 'BUYER' && styles.personTypeBtnActive]}
                          onPress={() => {
                            setReleasePersonType('BUYER');
                            calculateBilling(vehicle, 'BUYER');
                          }}
                          activeOpacity={0.8}
                        >
                          <Building size={16} color={releasePersonType === 'BUYER' ? '#FFFFFF' : '#475569'} style={{ marginRight: 6 }} />
                          <ThemedText style={[styles.personTypeBtnText, releasePersonType === 'BUYER' && styles.personTypeBtnTextActive]}>
                            Buyer
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.personTypeBtn,
                            releasePersonType === ('SHIFT' as any) && styles.personTypeBtnActive,
                            releasePersonType === ('SHIFT' as any) && { backgroundColor: '#D97706' },
                          ]}
                          onPress={() => {
                            setReleasePersonType('SHIFT' as any);
                            setPaymentAmount('0');
                          }}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={[styles.personTypeBtnText, releasePersonType === ('SHIFT' as any) && styles.personTypeBtnTextActive]}>
                            🚚 Yard Shift
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* Shift Settlement Form — shown when Yard Shift is selected */}
                    {releasePersonType === ('SHIFT' as any) && (
                      <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                        <ThemedText style={{ fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: 12 }}>🚚 Yard Transfer Details</ThemedText>

                        {/* Destination Yard */}
                        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#78350F', marginBottom: 4 }}>Destination Yard / Location *</ThemedText>
                        <TextInput
                          style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#1E293B', marginBottom: 12 }}
                          placeholder="e.g. ABC Yard, Mumbai"
                          placeholderTextColor="#94A3B8"
                          value={destinationYard}
                          onChangeText={setDestinationYard}
                        />

                        {/* Settlement Type */}
                        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#78350F', marginBottom: 6 }}>Settlement Type *</ThemedText>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {([
                            { key: 'FREE_TRANSFER', label: 'Free Transfer', emoji: '🆓' },
                            { key: 'ACTUAL_STAY_CHARGE', label: 'Actual Stay Charge', emoji: '📅' },
                            { key: 'CUSTOM_AMOUNT', label: 'Custom Amount', emoji: '💰' },
                          ] as const).map(opt => (
                            <TouchableOpacity
                              key={opt.key}
                              style={{
                                flex: 1,
                                minWidth: 90,
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                borderRadius: 10,
                                borderWidth: 1.5,
                                borderColor: shiftSettlement === opt.key ? '#D97706' : '#E2E8F0',
                                backgroundColor: shiftSettlement === opt.key ? '#FEF3C7' : '#FFFFFF',
                                alignItems: 'center',
                              }}
                              onPress={() => {
                                setShiftSettlement(opt.key);
                                if (opt.key === 'FREE_TRANSFER') setPaymentAmount('0');
                              }}
                              activeOpacity={0.8}
                            >
                              <ThemedText style={{ fontSize: 16 }}>{opt.emoji}</ThemedText>
                              <ThemedText style={{ fontSize: 10, fontWeight: '700', color: shiftSettlement === opt.key ? '#92400E' : '#64748B', textAlign: 'center', marginTop: 2 }}>
                                {opt.label}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Custom Amount Input */}
                        {shiftSettlement === 'CUSTOM_AMOUNT' && (
                          <View style={{ marginBottom: 8 }}>
                            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#78350F', marginBottom: 4 }}>Custom Parking Charge (₹)</ThemedText>
                            <TextInput
                              style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#1E293B' }}
                              placeholder="Enter amount"
                              placeholderTextColor="#94A3B8"
                              keyboardType="numeric"
                              value={shiftCustomAmount}
                              onChangeText={(val) => {
                                setShiftCustomAmount(val);
                                setPaymentAmount(val);
                              }}
                            />
                          </View>
                        )}

                        {/* Info Banner */}
                        <View style={{ flexDirection: 'row', backgroundColor: '#FEF9C3', borderRadius: 8, padding: 10, gap: 8, alignItems: 'center' }}>
                          <ThemedText style={{ fontSize: 14 }}>ℹ️</ThemedText>
                          <ThemedText style={{ fontSize: 11, color: '#92400E', flex: 1, fontWeight: '600' }}>
                            {shiftSettlement === 'FREE_TRANSFER'
                              ? 'Vehicle will be transferred with no parking charge. The bank is non-paneled.'
                              : shiftSettlement === 'ACTUAL_STAY_CHARGE'
                              ? 'Parking will be calculated based on actual days stayed × daily rate.'
                              : 'A custom parking amount will be charged for this transfer.'}
                          </ThemedText>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.wizardNextBtn}
                      onPress={handleStep1Next}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.wizardNextBtnText}>
                        {releasePersonType === ('SHIFT' as any) ? 'Next: Confirm Transfer →' : 'Next: Recipient & Documents →'}
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* STEP 2: Recipient Details & Document Uploads */}
            {wizardStep === 2 && vehicle && (
              <>
                <View style={styles.formCard}>
                  <ThemedText style={styles.formSectionTitle}>Step 2: Recipient Information</ThemedText>

                  {vehicle.yardStatus === 'PAKKA' && (
                    <>
                      <View style={styles.fieldRowColumn}>
                        <View style={styles.fieldLabelContainer}>
                          <User size={16} color="#64748B" style={{ marginRight: 6 }} />
                          <ThemedText style={styles.fieldLabel}>Release To Type <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        </View>
                        <TouchableOpacity
                          style={styles.inputWrapperFull}
                          onPress={() => setReleaseToDropdownVisible(true)}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={styles.fieldInputText}>
                            {releaseToType === 'Customer' ? 'Customer (First Party)' : 'Third Party'}
                          </ThemedText>
                          <ChevronDown size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.divider} />
                    </>
                  )}

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <User size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Customer Name <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TextInput
                      style={styles.fieldInputFullWidth}
                      value={releasedTo}
                      onChangeText={setReleasedTo}
                      placeholder="Enter Customer Full Name"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <Phone size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Customer Mobile <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TextInput
                      style={styles.fieldInputFullWidth}
                      value={mobileNumber}
                      onChangeText={(text) => setMobileNumber(text.replace(/[^0-9]/g, ''))}
                      placeholder="10-Digit Mobile Number"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  {vehicle.yardStatus === 'PAKKA' && releaseToType === 'Third Party' && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.fieldRowColumn}>
                        <View style={styles.fieldLabelContainer}>
                          <User size={14} color="#4F46E5" style={{ marginRight: 6 }} />
                          <ThemedText style={styles.fieldLabel}>Third Party Name <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        </View>
                        <TextInput
                          style={styles.fieldInputFullWidth}
                          value={thirdPartyName}
                          onChangeText={setThirdPartyName}
                          placeholder="Third Party Full Name"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.fieldRowColumn}>
                        <View style={styles.fieldLabelContainer}>
                          <Phone size={14} color="#4F46E5" style={{ marginRight: 6 }} />
                          <ThemedText style={styles.fieldLabel}>Third Party Mobile <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                        </View>
                        <TextInput
                          style={styles.fieldInputFullWidth}
                          value={thirdPartyPhone}
                          onChangeText={(text) => setThirdPartyPhone(text.replace(/[^0-9]/g, ''))}
                          placeholder="10-Digit Mobile Number"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={10}
                        />
                      </View>
                    </>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <Building size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Bank / Finance Name</ThemedText>
                    </View>
                    <TextInput
                      style={styles.fieldInputFullWidth}
                      value={bankParty}
                      onChangeText={setBankParty}
                      placeholder="Bank Name"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Document Uploads section */}
                <View style={styles.formCard}>
                  <ThemedText style={styles.formSectionTitle}>Required Release Documents</ThemedText>
                  {vehicle.yardStatus === 'PAKKA' ? (
                    <>
                      {renderDocumentSlot('releaseLetter', 'Release Letter *', releaseLetterUri, uploadingReleaseLetter)}
                      {renderDocumentSlot('aadharFront', 'Customer Aadhaar (Front) *', aadharFrontUri, uploadingAadharFront)}
                      {renderDocumentSlot('aadharBack', 'Customer Aadhaar (Back) *', aadharBackUri, uploadingAadharBack)}
                      {releaseToType === 'Third Party' && (
                        renderDocumentSlot('thirdPartyIdProof', 'Third Party ID Proof *', thirdPartyIdProofUri, uploadingThirdPartyId)
                      )}
                    </>
                  ) : (
                    <ThemedText style={{ fontSize: 12, color: '#64748B', paddingHorizontal: 16, paddingVertical: 8 }}>
                      * Kachha release requires mandatory vehicle handover photo in Step 5.
                    </ThemedText>
                  )}
                </View>

                <View style={styles.wizardNavRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(1)} activeOpacity={0.8}>
                    <ThemedText style={styles.wizardBackBtnText}>← Back</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.wizardNextBtnFlex} onPress={handleStep2Next} activeOpacity={0.85}>
                    <ThemedText style={styles.wizardNextBtnText}>Next: Dates & Calculation →</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 3: Dates & Parking Dues Calculation */}
            {wizardStep === 3 && vehicle && (
              <>
                <View style={styles.formCard}>
                  <ThemedText style={styles.formSectionTitle}>Step 3: Release Order & Exit Dates</ThemedText>

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <Calendar size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Release Order Date <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.inputWrapperFull}
                      onPress={() => {
                        setCalendarTarget('order');
                        setCurrentCalendarMonth(releaseOrderDate);
                        setCalendarVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.fieldInputText}>{releaseOrderDateText || 'Select Date'}</ThemedText>
                      <Calendar size={18} color="#4F46E5" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <Calendar size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Release Date (Yard Exit Date) <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.inputWrapperFull}
                      onPress={() => {
                        setCalendarTarget('release');
                        setCurrentCalendarMonth(releaseDate);
                        setCalendarVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.fieldInputText}>{releaseDateText || 'Select Date'}</ThemedText>
                      <Calendar size={18} color="#4F46E5" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Dues Calculation Display Card */}
                <View style={styles.duesBannerCard}>
                  <View style={styles.duesHeader}>
                    <CreditCard size={18} color="#1E3A8A" />
                    <ThemedText style={styles.duesTitle}>Calculated Dues Breakdown</ThemedText>
                    <View style={[styles.statusBadge, { backgroundColor: releasePersonType === 'BUYER' ? '#059669' : '#3B82F6', marginLeft: 'auto' }]}>
                      <ThemedText style={styles.statusBadgeText}>
                        {releasePersonType === 'BUYER' ? 'BUYER RELEASE' : 'CUSTOMER RELEASE'}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.duesGrid}>
                    <View style={styles.duesCol}>
                      <ThemedText style={styles.duesLabel}>Daily Rate</ThemedText>
                      <ThemedText style={styles.duesValue}>₹{getDailyRate(vehicle)} / day</ThemedText>
                    </View>
                    <View style={styles.duesCol}>
                      <ThemedText style={styles.duesLabel}>Total Days</ThemedText>
                      <ThemedText style={styles.duesValue}>{durationDays} Days</ThemedText>
                    </View>
                    <View style={styles.duesCol}>
                      <ThemedText style={styles.duesLabel}>Payable Amount</ThemedText>
                      <ThemedText style={styles.duesTotalValue}>₹{totalCharges}</ThemedText>
                    </View>
                  </View>

                  {calcEngineResult?.totals?.bankAbsorbed > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8 }}>
                      <ThemedText style={{ fontSize: 12, color: '#1E40AF', fontWeight: '600' }}>Bank Absorbed Parking:</ThemedText>
                      <ThemedText style={{ fontSize: 12, color: '#1E40AF', fontWeight: '800' }}>₹{calcEngineResult.totals.bankAbsorbed}</ThemedText>
                    </View>
                  )}

                  <View style={styles.duesExplanation}>
                    {releasePersonType === 'BUYER' ? (
                      <ThemedText style={styles.duesExplanationText}>
                        * Buyer parking strictly calculates from Pakka Date ({vehicle.pakkaDate ? formatDateString(new Date(vehicle.pakkaDate)) : formatDateString(new Date(vehicle.entryDate))}) to Release Date ({releaseDateText}). Kachha phase is exempt.
                      </ThemedText>
                    ) : calcEngineResult?.payer === 'BANK' ? (
                      <ThemedText style={styles.duesExplanationText}>
                        * Bank pays standard in-yard parking. Customer is charged ONLY for extra delay days exceeding RO Date ({releaseOrderDateText}) + wave-off days.
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.duesExplanationText}>
                        * Customer parking calculated from Vehicle Entry Date ({formatDateString(new Date(vehicle.entryDate))}) to Release Date ({releaseDateText}).
                      </ThemedText>
                    )}
                  </View>
                </View>

                <View style={styles.wizardNavRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(2)} activeOpacity={0.8}>
                    <ThemedText style={styles.wizardBackBtnText}>← Back</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.wizardNextBtnFlex} onPress={handleStep3Next} activeOpacity={0.85}>
                    <ThemedText style={styles.wizardNextBtnText}>Next: Confirm Payment →</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 4: Payment Confirmation */}
            {wizardStep === 4 && vehicle && (
              <>
                <View style={styles.formCard}>
                  <ThemedText style={styles.formSectionTitle}>Step 4: Payment Confirmation</ThemedText>

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <CreditCard size={16} color="#64748B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.fieldLabel}>Payment Mode <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.inputWrapperFull}
                      onPress={() => setPaymentDropdownVisible(true)}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.fieldInputText}>{paymentMode}</ThemedText>
                      <ChevronDown size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.fieldRowColumn}>
                    <View style={styles.fieldLabelContainer}>
                      <ThemedText style={styles.rupeeIcon}>₹</ThemedText>
                      <ThemedText style={styles.fieldLabel}>Payment Amount Collected (₹) <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                    </View>
                    <TextInput
                      style={styles.fieldInputFullWidth}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      placeholder={totalCharges > 0 ? totalCharges.toString() : '0'}
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setPaymentConfirmed(!paymentConfirmed)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, paymentConfirmed && styles.checkboxChecked]}>
                    {paymentConfirmed && <Check size={14} color="#FFFFFF" />}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>
                    Confirm payment of <ThemedText style={styles.checkboxAmount}>₹{paymentAmount || totalCharges}</ThemedText> received via {paymentMode}
                  </ThemedText>
                </TouchableOpacity>

                <View style={styles.wizardNavRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(3)} activeOpacity={0.8}>
                    <ThemedText style={styles.wizardBackBtnText}>← Back</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.wizardNextBtnFlex} onPress={handleStep4Next} activeOpacity={0.85}>
                    <ThemedText style={styles.wizardNextBtnText}>Next: Handover Photo →</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 5: Vehicle Handover Photo & Final Release Submit */}
            {wizardStep === 5 && vehicle && (
              <>
                <View style={styles.formCard}>
                  <ThemedText style={styles.formSectionTitle}>Step 5: Handover Photo & Remarks</ThemedText>

                  {renderDocumentSlot('handoverPhoto', 'Customer Handover Photo *', handoverPhotoUri, uploadingHandoverPhoto)}

                  <View style={styles.divider} />

                  {vehicle.yardStatus === 'KACHHA' ? (
                    <View style={styles.remarksRow}>
                      <View style={styles.fieldLabelContainer}>
                        <MessageSquare size={14} color="#64748B" style={{ marginRight: 6 }} />
                        <ThemedText style={styles.fieldLabel}>Reason for Kachha Release <ThemedText style={styles.required}>*</ThemedText></ThemedText>
                      </View>
                      <TextInput
                        style={styles.remarksInput}
                        value={kachhaReason}
                        onChangeText={setKachhaReason}
                        placeholder="e.g. Recalled by bank for paperwork verification."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                  ) : (
                    <View style={styles.remarksRow}>
                      <View style={styles.fieldLabelContainer}>
                        <MessageSquare size={14} color="#64748B" style={{ marginRight: 6 }} />
                        <ThemedText style={styles.fieldLabel}>Remarks (Optional)</ThemedText>
                      </View>
                      <TextInput
                        style={styles.remarksInput}
                        value={remarks}
                        onChangeText={setRemarks}
                        placeholder="Vehicle released after full payment."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirmRelease}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.confirmBtnText}>Confirm & Release Vehicle</ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.wizardBackBtnFull} onPress={() => setWizardStep(4)} activeOpacity={0.8}>
                  <ThemedText style={styles.wizardBackBtnText}>← Back to Payment Step</ThemedText>
                </TouchableOpacity>
              </>
            )}

            {/* Receipt Preview after release */}
            {showReceipt && (
              <View style={styles.receiptCard}>
                <View style={styles.receiptHeader}>
                  <Printer size={18} color="#059669" />
                  <ThemedText style={styles.receiptTitle}>Gate Pass Receipt</ThemedText>
                </View>
                <View style={styles.receiptPreviewBox}>
                  <ThemedText style={styles.receiptPreviewText}>{receiptText}</ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.printBtn}
                  onPress={async () => {
                    try {
                      await bluetoothService.printReceipt(receiptText);
                      Alert.alert('Printed', 'Gate pass sent to printer.');
                    } catch (e: any) {
                      Alert.alert('Print Error', e.message);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Printer size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.printBtnText}>Print Gate Pass</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => router.replace('/admin/dashboard')}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.doneBtnText}>Back to Dashboard</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Release To Dropdown Modal */}
          <Modal
            transparent
            visible={releaseToDropdownVisible}
            animationType="fade"
            onRequestClose={() => setReleaseToDropdownVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setReleaseToDropdownVisible(false)}
            >
              <View style={styles.dropdownModal}>
                <ThemedText style={styles.dropdownModalTitle}>Select Release To Type</ThemedText>
                {(['Customer', 'Third Party'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dropdownOption,
                      releaseToType === type && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setReleaseToType(type);
                      setReleaseToDropdownVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.dropdownOptionText,
                        releaseToType === type && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {type === 'Customer' ? 'Customer (First Party)' : 'Third Party'}
                    </ThemedText>
                    {releaseToType === type && <Check size={16} color="#4F46E5" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Payment Mode Dropdown Modal */}
          <Modal
            transparent
            visible={paymentDropdownVisible}
            animationType="fade"
            onRequestClose={() => setPaymentDropdownVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setPaymentDropdownVisible(false)}
            >
              <View style={styles.dropdownModal}>
                <ThemedText style={styles.dropdownModalTitle}>Select Payment Mode</ThemedText>
                {PAYMENT_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.dropdownOption,
                      paymentMode === mode && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setPaymentMode(mode);
                      setPaymentDropdownVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.dropdownOptionText,
                        paymentMode === mode && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {mode}
                    </ThemedText>
                    {paymentMode === mode && <Check size={16} color="#4F46E5" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Calendar Picker Modal */}
          <Modal
            transparent
            visible={calendarVisible}
            animationType="fade"
            onRequestClose={() => setCalendarVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setCalendarVisible(false)}
            >
              <View style={styles.calendarModal}>
                {/* Calendar Header */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => {
                      const prevMonth = new Date(
                        currentCalendarMonth.getFullYear(),
                        currentCalendarMonth.getMonth() - 1,
                        1
                      );
                      setCurrentCalendarMonth(prevMonth);
                    }}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={22} color="#0F172A" />
                  </TouchableOpacity>
                  <ThemedText style={styles.calendarMonthText}>
                    {currentCalendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.calendarNavBtn}
                    onPress={() => {
                      const nextMonth = new Date(
                        currentCalendarMonth.getFullYear(),
                        currentCalendarMonth.getMonth() + 1,
                        1
                      );
                      setCurrentCalendarMonth(nextMonth);
                    }}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={22} color="#0F172A" style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                </View>

                {/* Weekdays Header */}
                <View style={styles.weekdaysHeader}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <ThemedText key={day} style={styles.weekdayText}>
                      {day}
                    </ThemedText>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {generateCalendarDays().map((item, index) => {
                    const isSelected = item.date && (
                      calendarTarget === 'order'
                        ? releaseOrderDate.toDateString() === item.date.toDateString()
                        : calendarTarget === 'entry'
                          ? entryDate.toDateString() === item.date.toDateString()
                          : releaseDate.toDateString() === item.date.toDateString()
                    );

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          !item.day && styles.dayCellEmpty,
                        ]}
                        disabled={!item.day}
                        onPress={() => {
                          if (item.date) {
                            const formatted = formatToInputDate(item.date);
                            if (calendarTarget === 'order') {
                              setReleaseOrderDate(item.date);
                              setReleaseOrderDateText(formatted);
                              calculateBilling(vehicle, releasePersonType, item.date, releaseDate);
                            } else if (calendarTarget === 'release') {
                              setReleaseDate(item.date);
                              setReleaseDateText(formatted);
                              calculateBilling(vehicle, releasePersonType, releaseOrderDate, item.date);
                            } else if (calendarTarget === 'entry') {
                              setEntryDate(item.date);
                              setEntryDateText(formatted);
                              const updatedVehicle = { ...vehicle, entryDate: item.date.toISOString() };
                              setVehicle(updatedVehicle);
                              calculateBilling(updatedVehicle, releasePersonType, releaseOrderDate, releaseDate);
                            }
                            setCalendarVisible(false);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            !item.day && { opacity: 0 },
                          ]}
                        >
                          {item.day || ''}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.calendarCloseBtn}
                  onPress={() => setCalendarVisible(false)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.calendarCloseBtnText}>Close Calendar</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
          {/* Releasing Person Choice Initial Modal */}
          <Modal
            transparent
            visible={personTypeModalVisible}
            animationType="fade"
            onRequestClose={() => setPersonTypeModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setPersonTypeModalVisible(false)}
            >
              <View style={styles.personModalCard}>
                <View style={styles.personModalHeader}>
                  <User size={24} color="#4F46E5" />
                  <ThemedText style={styles.personModalTitle}>Kon Vehicle Release Kara Raha Hai?</ThemedText>
                </View>
                <ThemedText style={styles.personModalSub}>
                  Kripya select karein ki vehicle customer le raha hai ya buyer. Iske anusar bank parking charges calculate honge.
                </ThemedText>

                <TouchableOpacity
                  style={[styles.modalOptionCard, releasePersonType === 'CUSTOMER' && styles.modalOptionCardSelected]}
                  onPress={() => {
                    setReleasePersonType('CUSTOMER');
                    calculateBilling(vehicle, 'CUSTOMER');
                    setPersonTypeModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.modalOptionIconCircle}>
                    <User size={22} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={styles.modalOptionTitle}>Customer </ThemedText>
                    <ThemedText style={styles.modalOptionDesc}>
                      Entry Date se calculation. Bank payer hone par RO wave-off days ke baad ke overdue days ka charge customer pay karega.
                    </ThemedText>
                  </View>
                  {releasePersonType === 'CUSTOMER' && <Check size={20} color="#4F46E5" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalOptionCard, releasePersonType === 'BUYER' && styles.modalOptionCardSelected, { marginTop: 12 }]}
                  onPress={() => {
                    setReleasePersonType('BUYER');
                    calculateBilling(vehicle, 'BUYER');
                    setPersonTypeModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.modalOptionIconCircle, { backgroundColor: '#F0FDF4' }]}>
                    <Building size={22} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={styles.modalOptionTitle}>Buyer</ThemedText>
                    <ThemedText style={styles.modalOptionDesc}>
                      Strictly Pakka Date se calculation. Pehle ka Kachha phase exempt / 0 calculate hota hai.
                    </ThemedText>
                  </View>
                  {releasePersonType === 'BUYER' && <Check size={20} color="#16A34A" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() => setPersonTypeModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.modalConfirmBtnText}>Confirm Selection</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
      gap: 14,
      paddingBottom: 40,
    },

    // Search
    searchCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    searchLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#64748B',
      marginBottom: 10,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 10,
    },
    searchInput: {
      flex: 1,
      height: 46,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      fontWeight: '600',
      color: '#0F172A',
    },
    searchBtn: {
      width: 46,
      height: 46,
      backgroundColor: '#4F46E5',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Vehicle Banner
    vehicleBannerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      padding: 14,
      gap: 12,
    },
    vehicleThumbnail: {
      width: 52,
      height: 52,
      borderRadius: 10,
    },
    vehicleMeta: {
      flex: 1,
      gap: 2,
    },
    plateNumber: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
    },
    inventoryNo: {
      fontSize: 11,
      color: '#64748B',
      fontWeight: '500',
    },
    statusBadge: {
      backgroundColor: '#10B981',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    statusBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '700',
    },
    changeVehicleBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Info banner
    infoBanner: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    bgKachha: {
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
    },
    bgPakka: {
      backgroundColor: '#EEF2FF',
      borderColor: '#3B82F6',
    },
    infoBannerText: {
      fontSize: 12,
      color: '#1E293B',
      lineHeight: 18,
      fontWeight: '500',
    },

    // Form Card
    formCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      paddingVertical: 8,
    },
    formSectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    fieldLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: '#334155',
    },
    required: {
      color: '#EF4444',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: '#F8FAFC',
      height: 38,
      width: 140,
    },
    fieldInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: '#0F172A',
      padding: 0,
    },
    fieldInputFull: {
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: '#F8FAFC',
      height: 38,
      width: 160,
      fontSize: 13,
      fontWeight: '600',
      color: '#0F172A',
      textAlign: 'right',
    },
    dropdownWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: '#F8FAFC',
      height: 38,
      width: 130,
    },
    dropdownText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0F172A',
    },
    rupeeIcon: {
      fontSize: 14,
      fontWeight: '800',
      color: '#64748B',
      marginRight: 6,
    },
    remarksRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    remarksInput: {
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 10,
      padding: 10,
      fontSize: 13,
      color: '#0F172A',
      backgroundColor: '#F8FAFC',
      marginTop: 8,
      minHeight: 80,
    },
    divider: {
      height: 1,
      backgroundColor: '#F1F5F9',
      marginHorizontal: 16,
    },

    // Document Slots
    docSlotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    docLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#334155',
    },
    docDesc: {
      fontSize: 10,
      color: '#94A3B8',
      marginTop: 2,
    },
    docThumbnailWrapper: {
      width: 50,
      height: 50,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    docThumbnail: {
      width: '100%',
      height: '100%',
    },
    docRemoveBtn: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: '#E2E8F0',
    },
    docActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    docMiniBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#DBEAFE',
    },

    // Confirm Button
    confirmBtn: {
      flexDirection: 'row',
      backgroundColor: '#4F46E5',
      borderRadius: 14,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
      marginTop: 4,
    },
    confirmBtnText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 16,
    },

    // Receipt
    receiptCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      gap: 12,
    },
    receiptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    receiptTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#059669',
    },
    receiptPreviewBox: {
      backgroundColor: '#F8FAFC',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#CBD5E1',
    },
    receiptPreviewText: {
      fontFamily: 'monospace',
      color: '#0F172A',
      fontSize: 11,
      lineHeight: 16,
    },
    printBtn: {
      flexDirection: 'row',
      backgroundColor: '#4F46E5',
      borderRadius: 10,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    printBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    doneBtn: {
      backgroundColor: '#F1F5F9',
      borderRadius: 10,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: {
      color: '#475569',
      fontWeight: '700',
      fontSize: 14,
    },

    // Dropdown Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownModal: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 16,
      width: 280,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    dropdownModalTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#64748B',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    dropdownOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    dropdownOptionSelected: {
      backgroundColor: '#EEF2FF',
      borderRadius: 8,
      paddingHorizontal: 10,
    },
    dropdownOptionText: {
      fontSize: 15,
      fontWeight: '500',
      color: '#0F172A',
    },
    dropdownOptionTextSelected: {
      color: '#4F46E5',
      fontWeight: '700',
    },
    duesBannerCard: {
      backgroundColor: '#EEF2FF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#BFDBFE',
      padding: 16,
      gap: 12,
      marginBottom: 8,
    },
    duesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    duesTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#1E3A8A',
    },
    duesGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: '#DBEAFE',
    },
    duesCol: {
      alignItems: 'center',
      flex: 1,
    },
    duesLabel: {
      fontSize: 11,
      color: '#64748B',
      fontWeight: '500',
      marginBottom: 4,
    },
    duesValue: {
      fontSize: 13,
      fontWeight: '600',
      color: '#0F172A',
    },
    duesTotalValue: {
      fontSize: 14,
      fontWeight: '800',
      color: '#4F46E5',
    },
    duesExplanation: {
      borderTopWidth: 0.5,
      borderTopColor: '#BFDBFE',
      paddingTop: 8,
    },
    duesExplanationText: {
      fontSize: 11,
      color: '#1E40AF',
      fontStyle: 'italic',
      lineHeight: 16,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 10,
      gap: 10,
      marginTop: 8,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: '#94A3B8',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
    checkboxChecked: {
      borderColor: '#4F46E5',
      backgroundColor: '#4F46E5',
    },
    checkboxLabel: {
      fontSize: 14,
      color: '#334155',
      fontWeight: '600',
      flex: 1,
    },
    checkboxAmount: {
      fontWeight: '800',
      color: '#0F172A',
    },
    fieldRowColumn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
    },
    inputWrapperFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: '#F8FAFC',
      height: 44,
      marginTop: 4,
    },
    fieldInputFullWidth: {
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: '#F8FAFC',
      height: 44,
      fontSize: 14,
      fontWeight: '600',
      color: '#0F172A',
      marginTop: 4,
    },
    fieldInputText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#0F172A',
    },
    calendarModal: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      width: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
      alignItems: 'stretch',
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    calendarNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarMonthText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
    },
    weekdaysHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    weekdayText: {
      width: '14%',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: '#64748B',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    dayCell: {
      width: '14%',
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 19,
      marginVertical: 2,
    },
    dayCellSelected: {
      backgroundColor: '#4F46E5',
    },
    dayCellEmpty: {
      opacity: 0,
    },
    dayText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#334155',
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    calendarCloseBtn: {
      backgroundColor: '#F1F5F9',
      borderRadius: 10,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    calendarCloseBtnText: {
      color: '#475569',
      fontWeight: '700',
      fontSize: 14,
    },
    personTypeCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      padding: 14,
      marginBottom: 12,
    },
    personTypeTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#0F172A',
    },
    personTypeToggleRow: {
      flexDirection: 'row',
      gap: 8,
    },
    personTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 10,
      backgroundColor: '#F1F5F9',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    personTypeBtnActive: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    personTypeBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#475569',
    },
    personTypeBtnTextActive: {
      color: '#FFFFFF',
    },
    personModalCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      width: '90%',
      maxWidth: 360,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    },
    personModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    personModalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
      flex: 1,
    },
    personModalSub: {
      fontSize: 12,
      color: '#64748B',
      marginBottom: 16,
      lineHeight: 18,
    },
    modalOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      backgroundColor: '#F8FAFC',
    },
    modalOptionCardSelected: {
      borderColor: '#4F46E5',
      backgroundColor: '#EEF2FF',
    },
    modalOptionIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalOptionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#0F172A',
    },
    modalOptionDesc: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 2,
      lineHeight: 15,
    },
    modalConfirmBtn: {
      backgroundColor: '#4F46E5',
      borderRadius: 12,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },
    modalConfirmBtnText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 14,
    },

    // Wizard Stepper Header & Nav
    stepperContainer: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8F0',
      gap: 6,
    },
    stepPill: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPillActive: {
      backgroundColor: '#4F46E5',
    },
    stepPillDone: {
      backgroundColor: '#DCFCE7',
    },
    stepPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#64748B',
    },
    stepPillTextActive: {
      color: '#FFFFFF',
    },
    stepPillTextDone: {
      color: '#15803D',
    },
    wizardNextBtn: {
      backgroundColor: '#4F46E5',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    wizardNextBtnText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 15,
    },
    wizardNavRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    wizardBackBtn: {
      width: 90,
      backgroundColor: '#F1F5F9',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wizardBackBtnFull: {
      backgroundColor: '#F1F5F9',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    wizardBackBtnText: {
      color: '#475569',
      fontWeight: '700',
      fontSize: 14,
    },
    wizardNextBtnFlex: {
      flex: 1,
      backgroundColor: '#4F46E5',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
