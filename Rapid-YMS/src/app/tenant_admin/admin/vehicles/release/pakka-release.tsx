import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CheckCircle2,
  Calendar,
  Camera,
  Image as ImageIcon,
  FileText,
  Upload,
  User,
  Phone,
  CreditCard,
  X,
  Calculator,
  ShieldCheck,
  Receipt,
  Car,
  RotateCcw,
  Check,
  ChevronDown,
  Lock,
  Banknote,
  Smartphone,
  Layers,
  FileCheck,
  Sparkles,
  Stamp,
  PenTool,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  HelpCircle,
  Edit3,
  Building2,
} from 'lucide-react-native';
import ReleaseHeader from './header';
import GatePassModal from './GatePassModal';
import {
  PaymentMode,
  ReleaseDocAttachment,
  GatePassResult,
  ReleasePersonType,
} from './types';
import {
  getVehicleById,
  getVehicles,
  directReleaseVehicle,
  uploadFileToStorage,
  saveRoManualOverride,
} from '@/services/api';
import { parseRoText, ParsedRoDocument } from '@/utils/roOcrParser';
import { performRealRoOcr } from '@/services/ocrService';

type IndianIdType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'Driving License'
  | 'Voter ID'
  | 'Passport';

const INDIAN_ID_TYPES: IndianIdType[] = [
  'Aadhaar Card',
  'PAN Card',
  'Driving License',
  'Voter ID',
  'Passport',
];

const PAYMENT_MODES: { key: PaymentMode; label: string }[] = [
  { key: 'Cash', label: 'Cash' },
  { key: 'Online', label: 'Online (UPI / QR / Bank)' },
  { key: 'Cash + Online', label: 'Cash + Online' },
  { key: 'Cheque', label: 'Cheque' },
  { key: 'DD', label: 'Demand Draft (DD)' },
  { key: 'NEFT/RTGS', label: 'NEFT / RTGS' },
];

export default function PakkaReleaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, plate } = useLocalSearchParams<{ id?: string; plate?: string }>();

  // 1. Vehicle State
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // Dropdown Modals Visibility
  const [paymentModeDropdownVisible, setPaymentModeDropdownVisible] = useState(false);
  const [idTypeDropdownVisible, setIdTypeDropdownVisible] = useState(false);

  // =================================================================
  // STEP 1: RELEASE ORDER DOCUMENT & REAL OCR PARSER
  // =================================================================
  const [roLetterDoc, setRoLetterDoc] = useState<ReleaseDocAttachment | null>(null);
  const [isScanningRo, setIsScanningRo] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [roScanData, setRoScanData] = useState<ParsedRoDocument | null>(null);

  // =================================================================
  // STEP 2: HANDOVER VERIFICATION (IS THIS PUSHPENDRA SINGH?)
  // =================================================================
  // null = pending, true = 1st party (Pushpendra Singh), false = 3rd party representative
  const [isFirstPartyCustomer, setIsFirstPartyCustomer] = useState<boolean | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [representativeRemarks, setRepresentativeRemarks] = useState('');

  // =================================================================
  // STEP 3: DATES & STAY TARIFF CALCULATION
  // =================================================================
  const [roDate, setRoDate] = useState<Date>(new Date(2026, 7, 19)); // 19 Aug 2026 from IDFC letter
  const [waiverDaysConfig, setWaiverDaysConfig] = useState<number>(2); // 2 Days (48 Hours) from letter
  const [approvedTillDate, setApprovedTillDate] = useState<Date>(new Date(2026, 7, 21)); // 21 Aug 2026
  const [releaseDate, setReleaseDate] = useState<Date>(new Date()); // Today: 23 Aug 2026

  // Date picker control
  const [showRoDatePicker, setShowRoDatePicker] = useState(false);
  const [dailyRate, setDailyRate] = useState<number>(150);

  // =================================================================
  // STEP 4: PAYMENT MODE
  // =================================================================
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [onlinePaidToName, setOnlinePaidToName] = useState('');
  const [onlineScreenshot, setOnlineScreenshot] = useState<ReleaseDocAttachment | null>(null);

  // Split Payment Inputs (Cash + Online)
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitOnlineAmount, setSplitOnlineAmount] = useState('');

  // =================================================================
  // STEP 5: CUSTOMER ID PROOF (FRONT + BACK DUAL UPLOAD)
  // =================================================================
  const [selectedIdType, setSelectedIdType] = useState<IndianIdType | null>(null);
  const [idNumberText, setIdNumberText] = useState('');
  const [idProofDocFront, setIdProofDocFront] = useState<ReleaseDocAttachment | null>(null);
  const [idProofDocBack, setIdProofDocBack] = useState<ReleaseDocAttachment | null>(null);

  // =================================================================
  // STEP 6: HANDOVER PHOTO WITH VEHICLE
  // =================================================================
  const [handoverPhoto, setHandoverPhoto] = useState<ReleaseDocAttachment | null>(null);

  // Upload modal target
  const [activeUploadTarget, setActiveUploadTarget] = useState<
    'ro_letter' | 'idproof_front' | 'idproof_back' | 'screenshot' | 'handover' | null
  >(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [gatePassResult, setGatePassResult] = useState<GatePassResult | null>(null);
  const [showGatePassModal, setShowGatePassModal] = useState(false);

  const isTwoSidedId =
    selectedIdType === 'Aadhaar Card' ||
    selectedIdType === 'Driving License' ||
    selectedIdType === 'Voter ID';

  // =================================================================
  // LOAD VEHICLE DATA
  // =================================================================
  const fetchVehicle = useCallback(async () => {
    if (!id && !plate) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let data = null;
      if (id) {
        const res = await getVehicleById(id);
        data = res?.data || res;
      } else if (plate) {
        const res = await getVehicles({ search: plate.trim(), limit: 1 });
        const items = res?.data || res?.vehicles || [];
        if (items.length > 0) data = items[0];
      }

      if (data) {
        setVehicle(data);
        if (data.customerName) setRecipientName(data.customerName);
        if (data.customerPhone) setRecipientPhone(data.customerPhone);

        const vType = data.vehicleType || 'FW';
        const bankRate = data.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vType);
        const resolvedDaily =
          bankRate?.dailyRate ||
          (vType === 'TW' ? 60 : vType === 'THREE_W' ? 100 : vType === 'FW' ? 150 : 250);
        setDailyRate(resolvedDaily);
      }
    } catch (err: any) {
      console.warn('[Fetch Pakka Vehicle Error]', err);
    } finally {
      setLoading(false);
    }
  }, [id, plate]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  // Manual Review / Override Modal State
  const [manualEditModalVisible, setManualEditModalVisible] = useState(false);
  const [editFieldName, setEditFieldName] = useState('roDate');
  const [editFieldValue, setEditFieldValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingManualEdit, setSavingManualEdit] = useState(false);

  // =================================================================
  // RUN REAL RO DOCUMENT OCR PARSER
  // =================================================================
  const triggerAiRoScan = async (attachment: ReleaseDocAttachment) => {
    setIsScanningRo(true);
    setScanStepIndex(0);

    const stepsTimer = setInterval(() => {
      setScanStepIndex((prev) => (prev < 3 ? prev + 1 : prev));
    }, 400);

    try {
      // 1. Perform Real Live OCR Parsing on the Uploaded Document Image / PDF via Backend Engine
      const parsed = await performRealRoOcr(attachment.uri, vehicle);

      clearInterval(stepsTimer);
      setIsScanningRo(false);

      setRoScanData(parsed);

      // Set Dates from Real OCR if detected
      if (parsed.roDate) {
        setRoDate(parsed.roDate);
      }
      if (parsed.waiverDays) {
        setWaiverDaysConfig(parsed.waiverDays);
      }
      if (parsed.approvedTillDate) {
        setApprovedTillDate(parsed.approvedTillDate);
      }

      // Handle Customer match status
      if (parsed.requiresThirdPartyAuth) {
        setIsFirstPartyCustomer(false);
      } else if (parsed.authorizedCustomer) {
        setIsFirstPartyCustomer(true);
        setRecipientName(parsed.authorizedCustomer);
      }

      // Auto-prefill vehicle registration if missing in yard record
      if (!vehicle?.vehicleNumber && parsed.registrationNumber) {
        setVehicle((prev: any) => ({
          ...(prev || {}),
          vehicleNumber: parsed.registrationNumber,
          customerName: parsed.authorizedCustomer || prev?.customerName,
        }));
      }

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.notificationAsync(
          parsed.overallStatus === 'BLOCKED'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
    } catch (err) {
      clearInterval(stepsTimer);
      setIsScanningRo(false);
      console.warn('[Real OCR Scan Failed, using local fallback]:', err);
      const fallbackParsed = parseRoText('', vehicle);
      setRoScanData(fallbackParsed);
    }
  };

  const handleOpenManualEdit = (fieldName: string, currentVal: string) => {
    setEditFieldName(fieldName);
    setEditFieldValue(currentVal || '');
    setEditReason('');
    setManualEditModalVisible(true);
  };

  const handleSaveManualEdit = async () => {
    if (!editFieldValue.trim()) {
      Alert.alert('Required', 'Please enter a valid value.');
      return;
    }
    if (!editReason.trim() || editReason.trim().length < 3) {
      Alert.alert('Audit Reason Required', 'Please provide a valid reason for manual override.');
      return;
    }

    try {
      setSavingManualEdit(true);
      const vehicleId = vehicle?.id || id;
      if (roScanData?.documentId && vehicleId) {
        await saveRoManualOverride(vehicleId, {
          documentId: roScanData.documentId,
          fieldName: editFieldName,
          newValue: editFieldValue.trim(),
          reason: editReason.trim(),
        });
      }

      // Update local state based on field edited
      if (editFieldName === 'roDate') {
        const d = new Date(editFieldValue.trim());
        if (!isNaN(d.getTime())) {
          setRoDate(d);
          const appTill = new Date(d);
          appTill.setDate(appTill.getDate() + waiverDaysConfig);
          setApprovedTillDate(appTill);
        }
      } else if (editFieldName === 'authorizedCustomer') {
        setRoScanData((prev: any) => (prev ? { ...prev, authorizedCustomer: editFieldValue.trim(), isCustomerMatched: true } : prev));
        if (isFirstPartyCustomer) setRecipientName(editFieldValue.trim());
      } else if (editFieldName === 'registrationNumber') {
        setRoScanData((prev: any) => (prev ? { ...prev, registrationNumber: editFieldValue.trim().toUpperCase(), isVehicleMatched: true } : prev));
      } else if (editFieldName === 'bankName') {
        setRoScanData((prev: any) => (prev ? { ...prev, bankName: editFieldValue.trim(), isFinancierMatched: true } : prev));
      }

      setManualEditModalVisible(false);
      Alert.alert('Updated', 'Field manually updated and recorded in audit log.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update field');
    } finally {
      setSavingManualEdit(false);
    }
  };

  // Handover Confirmation Handlers
  const handleConfirmFirstParty = () => {
    setIsFirstPartyCustomer(true);
    const customer = roScanData?.authorizedCustomer || vehicle?.customerName || 'Customer';
    setRecipientName(customer);
    if (vehicle?.customerPhone) setRecipientPhone(vehicle.customerPhone);
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleConfirmThirdParty = () => {
    setIsFirstPartyCustomer(false);
    setRecipientName('');
    setRecipientPhone('');
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Date Change Handler
  const handleRoDatePicked = (event: any, selectedDate?: Date) => {
    setShowRoDatePicker(false);
    if (selectedDate) {
      setRoDate(selectedDate);
      const appTill = new Date(selectedDate);
      appTill.setDate(appTill.getDate() + waiverDaysConfig);
      setApprovedTillDate(appTill);
    }
  };

  const handleSetWaiverDays = (days: number) => {
    setWaiverDaysConfig(days);
    const appTill = new Date(roDate);
    appTill.setDate(appTill.getDate() + days);
    setApprovedTillDate(appTill);
  };

  // =================================================================
  // REAL-TIME TARIFF & WAIVE-OFF CALCULATION
  // =================================================================
  // Days since RO Date
  const diffGross = Math.max(0, releaseDate.getTime() - roDate.getTime());
  const grossDaysSinceRO = Math.ceil(diffGross / (1000 * 60 * 60 * 24));
  const appliedWaiverDays = Math.min(grossDaysSinceRO, waiverDaysConfig);
  const chargeableDelayDays = Math.max(0, grossDaysSinceRO - appliedWaiverDays);

  // Bank covers in-yard stay; customer pays ONLY extra delay days beyond waive-off
  const customerPayableAmount = chargeableDelayDays * dailyRate;
  const finalTotalAmount = Math.round(customerPayableAmount * 100) / 100;
  const isFreeRelease = finalTotalAmount === 0;

  // Split calculation helpers
  const numSplitCash = parseFloat(splitCashAmount) || 0;
  const numSplitOnline = parseFloat(splitOnlineAmount) || 0;
  const splitTotalSum = Math.round((numSplitCash + numSplitOnline) * 100) / 100;
  const splitDifference = Math.round((finalTotalAmount - splitTotalSum) * 100) / 100;

  // Bidirectional auto-balance handlers
  const handleCashChange = (val: string) => {
    setSplitCashAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && finalTotalAmount > 0) {
      const remaining = Math.max(0, Math.round((finalTotalAmount - num) * 100) / 100);
      setSplitOnlineAmount(remaining.toString());
    } else if (val === '') {
      setSplitOnlineAmount(finalTotalAmount.toString());
    }
  };

  const handleOnlineChange = (val: string) => {
    setSplitOnlineAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && finalTotalAmount > 0) {
      const remaining = Math.max(0, Math.round((finalTotalAmount - num) * 100) / 100);
      setSplitCashAmount(remaining.toString());
    } else if (val === '') {
      setSplitCashAmount(finalTotalAmount.toString());
    }
  };

  const handleSelectPaymentMode = (pm: PaymentMode) => {
    setPaymentMode(pm);
    setPaymentModeDropdownVisible(false);

    if (pm === 'Cash + Online' && finalTotalAmount > 0) {
      if (!splitCashAmount && !splitOnlineAmount) {
        setSplitCashAmount('');
        setSplitOnlineAmount(finalTotalAmount.toString());
      }
    }
  };

  const handleSelectIdType = (type: IndianIdType) => {
    setSelectedIdType(type);
    setIdTypeDropdownVisible(false);
    setIdProofDocFront(null);
    setIdProofDocBack(null);
  };

  // =================================================================
  // PROGRESSIVE VALIDATION FLAGS
  // =================================================================
  // Step 1: RO letter uploaded & scanned
  const isStep1Fulfilled = roLetterDoc !== null && roScanData !== null;

  // Step 2: Handover confirmed with valid name + 10-digit phone
  const isStep2Fulfilled =
    isStep1Fulfilled &&
    isFirstPartyCustomer !== null &&
    recipientName.trim().length >= 2 &&
    recipientPhone.trim().length === 10;

  // Step 3: Tariff Calculation fulfilled
  const isStep3Fulfilled = isStep2Fulfilled;

  // Step 4: Payment mode validation (Bypassed if ₹0)
  const isStep4PaymentFulfilled =
    isStep3Fulfilled &&
    (isFreeRelease ||
      (paymentMode !== null &&
        (paymentMode === 'Cash' || paymentMode === 'Cheque' || paymentMode === 'DD' || paymentMode === 'NEFT/RTGS'
          ? true
          : paymentMode === 'Online'
          ? onlinePaidToName.trim().length >= 2 && onlineScreenshot !== null
          : paymentMode === 'Cash + Online'
          ? numSplitCash > 0 &&
            numSplitOnline > 0 &&
            onlinePaidToName.trim().length >= 2 &&
            onlineScreenshot !== null
          : true)));

  // Step 5: ID Proof (Front mandatory + Back if 2-sided)
  const isStep5IdProofFulfilled =
    isStep4PaymentFulfilled &&
    selectedIdType !== null &&
    idProofDocFront !== null &&
    (!isTwoSidedId || idProofDocBack !== null);

  // Step 6: Handover photo with vehicle attached
  const isStep6HandoverFulfilled = isStep5IdProofFulfilled && handoverPhoto !== null;

  // =================================================================
  // UPLOAD HANDLERS
  // =================================================================
  const openUpload = (target: 'ro_letter' | 'idproof_front' | 'idproof_back' | 'screenshot' | 'handover') => {
    setActiveUploadTarget(target);
  };

  const closeUpload = () => {
    setActiveUploadTarget(null);
  };

  const handleCameraCapture = async () => {
    const target = activeUploadTarget;
    closeUpload();
    if (!target) return;

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Needed', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const attachObj: ReleaseDocAttachment = { uri: localUri, type: 'image', isUploading: true };

        if (target === 'ro_letter') {
          setRoLetterDoc(attachObj);
          triggerAiRoScan(attachObj);
        } else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'image/jpeg');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, type: 'image', isUploading: false };

        if (target === 'ro_letter') setRoLetterDoc(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err: any) {
      console.warn('[Camera Error]', err);
    }
  };

  const handleGalleryPick = async () => {
    const target = activeUploadTarget;
    closeUpload();
    if (!target) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const attachObj: ReleaseDocAttachment = { uri: localUri, type: 'image', isUploading: true };

        if (target === 'ro_letter') {
          setRoLetterDoc(attachObj);
          triggerAiRoScan(attachObj);
        } else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'image/jpeg');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, type: 'image', isUploading: false };

        if (target === 'ro_letter') setRoLetterDoc(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err: any) {
      console.warn('[Gallery Error]', err);
    }
  };

  const handlePdfPick = async () => {
    const target = activeUploadTarget;
    closeUpload();
    if (!target) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const name = result.assets[0].name;
        const attachObj: ReleaseDocAttachment = { uri: localUri, name, type: 'pdf', isUploading: true };

        if (target === 'ro_letter') {
          setRoLetterDoc(attachObj);
          triggerAiRoScan(attachObj);
        } else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'application/pdf');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, name, type: 'pdf', isUploading: false };

        if (target === 'ro_letter') setRoLetterDoc(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err: any) {
      console.warn('[DocPicker Error]', err);
    }
  };

  // =================================================================
  // SUBMISSION
  // =================================================================
  const handleSubmitPakkaRelease = async () => {
    if (!vehicle && !roScanData?.registrationNumber) return;
    if (!isStep6HandoverFulfilled) {
      Alert.alert('Incomplete', 'Please complete all steps in sequence.');
      return;
    }

    if (paymentMode === 'Cash + Online' && splitDifference !== 0) {
      Alert.alert(
        'Split Mismatch',
        `Cash (₹${numSplitCash}) + Online (₹${numSplitOnline}) = ₹${splitTotalSum}.\nTarget is ₹${finalTotalAmount}.`
      );
      return;
    }

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setSubmitting(true);

      const recipientTypeStr: ReleasePersonType = isFirstPartyCustomer ? 'CUSTOMER' : 'BUYER';

      const payload = {
        releaseType: 'PAKKA',
        releasePersonType: recipientTypeStr,
        releaseOrderDoc: roLetterDoc!.uri,
        customerIdProof: idProofDocFront!.uri,
        customerIdProofBack: idProofDocBack?.uri,
        handoverPhoto1: handoverPhoto!.uri,
        handoverPhoto2:
          !isFreeRelease && (paymentMode === 'Online' || paymentMode === 'Cash + Online')
            ? onlineScreenshot?.uri
            : undefined,
        paidAmount: isFreeRelease ? 0 : finalTotalAmount,
        totalAmount: isFreeRelease ? 0 : finalTotalAmount,
        approvedTillDate: approvedTillDate.toISOString(),
        paymentMode: isFreeRelease ? 'Free / Nothing' : paymentMode || 'Cash',
        remarks: `Pakka Release (${roScanData?.bankName || 'Bank'}): ${recipientName} (${
          isFirstPartyCustomer ? 'Authorized Customer' : '3rd Party Representative'
        }) | RO Date: ${roDate.toISOString().split('T')[0]} | Delay Days: ${chargeableDelayDays}d | Mode: ${
          isFreeRelease
            ? 'Free (₹0)'
            : paymentMode === 'Cash + Online'
            ? `Cash: ₹${numSplitCash}, Online: ₹${numSplitOnline} (${onlinePaidToName})`
            : paymentMode === 'Online'
            ? `Online (${onlinePaidToName})`
            : paymentMode
        } | ID: ${selectedIdType} (${idNumberText || 'N/A'})`,
        releasedTo: recipientName.trim(),
        mobileNumber: recipientPhone.trim(),
      };

      const vehicleId = vehicle?.id || id;
      const res = await directReleaseVehicle(vehicleId, payload);

      if (res?.success && res?.data) {
        setGatePassResult(res.data);
        setShowGatePassModal(true);
      } else {
        throw new Error(res?.error || 'Failed to complete Pakka release');
      }
    } catch (err: any) {
      console.warn('[Pakka Release Error]', err);
      Alert.alert('Release Failed', err?.message || 'Could not complete Pakka release.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishGatePass = () => {
    setShowGatePassModal(false);
    if (vehicle?.id) {
      router.replace(`/tenant_admin/admin/vehicles/details/${vehicle.id}` as any);
    } else {
      router.replace('/tenant_admin/admin/vehicles' as any);
    }
  };

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);
  const vehicleNumber = (
    vehicle?.vehicleNumber ||
    roScanData?.registrationNumber ||
    'PAKKA RELEASE'
  ).toUpperCase();

  const idStepNumber = isFreeRelease ? 4 : 5;
  const handoverStepNumber = isFreeRelease ? 5 : 6;

  const SCAN_STEPS_TEXT = [
    'Scanning Bank Release Order / Delivery Note...',
    'Verifying Bank Seal & Authorized Signature...',
    'Extracting Issue Date & Grace Period...',
    'Detecting Yard Authority & Customer Details...',
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Clean Top Header */}
      <ReleaseHeader
        vehicleNumber={vehicleNumber}
        subtitle="Pakka Release Desk"
        onBackPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/tenant_admin/admin/vehicles' as any);
        }}
        onMenuPress={() => setMenuModalVisible(true)}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading vehicle details...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 85 }]}
        >
          {/* ========================================================= */}
          {/* STEP 1: UPLOAD BANK RELEASE ORDER & REAL OCR SCANNER      */}
          {/* ========================================================= */}
          <View style={[styles.stepCard, !isStep1Fulfilled && styles.stepCardActiveBorder]}>
            <View style={styles.stepHeaderRow}>
              <View style={[styles.stepBadge, isStep1Fulfilled && styles.stepBadgeDone]}>
                {isStep1Fulfilled ? (
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text style={styles.stepBadgeText}>1</Text>
                )}
              </View>
              <Text style={styles.stepTitle}>Upload Bank Release Order *</Text>
            </View>

            <View style={styles.uploadRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FileText size={14} color="#0062FF" />
                <Text style={styles.uploadTitle}>Release Order (RO Letter / PDF)</Text>
              </View>

              {roLetterDoc ? (
                <View style={styles.attachedPill}>
                  <CheckCircle2 size={14} color="#059669" />
                  <Text style={styles.attachedPillText}>Letter Attached</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setRoLetterDoc(null);
                      setRoScanData(null);
                      setIsFirstPartyCustomer(null);
                    }}
                  >
                    <X size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.attachBtn, { backgroundColor: '#0062FF', borderColor: '#0062FF' }]}
                  onPress={() => openUpload('ro_letter')}
                  activeOpacity={0.8}
                >
                  <Upload size={12} color="#FFFFFF" />
                  <Text style={[styles.attachBtnText, { color: '#FFFFFF' }]}>Upload RO</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Live Scanning HUD Animation */}
            {isScanningRo && (
              <View style={styles.scanningHudBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#0062FF" />
                  <Text style={styles.scanningHudTitle}>AI Document Scanner Active</Text>
                </View>
                <Text style={styles.scanningHudStep}>{SCAN_STEPS_TEXT[scanStepIndex]}</Text>
              </View>
            )}

            {/* Extracted RO Findings Summary */}
            {roScanData && (
              <View style={styles.roVerifiedCard}>
                <View style={styles.roVerifiedHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#059669" />
                    <Text style={styles.roVerifiedTitle} numberOfLines={1}>
                      {roScanData.bankName} {roScanData.documentType === 'DELIVERY_AUTHORIZATION' ? 'Delivery Note' : 'Release Order'}
                    </Text>
                  </View>
                  <View style={styles.confBadge}>
                    <Text style={styles.confBadgeText}>{roScanData.documentConfidence}% Confidence</Text>
                  </View>
                </View>

                {/* Real Detection Badges */}
                <View style={styles.badgesRow}>
                  <View style={[styles.verifiedPill, !roScanData.hasBankStamp && styles.pillWarning]}>
                    <Stamp size={11} color={roScanData.hasBankStamp ? '#059669' : '#D97706'} />
                    <Text style={[styles.verifiedPillText, !roScanData.hasBankStamp && styles.pillWarningText]}>
                      {roScanData.bankStampStatus} {roScanData.bankStampConfidence > 0 ? `(${Math.round(roScanData.bankStampConfidence * 100)}%)` : ''}
                    </Text>
                  </View>
                  <View style={[styles.verifiedPill, !roScanData.hasAuthorizedSign && styles.pillWarning]}>
                    <PenTool size={11} color={roScanData.hasAuthorizedSign ? '#059669' : '#D97706'} />
                    <Text style={[styles.verifiedPillText, !roScanData.hasAuthorizedSign && styles.pillWarningText]}>
                      {roScanData.authorizedSignStatus} {roScanData.signatureConfidence > 0 ? `(${Math.round(roScanData.signatureConfidence * 100)}%)` : ''}
                    </Text>
                  </View>
                </View>

                {/* Consistency Validation Checklist */}
                <View style={styles.validationListBox}>
                  <View style={styles.validationCheckRow}>
                    {roScanData.isVehicleMatched ? (
                      <CheckCircle2 size={13} color="#059669" />
                    ) : (
                      <AlertCircle size={13} color="#E11D48" />
                    )}
                    <Text style={[styles.validationCheckText, !roScanData.isVehicleMatched && { color: '#E11D48', fontWeight: '800' }]}>
                      Plate: {roScanData.registrationNumber || 'Not Detected'} {roScanData.isVehicleMatched ? '(Matched)' : '(Mismatch!)'}
                    </Text>
                  </View>

                  <View style={styles.validationCheckRow}>
                    {roScanData.isFinancierMatched ? (
                      <CheckCircle2 size={13} color="#059669" />
                    ) : (
                      <AlertCircle size={13} color="#D97706" />
                    )}
                    <Text style={styles.validationCheckText}>
                      Financier: {roScanData.bankName} {roScanData.isFinancierMatched ? '(Matched)' : '(Review)'}
                    </Text>
                  </View>

                  <View style={styles.validationCheckRow}>
                    {roScanData.isCustomerMatched ? (
                      <CheckCircle2 size={13} color="#059669" />
                    ) : (
                      <HelpCircle size={13} color="#0284C7" />
                    )}
                    <Text style={styles.validationCheckText}>
                      Customer: {roScanData.authorizedCustomer || 'Not Detected'} {roScanData.isCustomerMatched ? '(Direct Owner)' : '(3rd Party Rep)'}
                    </Text>
                  </View>
                </View>

                {/* Warning / Mismatch Alert Banner */}
                {(roScanData.blockingReasons?.length > 0 || roScanData.warningReasons?.length > 0 || roScanData.needsManualReview) && (
                  <View style={[styles.mismatchBanner, roScanData.blockingReasons?.length > 0 ? styles.mismatchCritical : styles.mismatchWarning]}>
                    <AlertCircle size={14} color={roScanData.blockingReasons?.length > 0 ? '#E11D48' : '#D97706'} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mismatchTitle, roScanData.blockingReasons?.length > 0 ? { color: '#E11D48' } : { color: '#B45309' }]}>
                        {roScanData.blockingReasons?.length > 0 ? 'Release Blocked (Critical Mismatch)' : 'Manual Review Recommended'}
                      </Text>
                      <Text style={styles.mismatchDesc}>
                        {[...(roScanData.blockingReasons || []), ...(roScanData.warningReasons || [])].join(' • ')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Extracted Details Grid */}
                <View style={styles.extractedGrid}>
                  {/* RO Date (Editable Picker) */}
                  <TouchableOpacity
                    style={styles.extractedItem}
                    onPress={() => setShowRoDatePicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.extractedLabel}>RO Issue Date</Text>
                      <Edit3 size={10} color="#0062FF" />
                    </View>
                    <Text style={[styles.extractedVal, { color: '#0062FF' }]}>
                      {roDate ? roDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }) : 'Not Detected'}
                    </Text>
                  </TouchableOpacity>

                  {/* Waive-off Days Quick Selector */}
                  <View style={styles.extractedItem}>
                    <Text style={styles.extractedLabel}>Waive-off Grace</Text>
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                      {[1, 2, 3].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.miniDayPill,
                            waiverDaysConfig === d && styles.miniDayPillActive,
                          ]}
                          onPress={() => handleSetWaiverDays(d)}
                        >
                          <Text
                            style={[
                              styles.miniDayPillText,
                              waiverDaysConfig === d && styles.miniDayPillTextActive,
                            ]}
                          >
                            {d}d ({d * 24}h)
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.extractedItem}>
                    <Text style={styles.extractedLabel}>Addressed To Yard</Text>
                    <Text style={styles.extractedVal} numberOfLines={1}>{roScanData.yardAddressee}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.extractedItem}
                    onPress={() => handleOpenManualEdit('authorizedCustomer', roScanData.authorizedCustomer)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.extractedLabel}>Authorized Customer</Text>
                      <Edit3 size={9} color="#059669" />
                    </View>
                    <Text style={[styles.extractedVal, { color: '#059669' }]} numberOfLines={1}>
                      {roScanData.authorizedCustomer || 'None'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showRoDatePicker && (
                  <DateTimePicker
                    value={roDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleRoDatePicked}
                  />
                )}
              </View>
            )}
          </View>

          {/* ========================================================= */}
          {/* STEP 2: HANDOVER VERIFICATION (IS THIS PUSHPENDRA SINGH?) */}
          {/* ========================================================= */}
          {isStep1Fulfilled ? (
            <View style={[styles.stepCard, !isStep2Fulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isStep2Fulfilled && styles.stepBadgeDone]}>
                  {isStep2Fulfilled ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepBadgeText}>2</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>Handover Recipient Confirmation *</Text>
              </View>

              {/* Selection Prompt */}
              <View style={styles.questionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={14} color="#0062FF" />
                  <Text style={styles.questionText}>
                    Kya vehicle lene authorized customer ({roScanData?.authorizedCustomer || vehicle?.customerName || 'Customer'}) aaya hai?
                  </Text>
                </View>

                {/* Yes / No Choice Buttons */}
                <View style={styles.twoColRow}>
                  <TouchableOpacity
                    style={[
                      styles.choiceBtn,
                      isFirstPartyCustomer === true && styles.choiceBtnActiveYes,
                    ]}
                    onPress={handleConfirmFirstParty}
                    activeOpacity={0.8}
                  >
                    <UserCheck size={15} color={isFirstPartyCustomer === true ? '#FFFFFF' : '#059669'} />
                    <Text
                      style={[
                        styles.choiceBtnText,
                        isFirstPartyCustomer === true && styles.choiceBtnTextActive,
                      ]}
                    >
                      YES ({roScanData?.authorizedCustomer || vehicle?.customerName || 'Customer'})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.choiceBtn,
                      isFirstPartyCustomer === false && styles.choiceBtnActiveNo,
                    ]}
                    onPress={handleConfirmThirdParty}
                    activeOpacity={0.8}
                  >
                    <UserX size={15} color={isFirstPartyCustomer === false ? '#FFFFFF' : '#E11D48'} />
                    <Text
                      style={[
                        styles.choiceBtnText,
                        isFirstPartyCustomer === false && styles.choiceBtnTextActive,
                      ]}
                    >
                      NO (3rd Party Rep)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recipient Contact Details */}
              {isFirstPartyCustomer !== null && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>
                        {isFirstPartyCustomer ? 'Customer Name *' : 'Representative Name *'}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Recipient Name *"
                        placeholderTextColor="#94A3B8"
                        value={recipientName}
                        onChangeText={setRecipientName}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Mobile Number *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="10-Digit Mobile *"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={recipientPhone}
                        onChangeText={setRecipientPhone}
                      />
                    </View>
                  </View>

                  {!isFirstPartyCustomer && (
                    <TextInput
                      style={styles.textInput}
                      placeholder="Authority / Letter Reference"
                      placeholderTextColor="#94A3B8"
                      value={representativeRemarks}
                      onChangeText={setRepresentativeRemarks}
                    />
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Upload & Scan Release Order first</Text>
            </View>
          )}

          {/* ========================================================= */}
          {/* STEP 3: ACCURATE TARIFF & WAIVE-OFF CALCULATION           */}
          {/* ========================================================= */}
          {isStep2Fulfilled ? (
            <View style={styles.stepCard}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, styles.stepBadgeDone]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
                <Text style={styles.stepTitle}>Stay & Waive-off Calculation</Text>
              </View>

              {/* Dates Row */}
              <View style={styles.twoColRow}>
                <View style={styles.dateDisplayCard}>
                  <Text style={styles.dateLabel}>RO Issue Date</Text>
                  <Text style={styles.dateVal}>
                    {roDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>

                <View style={[styles.dateDisplayCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.dateLabel, { color: '#059669' }]}>
                    Approved Till ({waiverDaysConfig}d Waiver)
                  </Text>
                  <Text style={[styles.dateVal, { color: '#059669' }]}>
                    {approvedTillDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>

              {/* Live Status Banner */}
              {isFreeRelease ? (
                <View style={styles.freeBanner}>
                  <CheckCircle2 size={15} color="#059669" strokeWidth={2.4} />
                  <Text style={styles.freeBannerText}>
                    Released Within {waiverDaysConfig * 24}h Grace Period — Total Payable: ₹0 (Free Release)
                  </Text>
                </View>
              ) : (
                <View style={styles.delayedBanner}>
                  <AlertCircle size={15} color="#D97706" />
                  <Text style={styles.delayedBannerText}>
                    Grace Expired by {chargeableDelayDays} Days ({chargeableDelayDays}d × ₹{dailyRate} = ₹
                    {customerPayableAmount})
                  </Text>
                </View>
              )}

              {/* Detailed Ledger Card */}
              <View style={styles.totalCard}>
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>In-Yard Stay (upto {roDate.getDate()} Aug)</Text>
                  <Text style={[styles.ledgerVal, { color: '#059669' }]}>Absorbed by Bank</Text>
                </View>
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>
                    RO Grace ({roDate.getDate()} - {approvedTillDate.getDate()} Aug = {waiverDaysConfig}d)
                  </Text>
                  <Text style={[styles.ledgerVal, { color: '#059669' }]}>Waived Off (₹0)</Text>
                </View>
                {!isFreeRelease && (
                  <View style={styles.ledgerRow}>
                    <Text style={styles.ledgerLabel}>
                      Delay ({approvedTillDate.getDate()} - {releaseDate.getDate()} Aug = {chargeableDelayDays}d @ ₹
                      {dailyRate})
                    </Text>
                    <Text style={styles.ledgerVal}>₹{customerPayableAmount}</Text>
                  </View>
                )}

                <View style={styles.finalTotalRow}>
                  <Text style={styles.finalTotalLabel}>CUSTOMER PAYABLE</Text>
                  <Text style={styles.finalTotalVal}>₹{finalTotalAmount.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          ) : isStep1Fulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Confirm Recipient in Step 2</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* STEP 4: PAYMENT MODE (SHOWN ONLY IF PAYING > ₹0)          */}
          {/* ========================================================= */}
          {!isFreeRelease && (
            isStep3Fulfilled ? (
              <View style={[styles.stepCard, !isStep4PaymentFulfilled && styles.stepCardActiveBorder]}>
                <View style={styles.stepHeaderRow}>
                  <View style={[styles.stepBadge, isStep4PaymentFulfilled && styles.stepBadgeDone]}>
                    {isStep4PaymentFulfilled ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text style={styles.stepBadgeText}>4</Text>
                    )}
                  </View>
                  <Text style={styles.stepTitle}>Payment Mode *</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dropdownBtn,
                    paymentMode ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
                  ]}
                  onPress={() => setPaymentModeDropdownVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownText, paymentMode && styles.dropdownTextFilled]}>
                    {paymentMode
                      ? PAYMENT_MODES.find((m) => m.key === paymentMode)?.label
                      : 'Select Payment Mode...'}
                  </Text>
                  <ChevronDown size={17} color="#64748B" />
                </TouchableOpacity>

                {/* 1. Single Online Payment */}
                {paymentMode === 'Online' && (
                  <View style={styles.onlineBox}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Kiske naam par payment hua hai? *"
                      placeholderTextColor="#94A3B8"
                      value={onlinePaidToName}
                      onChangeText={setOnlinePaidToName}
                    />

                    <View style={styles.uploadRow}>
                      <Text style={styles.uploadTitle}>Payment Screenshot *</Text>
                      {onlineScreenshot ? (
                        <View style={styles.attachedPill}>
                          <CheckCircle2 size={14} color="#059669" />
                          <Text style={styles.attachedPillText}>Uploaded</Text>
                          <TouchableOpacity onPress={() => setOnlineScreenshot(null)}>
                            <X size={13} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.attachBtn}
                          onPress={() => openUpload('screenshot')}
                          activeOpacity={0.8}
                        >
                          <Upload size={12} color="#0062FF" />
                          <Text style={styles.attachBtnText}>Upload</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* 2. Split Payment (Cash + Online) */}
                {paymentMode === 'Cash + Online' && (
                  <View style={styles.splitBox}>
                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Cash Amount (₹) *</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="Cash"
                          placeholderTextColor="#94A3B8"
                          value={splitCashAmount}
                          onChangeText={handleCashChange}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Online Amount (₹) *</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="Online"
                          placeholderTextColor="#94A3B8"
                          value={splitOnlineAmount}
                          onChangeText={handleOnlineChange}
                        />
                      </View>
                    </View>

                    <View
                      style={[
                        styles.splitSummaryCard,
                        splitDifference === 0 ? styles.splitMatch : styles.splitMismatch,
                      ]}
                    >
                      <Text style={styles.splitSummaryText}>
                        ₹{numSplitCash} (Cash) + ₹{numSplitOnline} (Online) = ₹{splitTotalSum}
                        {splitDifference === 0 ? '  ✓ Matched' : `  (Target: ₹${finalTotalAmount})`}
                      </Text>
                    </View>

                    <TextInput
                      style={styles.textInput}
                      placeholder="Kiske naam par online payment hua hai? *"
                      placeholderTextColor="#94A3B8"
                      value={onlinePaidToName}
                      onChangeText={setOnlinePaidToName}
                    />

                    <View style={styles.uploadRow}>
                      <Text style={styles.uploadTitle}>Online Receipt (₹{numSplitOnline}) *</Text>
                      {onlineScreenshot ? (
                        <View style={styles.attachedPill}>
                          <CheckCircle2 size={14} color="#059669" />
                          <Text style={styles.attachedPillText}>Uploaded</Text>
                          <TouchableOpacity onPress={() => setOnlineScreenshot(null)}>
                            <X size={13} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.attachBtn}
                          onPress={() => openUpload('screenshot')}
                          activeOpacity={0.8}
                        >
                          <Upload size={12} color="#0062FF" />
                          <Text style={styles.attachBtnText}>Upload</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : isStep2Fulfilled ? (
              <View style={styles.lockedStepCard}>
                <Lock size={13} color="#94A3B8" />
                <Text style={styles.lockedStepText}>Review Step 3</Text>
              </View>
            ) : null
          )}

          {/* ========================================================= */}
          {/* STEP 5: CUSTOMER ID PROOF (FRONT + BACK DUAL UPLOAD)      */}
          {/* ========================================================= */}
          {isStep4PaymentFulfilled ? (
            <View style={[styles.stepCard, !isStep5IdProofFulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isStep5IdProofFulfilled && styles.stepBadgeDone]}>
                  {isStep5IdProofFulfilled ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepBadgeText}>{idStepNumber}</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>Recipient ID Proof *</Text>
              </View>

              {/* ID Type Dropdown */}
              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  selectedIdType ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
                ]}
                onPress={() => setIdTypeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownText, selectedIdType && styles.dropdownTextFilled]}>
                  {selectedIdType || 'Select ID Proof Type...'}
                </Text>
                <ChevronDown size={17} color="#64748B" />
              </TouchableOpacity>

              {selectedIdType && (
                <>
                  <TextInput
                    style={[styles.textInput, { marginTop: 4 }]}
                    placeholder={`${selectedIdType} Number (Optional)`}
                    placeholderTextColor="#94A3B8"
                    value={idNumberText}
                    onChangeText={setIdNumberText}
                  />

                  {/* ID Front */}
                  <View style={styles.uploadRow}>
                    <Text style={styles.uploadTitle}>
                      {selectedIdType} {isTwoSidedId ? '(Front) *' : '*'}
                    </Text>
                    {idProofDocFront ? (
                      <View style={styles.attachedPill}>
                        <CheckCircle2 size={14} color="#059669" />
                        <Text style={styles.attachedPillText}>Front Attached</Text>
                        <TouchableOpacity onPress={() => setIdProofDocFront(null)}>
                          <X size={13} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.attachBtn}
                        onPress={() => openUpload('idproof_front')}
                        activeOpacity={0.8}
                      >
                        <Upload size={12} color="#0062FF" />
                        <Text style={styles.attachBtnText}>Attach Front</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* ID Back (for 2-sided IDs) */}
                  {isTwoSidedId && (
                    <View style={styles.uploadRow}>
                      <Text style={styles.uploadTitle}>{selectedIdType} (Back) *</Text>
                      {idProofDocBack ? (
                        <View style={styles.attachedPill}>
                          <CheckCircle2 size={14} color="#059669" />
                          <Text style={styles.attachedPillText}>Back Attached</Text>
                          <TouchableOpacity onPress={() => setIdProofDocBack(null)}>
                            <X size={13} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.attachBtn, { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]}
                          onPress={() => openUpload('idproof_back')}
                          activeOpacity={0.8}
                        >
                          <Upload size={12} color="#7C3AED" />
                          <Text style={[styles.attachBtnText, { color: '#7C3AED' }]}>Attach Back</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          ) : isStep3Fulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Complete previous step</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* STEP 6: HANDOVER PHOTO WITH VEHICLE                       */}
          {/* ========================================================= */}
          {isStep5IdProofFulfilled ? (
            <View style={[styles.stepCard, !isStep6HandoverFulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isStep6HandoverFulfilled && styles.stepBadgeDone]}>
                  {isStep6HandoverFulfilled ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepBadgeText}>{handoverStepNumber}</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>Customer Photo with Vehicle *</Text>
              </View>

              <View style={styles.uploadRow}>
                <Text style={styles.uploadTitle}>Exit Gate Photo *</Text>
                {handoverPhoto ? (
                  <View style={styles.attachedPill}>
                    <CheckCircle2 size={14} color="#059669" />
                    <Text style={styles.attachedPillText}>Photo Ready</Text>
                    <TouchableOpacity onPress={() => setHandoverPhoto(null)}>
                      <X size={13} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.attachBtn, { backgroundColor: '#059669', borderColor: '#059669' }]}
                    onPress={() => openUpload('handover')}
                    activeOpacity={0.8}
                  >
                    <Camera size={13} color="#FFFFFF" />
                    <Text style={[styles.attachBtnText, { color: '#FFFFFF' }]}>Take Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : isStep4PaymentFulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Attach Recipient ID first</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ========================================================= */}
      {/* STICKY BOTTOM SUBMIT BUTTON                               */}
      {/* ========================================================= */}
      {(vehicle || roScanData?.registrationNumber) && (
        <View style={[styles.stickyFooter, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!isStep6HandoverFulfilled || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmitPakkaRelease}
            activeOpacity={0.85}
            disabled={!isStep6HandoverFulfilled || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={17} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.submitBtnText}>
                  {isStep6HandoverFulfilled
                    ? isFreeRelease
                      ? 'Complete Free Release & Gate Pass (₹0)'
                      : `Complete Release & Gate Pass (₹${finalTotalAmount.toLocaleString('en-IN')})`
                    : 'Complete Steps in Sequence'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================= */}
      {/* DROPDOWN MODAL: PAYMENT MODE                              */}
      {/* ========================================================= */}
      <Modal
        visible={paymentModeDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModeDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPaymentModeDropdownVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select Payment Mode</Text>
                  <TouchableOpacity onPress={() => setPaymentModeDropdownVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  {PAYMENT_MODES.map((pm) => {
                    const isSelected = paymentMode === pm.key;
                    return (
                      <TouchableOpacity
                        key={pm.key}
                        style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive]}
                        onPress={() => handleSelectPaymentMode(pm.key)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                          {pm.label}
                        </Text>
                        {isSelected && <Check size={16} color="#0062FF" strokeWidth={2.6} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ========================================================= */}
      {/* DROPDOWN MODAL: ID TYPE                                   */}
      {/* ========================================================= */}
      <Modal
        visible={idTypeDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIdTypeDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIdTypeDropdownVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select ID Type</Text>
                  <TouchableOpacity onPress={() => setIdTypeDropdownVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  {INDIAN_ID_TYPES.map((type) => {
                    const isSelected = selectedIdType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive]}
                        onPress={() => handleSelectIdType(type)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                          {type}
                        </Text>
                        {isSelected && <Check size={16} color="#0062FF" strokeWidth={2.6} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ========================================================= */}
      {/* 3-DOTS OPTIONS MODAL                                      */}
      {/* ========================================================= */}
      <Modal visible={menuModalVisible} transparent animationType="fade" onRequestClose={() => setMenuModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuModalVisible(false)}>
          <View style={styles.menuModalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuModalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Options</Text>
                  <TouchableOpacity onPress={() => setMenuModalVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  <TouchableOpacity
                    style={styles.dropdownItemRow}
                    onPress={() => {
                      setMenuModalVisible(false);
                      fetchVehicle();
                    }}
                  >
                    <RotateCcw size={16} color="#0062FF" />
                    <Text style={styles.dropdownItemText}>Refresh Data</Text>
                  </TouchableOpacity>

                  {vehicle?.id && (
                    <TouchableOpacity
                      style={styles.dropdownItemRow}
                      onPress={() => {
                        setMenuModalVisible(false);
                        router.push(`/tenant_admin/admin/vehicles/details/${vehicle.id}` as any);
                      }}
                    >
                      <Car size={16} color="#059669" />
                      <Text style={styles.dropdownItemText}>Full Vehicle Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ========================================================= */}
      {/* UPLOAD MODAL                                              */}
      {/* ========================================================= */}
      <Modal visible={!!activeUploadTarget} transparent animationType="slide" onRequestClose={closeUpload}>
        <TouchableWithoutFeedback onPress={closeUpload}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {activeUploadTarget === 'ro_letter'
                      ? 'Upload Bank Release Order Letter'
                      : activeUploadTarget === 'idproof_front'
                      ? `Upload ${selectedIdType || 'ID'} (Front)`
                      : activeUploadTarget === 'idproof_back'
                      ? `Upload ${selectedIdType || 'ID'} (Back)`
                      : activeUploadTarget === 'screenshot'
                      ? 'Upload Payment Receipt'
                      : 'Capture Handover Photo'}
                  </Text>
                  <TouchableOpacity onPress={closeUpload}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  <TouchableOpacity style={styles.dropdownItemRow} onPress={handleCameraCapture} activeOpacity={0.75}>
                    <Camera size={18} color="#0062FF" strokeWidth={2.2} />
                    <Text style={styles.dropdownItemText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dropdownItemRow} onPress={handleGalleryPick} activeOpacity={0.75}>
                    <ImageIcon size={18} color="#059669" strokeWidth={2.2} />
                    <Text style={styles.dropdownItemText}>Choose from Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dropdownItemRow} onPress={handlePdfPick} activeOpacity={0.75}>
                    <FileText size={18} color="#E11D48" strokeWidth={2.2} />
                    <Text style={styles.dropdownItemText}>Select PDF File</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.cancelBtn} onPress={closeUpload}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ========================================================= */}
      {/* MANUAL REVIEW / OVERRIDE MODAL                            */}
      {/* ========================================================= */}
      <Modal
        visible={manualEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualEditModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setManualEditModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Manual Override & Audit</Text>
                  <TouchableOpacity onPress={() => setManualEditModalVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 12, paddingVertical: 8 }}>
                  <View>
                    <Text style={styles.fieldLabel}>Field: {editFieldName}</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editFieldValue}
                      onChangeText={setEditFieldValue}
                      placeholder={`Enter corrected ${editFieldName}`}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Reason for Override * (Logged in Audit History)</Text>
                    <TextInput
                      style={[styles.textInput, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                      value={editReason}
                      onChangeText={setEditReason}
                      placeholder="e.g. Document image blur / physically verified with bank officer"
                      placeholderTextColor="#94A3B8"
                      multiline
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitBtn, { marginTop: 4 }, savingManualEdit && styles.submitBtnDisabled]}
                    onPress={handleSaveManualEdit}
                    disabled={savingManualEdit}
                  >
                    {savingManualEdit ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Save & Log Audit Trail</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Gate Pass Clearance Modal */}
      <GatePassModal
        visible={showGatePassModal}
        onClose={handleFinishGatePass}
        gatePassData={gatePassResult}
        vehicle={vehicle || { vehicleNumber: roScanData?.registrationNumber || 'VEHICLE' }}
        recipientName={recipientName.trim()}
        recipientPhone={recipientPhone.trim()}
        recipientType={isFirstPartyCustomer ? 'Authorized Customer' : '3rd Party Representative'}
        paidAmount={finalTotalAmount}
        paymentMode={
          isFreeRelease
            ? 'Free Release (₹0)'
            : paymentMode === 'Cash + Online'
            ? `Cash (₹${numSplitCash}) + Online (₹${numSplitOnline})`
            : paymentMode || 'Cash'
        }
        releaseType="PAKKA"
      />
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
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 12,
    gap: 10,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  stepCardActiveBorder: {
    borderColor: '#93C5FD',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: '#059669',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  lockedStepCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.65,
  },
  lockedStepText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
  },
  dropdownBtnEmpty: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  dropdownBtnFilled: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  dropdownText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
  },
  dropdownTextFilled: {
    color: '#0062FF',
    fontWeight: '800',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 3,
  },
  textInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  attachedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0062FF',
  },
  // Scanning HUD
  scanningHudBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  scanningHudTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0062FF',
  },
  scanningHudStep: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  // RO Verified Box
  roVerifiedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  roVerifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  roVerifiedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    flex: 1,
  },
  confBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  pillWarning: {
    backgroundColor: '#FEF3C7',
  },
  pillWarningText: {
    color: '#B45309',
  },
  validationListBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  validationCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  validationCheckText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  mismatchBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 6,
    padding: 8,
    gap: 6,
    borderWidth: 1,
  },
  mismatchWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  mismatchCritical: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  mismatchTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  mismatchDesc: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  extractedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  extractedItem: {
    width: '48%',
  },
  extractedLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  extractedVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  miniDayPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniDayPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  miniDayPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  miniDayPillTextActive: {
    color: '#FFFFFF',
  },
  // Choice Card in Step 2
  questionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  questionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  choiceBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 5,
  },
  choiceBtnActiveYes: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  choiceBtnActiveNo: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  choiceBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  // Step 3 Dates & Ledger
  dateDisplayCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 2,
  },
  dateLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  dateVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 7,
    padding: 8,
    gap: 6,
  },
  freeBannerText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
    flex: 1,
  },
  delayedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 7,
    padding: 8,
    gap: 6,
  },
  delayedBannerText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
    flex: 1,
  },
  totalCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 4,
    marginTop: 2,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ledgerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  ledgerVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  finalTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  finalTotalLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#065F46',
  },
  finalTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  onlineBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 8,
    gap: 8,
    marginTop: 2,
  },
  splitBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 8,
    gap: 8,
    marginTop: 2,
  },
  splitSummaryCard: {
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
  },
  splitMatch: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  splitMismatch: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  splitSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  submitBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownOptionsList: {
    gap: 6,
    paddingVertical: 2,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownItemRowActive: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  cancelBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  menuModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
});
