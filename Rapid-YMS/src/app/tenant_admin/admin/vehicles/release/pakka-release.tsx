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
  Car,
  Check,
  ChevronDown,
  Lock,
  Sparkles,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Edit3,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Percent,
  CheckCircle,
  HelpCircle,
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
  { key: 'Online', label: 'Online (UPI / Bank)' },
  { key: 'Cash + Online', label: 'Split (Cash + Online)' },
  { key: 'Cheque', label: 'Cheque' },
  { key: 'DD', label: 'Demand Draft (DD)' },
  { key: 'NEFT/RTGS', label: 'NEFT / RTGS' },
];

export interface IdentifierMatch {
  field: 'registration' | 'engine' | 'chassis';
  label: string;
  yardVal: string;
  docVal: string;
  pct: number;
  isMatched: boolean;
  statusText: string;
}

/**
 * Robust Multi-Identifier Matcher
 * Supports partial matching on last 4-6 digits for Engine and Chassis.
 */
function calculateIdentifierMatch(
  yardRaw: string | undefined | null,
  docRaw: string | undefined | null,
  type: 'registration' | 'engine' | 'chassis'
): IdentifierMatch {
  const cleanYard = (yardRaw || '').toUpperCase().replace(/[\s\-_.\/]/g, '');
  const cleanDoc = (docRaw || '').toUpperCase().replace(/[\s\-_.\/]/g, '');
  const label = type === 'registration' ? 'Vehicle Plate' : type === 'engine' ? 'Engine No' : 'Chassis No';

  if (!cleanDoc) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '—',
      docVal: 'Not in Doc',
      pct: 0,
      isMatched: false,
      statusText: 'Not in Document',
    };
  }

  if (!cleanYard) {
    return {
      field: type,
      label,
      yardVal: 'Not in Yard',
      docVal: docRaw || '',
      pct: 100,
      isMatched: true,
      statusText: 'Detected from Doc',
    };
  }

  // Exact Match
  if (cleanYard === cleanDoc) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '',
      docVal: docRaw || '',
      pct: 100,
      isMatched: true,
      statusText: '100% Matched',
    };
  }

  // Engine & Chassis: Last 4 to 6 digits match
  if (type === 'engine' || type === 'chassis') {
    const minLen = Math.min(cleanYard.length, cleanDoc.length);
    const suffixLen = Math.min(minLen, 6);
    if (suffixLen >= 4) {
      const ySuffix = cleanYard.slice(-suffixLen);
      const dSuffix = cleanDoc.slice(-suffixLen);
      if (ySuffix === dSuffix || cleanDoc.endsWith(ySuffix) || cleanYard.endsWith(dSuffix)) {
        return {
          field: type,
          label,
          yardVal: yardRaw || '',
          docVal: docRaw || '',
          pct: 100,
          isMatched: true,
          statusText: `100% Matched (Last ${suffixLen} digits)`,
        };
      }
    }
  }

  // Substring inclusion
  if (cleanYard.includes(cleanDoc) || cleanDoc.includes(cleanYard)) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '',
      docVal: docRaw || '',
      pct: 90,
      isMatched: true,
      statusText: 'Partial Match (90%)',
    };
  }

  // Typo similarity / character overlap
  const maxLen = Math.max(cleanYard.length, cleanDoc.length);
  let common = 0;
  for (let i = 0; i < Math.min(cleanYard.length, cleanDoc.length); i++) {
    if (cleanYard[i] === cleanDoc[i]) common++;
  }
  const pct = Math.round((common / maxLen) * 100);

  if (pct >= 75) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '',
      docVal: docRaw || '',
      pct,
      isMatched: pct >= 80,
      statusText: `${pct}% Match (Minor Typo)`,
    };
  }

  return {
    field: type,
    label,
    yardVal: yardRaw || '',
    docVal: docRaw || '',
    pct: 0,
    isMatched: false,
    statusText: '0% Mismatch',
  };
}

export default function PakkaReleaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, plate } = useLocalSearchParams<{ id?: string; plate?: string }>();

  // Wizard Step: 1 = Document & Match, 2 = Recipient, 3 = Billing
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Vehicle State
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // STEP 1: Release Order & OCR
  const [roLetterDoc, setRoLetterDoc] = useState<ReleaseDocAttachment | null>(null);
  const [isScanningRo, setIsScanningRo] = useState(false);
  const [roScanData, setRoScanData] = useState<ParsedRoDocument | null>(null);

  // Editable/Corrected Values from OCR
  const [extractedPlate, setExtractedPlate] = useState('');
  const [extractedEngine, setExtractedEngine] = useState('');
  const [extractedChassis, setExtractedChassis] = useState('');

  // Edit/Fix Modal for OCR Typos
  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixFieldType, setFixFieldType] = useState<'registration' | 'engine' | 'chassis'>('registration');
  const [fixFieldValue, setFixFieldValue] = useState('');

  // Dates & Waive-off
  const [roDate, setRoDate] = useState<Date>(new Date());
  const [waiverDaysConfig, setWaiverDaysConfig] = useState<number>(2);
  const [approvedTillDate, setApprovedTillDate] = useState<Date>(new Date());
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());
  const [showRoDatePicker, setShowRoDatePicker] = useState(false);
  const [dailyRate, setDailyRate] = useState<number>(150);

  // STEP 2: Recipient
  const [isFirstPartyCustomer, setIsFirstPartyCustomer] = useState<boolean | null>(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [representativeRemarks, setRepresentativeRemarks] = useState('');

  const [selectedIdType, setSelectedIdType] = useState<IndianIdType | null>('Aadhaar Card');
  const [idNumberText, setIdNumberText] = useState('');
  const [idProofDocFront, setIdProofDocFront] = useState<ReleaseDocAttachment | null>(null);
  const [idProofDocBack, setIdProofDocBack] = useState<ReleaseDocAttachment | null>(null);
  const [handoverPhoto, setHandoverPhoto] = useState<ReleaseDocAttachment | null>(null);

  // Dropdown Modals
  const [paymentModeDropdownVisible, setPaymentModeDropdownVisible] = useState(false);
  const [idTypeDropdownVisible, setIdTypeDropdownVisible] = useState(false);

  // STEP 3: Payment
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>('Cash');
  const [onlinePaidToName, setOnlinePaidToName] = useState('');
  const [onlineScreenshot, setOnlineScreenshot] = useState<ReleaseDocAttachment | null>(null);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitOnlineAmount, setSplitOnlineAmount] = useState('');

  // Upload modal target
  const [activeUploadTarget, setActiveUploadTarget] = useState<
    'ro_letter' | 'idproof_front' | 'idproof_back' | 'screenshot' | 'handover' | null
  >(null);

  // Submission & Gate Pass
  const [submitting, setSubmitting] = useState(false);
  const [gatePassResult, setGatePassResult] = useState<GatePassResult | null>(null);
  const [showGatePassModal, setShowGatePassModal] = useState(false);

  const isTwoSidedId =
    selectedIdType === 'Aadhaar Card' ||
    selectedIdType === 'Driving License' ||
    selectedIdType === 'Voter ID';

  // Load Vehicle
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

        const vType = data.vehicleType;
        const bankRate = data.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vType);
        const resolvedDaily =
          (bankRate?.pakkaRate && Number(bankRate.pakkaRate) > 0)
            ? Number(bankRate.pakkaRate)
            : (data.bank?.pakkaParkingRate && Number(data.bank.pakkaParkingRate) > 0)
            ? Number(data.bank.pakkaParkingRate)
            : (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0)
            ? Number(bankRate.dailyRate)
            : 0;
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

  // Run Real OCR Scanner
  const triggerAiRoScan = async (attachment: ReleaseDocAttachment) => {
    setIsScanningRo(true);

    try {
      const parsed = await performRealRoOcr(attachment.uri, vehicle);
      setIsScanningRo(false);
      setRoScanData(parsed);

      setExtractedPlate(parsed.registrationNumber || '');
      setExtractedEngine(parsed.engineNumber || '');
      setExtractedChassis(parsed.chassisNumber || '');

      if (parsed.roDate) setRoDate(parsed.roDate);
      if (parsed.waiverDays) setWaiverDaysConfig(parsed.waiverDays);
      if (parsed.approvedTillDate) setApprovedTillDate(parsed.approvedTillDate);

      if (parsed.requiresThirdPartyAuth) {
        setIsFirstPartyCustomer(false);
      } else if (parsed.authorizedCustomer) {
        setIsFirstPartyCustomer(true);
        setRecipientName(parsed.authorizedCustomer);
      }

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err) {
      setIsScanningRo(false);
      console.warn('[Real OCR Scan Failed]:', err);
      const fallbackParsed = parseRoText('', vehicle);
      setRoScanData(fallbackParsed);
      setExtractedPlate(fallbackParsed.registrationNumber || '');
      setExtractedEngine(fallbackParsed.engineNumber || '');
      setExtractedChassis(fallbackParsed.chassisNumber || '');
    }
  };

  // Identifier Matches
  const plateMatch = calculateIdentifierMatch(vehicle?.vehicleNumber, extractedPlate, 'registration');
  const engineMatch = calculateIdentifierMatch(vehicle?.engineNumber, extractedEngine, 'engine');
  const chassisMatch = calculateIdentifierMatch(vehicle?.chassisNumber, extractedChassis, 'chassis');

  // Overall Match Validation: Pass if any primary identifier matches >= 80%
  const isMatchValid = plateMatch.isMatched || engineMatch.isMatched || chassisMatch.isMatched;

  // Fix / Edit Modal
  const openFixModal = (type: 'registration' | 'engine' | 'chassis', currentVal: string) => {
    setFixFieldType(type);
    setFixFieldValue(currentVal);
    setFixModalVisible(true);
  };

  const handleSaveFix = () => {
    const val = fixFieldValue.trim().toUpperCase();
    if (fixFieldType === 'registration') setExtractedPlate(val);
    else if (fixFieldType === 'engine') setExtractedEngine(val);
    else if (fixFieldType === 'chassis') setExtractedChassis(val);
    setFixModalVisible(false);
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

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

  // Tariff & Delay Calculation
  const diffGross = Math.max(0, releaseDate.getTime() - roDate.getTime());
  const grossDaysSinceRO = Math.ceil(diffGross / (1000 * 60 * 60 * 24));
  const appliedWaiverDays = Math.min(grossDaysSinceRO, waiverDaysConfig);
  const chargeableDelayDays = Math.max(0, grossDaysSinceRO - appliedWaiverDays);

  const customerPayableAmount = chargeableDelayDays * dailyRate;
  const finalTotalAmount = Math.round(customerPayableAmount * 100) / 100;
  const isFreeRelease = finalTotalAmount === 0;

  const numSplitCash = parseFloat(splitCashAmount) || 0;
  const numSplitOnline = parseFloat(splitOnlineAmount) || 0;
  const splitTotalSum = Math.round((numSplitCash + numSplitOnline) * 100) / 100;
  const splitDifference = Math.round((finalTotalAmount - splitTotalSum) * 100) / 100;

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

  // Step 1 Validity: Document attached AND at least one identifier matched
  const isStep1Complete = !!roLetterDoc && isMatchValid;

  // Step 2 Validity: Recipient details filled + ID proof + Handover photo
  const isStep2Complete =
    recipientName.trim().length > 0 &&
    recipientPhone.trim().length >= 10 &&
    !!selectedIdType &&
    !!idProofDocFront &&
    (!isTwoSidedId || !!idProofDocBack) &&
    !!handoverPhoto;

  // Step 3 Validity: Payment fulfilled
  const isStep3PaymentFulfilled =
    isFreeRelease ||
    (paymentMode !== null &&
      (paymentMode === 'Cash' ||
        paymentMode === 'Cheque' ||
        paymentMode === 'DD' ||
        paymentMode === 'NEFT/RTGS' ||
        (paymentMode === 'Online' && !!onlineScreenshot) ||
        (paymentMode === 'Cash + Online' && splitDifference === 0 && !!onlineScreenshot)));

  const openUpload = (
    target: 'ro_letter' | 'idproof_front' | 'idproof_back' | 'screenshot' | 'handover'
  ) => {
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

  // Submit Pakka Release
  const handleSubmitPakkaRelease = async () => {
    if (!isStep3PaymentFulfilled) {
      Alert.alert('Incomplete', 'Please verify payment details.');
      return;
    }

    if (paymentMode === 'Cash + Online' && splitDifference !== 0) {
      Alert.alert(
        'Split Mismatch',
        `Cash (₹${numSplitCash}) + Online (₹${numSplitOnline}) = ₹${splitTotalSum}.\nTarget is ₹${finalTotalAmount}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const recipientTypeStr: ReleasePersonType = isFirstPartyCustomer ? 'CUSTOMER' : 'BUYER';

      const payload = {
        releaseType: 'PAKKA',
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientType: recipientTypeStr,
        idType: selectedIdType || 'Aadhaar Card',
        idNumber: idNumberText.trim() || undefined,
        roDate: roDate.toISOString(),
        waiverDays: waiverDaysConfig,
        approvedTillDate: approvedTillDate.toISOString(),
        paymentMode: isFreeRelease ? 'Free' : paymentMode || 'Cash',
        amount: finalTotalAmount,
        splitCashAmount: paymentMode === 'Cash + Online' ? numSplitCash : undefined,
        splitOnlineAmount: paymentMode === 'Cash + Online' ? numSplitOnline : undefined,
        onlinePaidToName: onlinePaidToName.trim() || undefined,
        representativeRemarks: representativeRemarks.trim() || undefined,
        documents: {
          roLetter: roLetterDoc?.uri,
          idProofFront: idProofDocFront?.uri,
          idProofBack: idProofDocBack?.uri,
          paymentScreenshot: onlineScreenshot?.uri,
          handoverPhoto: handoverPhoto?.uri,
        },
      };

      const vehicleId = vehicle?.id || id || 'direct';
      const res = await directReleaseVehicle(vehicleId, payload);

      if (res?.success && res?.data) {
        setGatePassResult(res.data);
        setShowGatePassModal(true);
      } else {
        throw new Error(res?.error || 'Could not complete vehicle release.');
      }
    } catch (err: any) {
      Alert.alert('Release Failed', err.message || 'Error completing release');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishGatePass = () => {
    setShowGatePassModal(false);
    if (router.canGoBack()) router.back();
    else router.replace('/tenant_admin/admin/vehicles' as any);
  };

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);
  const vehicleNumber = (
    vehicle?.vehicleNumber ||
    extractedPlate ||
    'PAKKA RELEASE'
  ).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <ReleaseHeader
        vehicleNumber={vehicleNumber}
        subtitle="Pakka Vehicle Release"
        onBackPress={() => {
          if (currentStep > 1) {
            setCurrentStep((prev) => (prev - 1) as any);
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/tenant_admin/admin/vehicles' as any);
          }
        }}
        onMenuPress={() => setMenuModalVisible(true)}
      />

      {/* Wizard Step Indicator Bar */}
      <View style={styles.wizardBar}>
        <TouchableOpacity
          style={[styles.wizardStep, currentStep === 1 && styles.wizardStepActive]}
          onPress={() => setCurrentStep(1)}
          activeOpacity={0.8}
        >
          <View style={[styles.stepDot, currentStep === 1 && styles.stepDotActive, isStep1Complete && styles.stepDotDone]}>
            {isStep1Complete ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : <Text style={styles.stepDotNum}>1</Text>}
          </View>
          <Text style={[styles.wizardStepText, currentStep === 1 && styles.wizardStepTextActive]}>
            1. Document & Match
          </Text>
        </TouchableOpacity>

        <View style={styles.wizardConnector} />

        <TouchableOpacity
          style={[styles.wizardStep, currentStep === 2 && styles.wizardStepActive]}
          onPress={() => {
            if (isStep1Complete) setCurrentStep(2);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.stepDot, currentStep === 2 && styles.stepDotActive, isStep2Complete && styles.stepDotDone]}>
            {isStep2Complete ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : <Text style={styles.stepDotNum}>2</Text>}
          </View>
          <Text style={[styles.wizardStepText, currentStep === 2 && styles.wizardStepTextActive]}>
            2. Recipient
          </Text>
        </TouchableOpacity>

        <View style={styles.wizardConnector} />

        <TouchableOpacity
          style={[styles.wizardStep, currentStep === 3 && styles.wizardStepActive]}
          onPress={() => {
            if (isStep1Complete && isStep2Complete) setCurrentStep(3);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.stepDot, currentStep === 3 && styles.stepDotActive]}>
            <Text style={styles.stepDotNum}>3</Text>
          </View>
          <Text style={[styles.wizardStepText, currentStep === 3 && styles.wizardStepTextActive]}>
            3. Billing
          </Text>
        </TouchableOpacity>
      </View>

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
          {/* STEP 1: RELEASE ORDER UPLOAD & MULTI-FIELD SMART MATCH   */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>1. Upload Bank Release Order</Text>
                <Text style={styles.cardSubtitle}>
                  Upload the official Release Letter / Delivery Note. OCR will extract text in background.
                </Text>

                <View style={styles.uploadRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} color="#0062FF" />
                    <Text style={styles.uploadTitle}>
                      {roLetterDoc ? 'Release Letter Attached' : 'Attach Letter / PDF'}
                    </Text>
                  </View>

                  {roLetterDoc ? (
                    <View style={styles.attachedPill}>
                      <CheckCircle2 size={14} color="#059669" />
                      <Text style={styles.attachedPillText}>Attached</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setRoLetterDoc(null);
                          setRoScanData(null);
                          setExtractedPlate('');
                          setExtractedEngine('');
                          setExtractedChassis('');
                        }}
                        style={{ paddingLeft: 4 }}
                      >
                        <X size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadActionBtn}
                      onPress={() => openUpload('ro_letter')}
                      activeOpacity={0.8}
                    >
                      <Upload size={13} color="#FFFFFF" />
                      <Text style={styles.uploadActionBtnText}>Upload Letter</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isScanningRo && (
                  <View style={styles.scanningHudBox}>
                    <ActivityIndicator size="small" color="#0062FF" />
                    <Text style={styles.scanningHudTitle}>Reading document & extracting identifiers...</Text>
                  </View>
                )}
              </View>

              {/* Multi-Identifier Smart Match Card */}
              {roScanData && (
                <View style={styles.card}>
                  <View style={styles.matchHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isMatchValid ? (
                        <ShieldCheck size={18} color="#059669" />
                      ) : (
                        <ShieldAlert size={18} color="#E11D48" />
                      )}
                      <Text style={styles.cardTitle}>Vehicle Verification Matching</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isMatchValid ? styles.statusBadgeSuccess : styles.statusBadgeDanger,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isMatchValid ? { color: '#059669' } : { color: '#E11D48' },
                        ]}
                      >
                        {isMatchValid ? 'Verified' : 'Mismatch'}
                      </Text>
                    </View>
                  </View>

                  {/* Wrong Details Banner if All Mismatch */}
                  {!isMatchValid && (
                    <View style={styles.wrongDetailsBanner}>
                      <AlertCircle size={16} color="#E11D48" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.wrongDetailsTitle}>Wrong Vehicle Details</Text>
                        <Text style={styles.wrongDetailsDesc}>
                          This release letter does not match this yard vehicle. Please check plate, engine, or chassis number.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 3 Identifiers Comparison List */}
                  <View style={styles.identifiersList}>
                    {/* 1. Registration Plate */}
                    <View style={[styles.identifierRow, plateMatch.isMatched ? styles.rowMatched : styles.rowMismatch]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.idLabel}>Vehicle Plate</Text>
                        <Text style={styles.idYardText}>Yard: {vehicle?.vehicleNumber || '—'}</Text>
                        <Text style={styles.idDocText}>Doc: {extractedPlate || 'Not Detected'}</Text>
                      </View>
                      <View style={styles.idRightCol}>
                        <View style={[styles.pctBadge, plateMatch.isMatched ? styles.pctBadgeGreen : styles.pctBadgeRed]}>
                          <Text style={[styles.pctText, plateMatch.isMatched ? { color: '#059669' } : { color: '#E11D48' }]}>
                            {plateMatch.statusText}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fixBtn}
                          onPress={() => openFixModal('registration', extractedPlate)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={11} color="#0062FF" />
                          <Text style={styles.fixBtnText}>Fix</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 2. Engine Number */}
                    <View style={[styles.identifierRow, engineMatch.isMatched ? styles.rowMatched : styles.rowMismatch]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.idLabel}>Engine Number</Text>
                        <Text style={styles.idYardText}>Yard: {vehicle?.engineNumber || '—'}</Text>
                        <Text style={styles.idDocText}>Doc: {extractedEngine || 'Not Detected'}</Text>
                      </View>
                      <View style={styles.idRightCol}>
                        <View style={[styles.pctBadge, engineMatch.isMatched ? styles.pctBadgeGreen : styles.pctBadgeRed]}>
                          <Text style={[styles.pctText, engineMatch.isMatched ? { color: '#059669' } : { color: '#E11D48' }]}>
                            {engineMatch.statusText}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fixBtn}
                          onPress={() => openFixModal('engine', extractedEngine)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={11} color="#0062FF" />
                          <Text style={styles.fixBtnText}>Fix</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 3. Chassis Number */}
                    <View style={[styles.identifierRow, chassisMatch.isMatched ? styles.rowMatched : styles.rowMismatch]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.idLabel}>Chassis Number</Text>
                        <Text style={styles.idYardText}>Yard: {vehicle?.chassisNumber || '—'}</Text>
                        <Text style={styles.idDocText}>Doc: {extractedChassis || 'Not Detected'}</Text>
                      </View>
                      <View style={styles.idRightCol}>
                        <View style={[styles.pctBadge, chassisMatch.isMatched ? styles.pctBadgeGreen : styles.pctBadgeRed]}>
                          <Text style={[styles.pctText, chassisMatch.isMatched ? { color: '#059669' } : { color: '#E11D48' }]}>
                            {chassisMatch.statusText}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fixBtn}
                          onPress={() => openFixModal('chassis', extractedChassis)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={11} color="#0062FF" />
                          <Text style={styles.fixBtnText}>Fix</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Summary Grid for Bank, RO Date, Waive Days */}
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Financier / Bank</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>
                        {roScanData.bankName || 'Bank'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.summaryItem}
                      onPress={() => setShowRoDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.summaryLabel}>RO Issue Date</Text>
                        <Edit3 size={10} color="#0062FF" />
                      </View>
                      <Text style={[styles.summaryValue, { color: '#0062FF' }]}>
                        {roDate ? roDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Customer in Letter</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>
                        {roScanData.authorizedCustomer || 'Customer'}
                      </Text>
                    </View>

                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Free Grace Days</Text>
                      <View style={styles.waiverPillsRow}>
                        {[1, 2, 3, 5].map((d) => (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.waiverPill,
                              waiverDaysConfig === d && styles.waiverPillActive,
                            ]}
                            onPress={() => handleSetWaiverDays(d)}
                          >
                            <Text
                              style={[
                                styles.waiverPillText,
                                waiverDaysConfig === d && styles.waiverPillTextActive,
                              ]}
                            >
                              {d}d
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
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
          )}

          {/* ========================================================= */}
          {/* STEP 2: RECIPIENT INFORMATION & ID PROOFS                 */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>2. Recipient Information</Text>
                <Text style={styles.cardSubtitle}>Select who is collecting the vehicle and verify identity.</Text>

                {/* Recipient Type Segmented Toggle */}
                <View style={styles.segmentedRow}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      isFirstPartyCustomer === true && styles.segmentBtnActive,
                    ]}
                    onPress={() => setIsFirstPartyCustomer(true)}
                    activeOpacity={0.8}
                  >
                    <UserCheck size={14} color={isFirstPartyCustomer === true ? '#0062FF' : '#64748B'} />
                    <Text
                      style={[
                        styles.segmentBtnText,
                        isFirstPartyCustomer === true && styles.segmentBtnTextActive,
                      ]}
                    >
                      Owner / Customer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      isFirstPartyCustomer === false && styles.segmentBtnActive,
                    ]}
                    onPress={() => setIsFirstPartyCustomer(false)}
                    activeOpacity={0.8}
                  >
                    <UserX size={14} color={isFirstPartyCustomer === false ? '#0062FF' : '#64748B'} />
                    <Text
                      style={[
                        styles.segmentBtnText,
                        isFirstPartyCustomer === false && styles.segmentBtnTextActive,
                      ]}
                    >
                      3rd Party Representative
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Name & Phone */}
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Recipient Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Name"
                      placeholderTextColor="#94A3B8"
                      value={recipientName}
                      onChangeText={setRecipientName}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Mobile Number *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="10-Digit Mobile"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={recipientPhone}
                      onChangeText={setRecipientPhone}
                    />
                  </View>
                </View>

                {isFirstPartyCustomer === false && (
                  <View>
                    <Text style={styles.fieldLabel}>Authority / Remarks (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Authorization Letter Ref / Reason"
                      placeholderTextColor="#94A3B8"
                      value={representativeRemarks}
                      onChangeText={setRepresentativeRemarks}
                    />
                  </View>
                )}
              </View>

              {/* ID Proof Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recipient ID Proof</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownBtn,
                    selectedIdType ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
                  ]}
                  onPress={() => setIdTypeDropdownVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownText, selectedIdType && styles.dropdownTextFilled]}>
                    {selectedIdType || 'Select ID Card Type...'}
                  </Text>
                  <ChevronDown size={16} color="#64748B" />
                </TouchableOpacity>

                {selectedIdType && (
                  <>
                    <TextInput
                      style={styles.textInput}
                      placeholder={`${selectedIdType} Number (Optional)`}
                      placeholderTextColor="#94A3B8"
                      value={idNumberText}
                      onChangeText={setIdNumberText}
                    />

                    {/* ID Front */}
                    <View style={styles.uploadRow}>
                      <Text style={styles.uploadTitle}>
                        {selectedIdType} {isTwoSidedId ? '(Front)' : ''} *
                      </Text>
                      {idProofDocFront ? (
                        <View style={styles.attachedPill}>
                          <CheckCircle2 size={14} color="#059669" />
                          <Text style={styles.attachedPillText}>Attached</Text>
                          <TouchableOpacity onPress={() => setIdProofDocFront(null)}>
                            <X size={14} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadActionBtn}
                          onPress={() => openUpload('idproof_front')}
                          activeOpacity={0.8}
                        >
                          <Upload size={13} color="#FFFFFF" />
                          <Text style={styles.uploadActionBtnText}>Front Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* ID Back */}
                    {isTwoSidedId && (
                      <View style={styles.uploadRow}>
                        <Text style={styles.uploadTitle}>{selectedIdType} (Back) *</Text>
                        {idProofDocBack ? (
                          <View style={styles.attachedPill}>
                            <CheckCircle2 size={14} color="#059669" />
                            <Text style={styles.attachedPillText}>Attached</Text>
                            <TouchableOpacity onPress={() => setIdProofDocBack(null)}>
                              <X size={14} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.uploadActionBtn, { backgroundColor: '#7C3AED' }]}
                            onPress={() => openUpload('idproof_back')}
                            activeOpacity={0.8}
                          >
                            <Upload size={13} color="#FFFFFF" />
                            <Text style={styles.uploadActionBtnText}>Back Photo</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Handover Photo Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Exit Gate Photo with Vehicle *</Text>
                <View style={styles.uploadRow}>
                  <Text style={styles.uploadTitle}>Photo with Driver & Vehicle</Text>
                  {handoverPhoto ? (
                    <View style={styles.attachedPill}>
                      <CheckCircle2 size={14} color="#059669" />
                      <Text style={styles.attachedPillText}>Photo Ready</Text>
                      <TouchableOpacity onPress={() => setHandoverPhoto(null)}>
                        <X size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadActionBtn, { backgroundColor: '#059669' }]}
                      onPress={() => openUpload('handover')}
                      activeOpacity={0.8}
                    >
                      <Camera size={13} color="#FFFFFF" />
                      <Text style={styles.uploadActionBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* STEP 3: BILLING & CHARGES (SAME LIKE KACHHA RELEASE)      */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>3. Stay & Waive-off Calculation</Text>
                <Text style={styles.cardSubtitle}>
                  Tariff breakdown based on RO Date, Grace Period and Daily Rate.
                </Text>

                <View style={styles.billCard}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Yard Stay Upto RO Date</Text>
                    <Text style={[styles.billValue, { color: '#059669' }]}>Paid by Bank</Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Free Grace Period ({waiverDaysConfig} Days)</Text>
                    <Text style={[styles.billValue, { color: '#059669' }]}>Waived (₹0)</Text>
                  </View>

                  {!isFreeRelease && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delay ({chargeableDelayDays} Days @ ₹{dailyRate}/day)</Text>
                      <Text style={styles.billValue}>₹{customerPayableAmount}</Text>
                    </View>
                  )}

                  <View style={styles.billDivider} />

                  <View style={styles.billTotalRow}>
                    <View>
                      <Text style={styles.billTotalTitle}>Total Customer Payable</Text>
                      <Text style={styles.billTotalSubtitle}>
                        {isFreeRelease ? 'Released within free grace period' : `${chargeableDelayDays} delay days`}
                      </Text>
                    </View>
                    <Text style={[styles.billTotalAmount, isFreeRelease && { color: '#059669' }]}>
                      ₹{finalTotalAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Payment Section if Amount > 0 */}
              {!isFreeRelease && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Payment Method *</Text>
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
                        : 'Select Payment Method...'}
                    </Text>
                    <ChevronDown size={16} color="#64748B" />
                  </TouchableOpacity>

                  {(paymentMode === 'Online' || paymentMode === 'Cash + Online') && (
                    <View style={styles.onlineSection}>
                      {paymentMode === 'Cash + Online' && (
                        <View style={styles.formRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Cash Amount (₹)</Text>
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
                            <Text style={styles.fieldLabel}>Online Amount (₹)</Text>
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
                      )}

                      <TextInput
                        style={styles.textInput}
                        placeholder="Paid To / Account Name *"
                        placeholderTextColor="#94A3B8"
                        value={onlinePaidToName}
                        onChangeText={setOnlinePaidToName}
                      />

                      <View style={styles.uploadRow}>
                        <Text style={styles.uploadTitle}>Payment Screenshot / Receipt *</Text>
                        {onlineScreenshot ? (
                          <View style={styles.attachedPill}>
                            <CheckCircle2 size={14} color="#059669" />
                            <Text style={styles.attachedPillText}>Attached</Text>
                            <TouchableOpacity onPress={() => setOnlineScreenshot(null)}>
                              <X size={14} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.uploadActionBtn}
                            onPress={() => openUpload('screenshot')}
                            activeOpacity={0.8}
                          >
                            <Upload size={13} color="#FFFFFF" />
                            <Text style={styles.uploadActionBtnText}>Upload</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Sticky Bottom Bar / Step Navigation */}
      {(vehicle || extractedPlate) && (
        <View style={[styles.stickyFooter, { paddingBottom: bottomPadding }]}>
          {currentStep === 1 && (
            <TouchableOpacity
              style={[
                styles.submitBtn,
                !isStep1Complete && styles.submitBtnDisabled,
              ]}
              onPress={() => {
                if (isStep1Complete) setCurrentStep(2);
              }}
              activeOpacity={0.85}
              disabled={!isStep1Complete}
            >
              <Text style={styles.submitBtnText}>
                {isStep1Complete ? 'Next: Recipient Details' : 'Attach & Verify Document'}
              </Text>
              <ArrowRight size={17} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {currentStep === 2 && (
            <View style={styles.stepNavRow}>
              <TouchableOpacity
                style={styles.backStepBtn}
                onPress={() => setCurrentStep(1)}
                activeOpacity={0.8}
              >
                <ArrowLeft size={16} color="#334155" />
                <Text style={styles.backStepBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { flex: 1 },
                  !isStep2Complete && styles.submitBtnDisabled,
                ]}
                onPress={() => {
                  if (isStep2Complete) setCurrentStep(3);
                }}
                activeOpacity={0.85}
                disabled={!isStep2Complete}
              >
                <Text style={styles.submitBtnText}>Next: Billing</Text>
                <ArrowRight size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {currentStep === 3 && (
            <View style={styles.stepNavRow}>
              <TouchableOpacity
                style={styles.backStepBtn}
                onPress={() => setCurrentStep(2)}
                activeOpacity={0.8}
              >
                <ArrowLeft size={16} color="#334155" />
                <Text style={styles.backStepBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { flex: 1 },
                  (!isStep3PaymentFulfilled || submitting) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmitPakkaRelease}
                activeOpacity={0.85}
                disabled={!isStep3PaymentFulfilled || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={17} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.submitBtnText}>
                      {isFreeRelease
                        ? 'Issue Gate Pass (₹0)'
                        : `Release & Pass (₹${finalTotalAmount.toLocaleString('en-IN')})`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Fix / Correction Modal */}
      <Modal
        visible={fixModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFixModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFixModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    Fix / Correct {fixFieldType === 'registration' ? 'Vehicle Plate' : fixFieldType === 'engine' ? 'Engine No' : 'Chassis No'}
                  </Text>
                  <TouchableOpacity onPress={() => setFixModalVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ paddingVertical: 12, gap: 12 }}>
                  <Text style={styles.modalSubtext}>
                    Correct any OCR character misread (e.g. 0 vs O, U vs V) as per the physical letter.
                  </Text>
                  <TextInput
                    style={[styles.textInput, { fontSize: 16, fontWeight: '700' }]}
                    value={fixFieldValue}
                    onChangeText={setFixFieldValue}
                    autoCapitalize="characters"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveFix}>
                    <Text style={styles.modalSaveBtnText}>Save Correction</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Payment Mode Modal */}
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
                  <Text style={styles.sheetTitle}>Select Payment Method</Text>
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
                        onPress={() => {
                          setPaymentMode(pm.key);
                          setPaymentModeDropdownVisible(false);
                        }}
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

      {/* ID Type Modal */}
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
                  <Text style={styles.sheetTitle}>Select ID Card Type</Text>
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
                        onPress={() => {
                          setSelectedIdType(type);
                          setIdTypeDropdownVisible(false);
                        }}
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

      {/* Upload Choice Modal */}
      <Modal
        visible={activeUploadTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={closeUpload}
      >
        <TouchableWithoutFeedback onPress={closeUpload}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Upload Document / Photo</Text>
                  <TouchableOpacity onPress={closeUpload}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.uploadOptionsRow}>
                  <TouchableOpacity
                    style={styles.uploadOptionTile}
                    onPress={handleCameraCapture}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.uploadOptionCircle, { backgroundColor: '#EFF6FF' }]}>
                      <Camera size={22} color="#0062FF" />
                    </View>
                    <Text style={styles.uploadOptionText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.uploadOptionTile}
                    onPress={handleGalleryPick}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.uploadOptionCircle, { backgroundColor: '#FAF5FF' }]}>
                      <ImageIcon size={22} color="#7C3AED" />
                    </View>
                    <Text style={styles.uploadOptionText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.uploadOptionTile}
                    onPress={handlePdfPick}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.uploadOptionCircle, { backgroundColor: '#F0FDF4' }]}>
                      <FileText size={22} color="#16A34A" />
                    </View>
                    <Text style={styles.uploadOptionText}>PDF File</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Gate Pass Modal */}
      <GatePassModal
        visible={showGatePassModal}
        onClose={handleFinishGatePass}
        gatePassData={gatePassResult}
        vehicle={vehicle || { vehicleNumber: extractedPlate || 'VEHICLE' }}
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
  wizardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  wizardStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  wizardStepActive: {
    opacity: 1,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#0062FF',
  },
  stepDotDone: {
    backgroundColor: '#059669',
  },
  stepDotNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  wizardStepText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  wizardStepTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  wizardConnector: {
    width: 14,
    height: 1,
    backgroundColor: '#CBD5E1',
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
  },
  stepContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0062FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  uploadActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  attachedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  scanningHudBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scanningHudTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0062FF',
  },
  matchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  wrongDetailsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
  },
  wrongDetailsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#E11D48',
  },
  wrongDetailsDesc: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
    lineHeight: 15,
  },
  identifiersList: {
    gap: 8,
  },
  identifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  rowMatched: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  rowMismatch: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  idYardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  idDocText: {
    fontSize: 11,
    color: '#64748B',
  },
  idRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pctBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  pctBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  pctBadgeRed: {
    backgroundColor: '#FEE2E2',
  },
  pctText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  fixBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  waiverPillsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  waiverPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  waiverPillActive: {
    backgroundColor: '#0062FF',
  },
  waiverPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  waiverPillTextActive: {
    color: '#FFFFFF',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  textInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  billValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  billTotalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  billTotalSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
  },
  billTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
  },
  dropdownTextFilled: {
    color: '#0062FF',
    fontWeight: '700',
  },
  onlineSection: {
    gap: 8,
    marginTop: 4,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  stepNavRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  backStepBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0062FF',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 14.5,
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
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtext: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#0062FF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dropdownOptionsList: {
    paddingVertical: 8,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemRowActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
  uploadOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
  uploadOptionTile: {
    alignItems: 'center',
    gap: 8,
  },
  uploadOptionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
});
