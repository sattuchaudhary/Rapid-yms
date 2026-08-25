import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Upload,
  X,
  Check,
  ChevronDown,
  Sparkles,
  Edit3,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ScanLine,
  FileCheck,
  RefreshCw,
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
import { ParsedRoDocument } from '@/utils/roOcrParser';
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
  { key: 'Cash + Online', label: 'Split (Cash + Online)' },
  { key: 'Cheque', label: 'Cheque' },
  { key: 'DD', label: 'Demand Draft (DD)' },
  { key: 'NEFT/RTGS', label: 'NEFT / RTGS' },
];

type PaymentChargeOption =
  | 'REPO_PLUS_PARKING'
  | 'ONLY_PARKING'
  | 'ONLY_REPO'
  | 'NOTHING';

const CHARGE_OPTIONS: { key: PaymentChargeOption; label: string }[] = [
  { key: 'REPO_PLUS_PARKING', label: 'Repo Charge + Parking' },
  { key: 'ONLY_PARKING', label: 'Only Parking' },
  { key: 'ONLY_REPO', label: 'Only Repo Charge' },
  { key: 'NOTHING', label: 'Free Release (₹0)' },
];

export interface IdentifierMatch {
  field: 'registration' | 'engine' | 'chassis';
  label: string;
  yardVal: string;
  docVal: string;
  isMatched: boolean;
  statusText: string;
}

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
      docVal: 'Not found',
      isMatched: false,
      statusText: 'Missing in Doc',
    };
  }

  if (!cleanYard) {
    return {
      field: type,
      label,
      yardVal: '—',
      docVal: docRaw || '',
      isMatched: true,
      statusText: 'Doc Only',
    };
  }

  if (cleanYard === cleanDoc) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '',
      docVal: docRaw || '',
      isMatched: true,
      statusText: 'Matched',
    };
  }

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
          isMatched: true,
          statusText: `Matched (Last ${suffixLen})`,
        };
      }
    }
  }

  if (cleanYard.includes(cleanDoc) || cleanDoc.includes(cleanYard)) {
    return {
      field: type,
      label,
      yardVal: yardRaw || '',
      docVal: docRaw || '',
      isMatched: true,
      statusText: 'Matched',
    };
  }

  return {
    field: type,
    label,
    yardVal: yardRaw || '',
    docVal: docRaw || '',
    isMatched: false,
    statusText: 'Mismatch',
  };
}

export default function PakkaReleaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, plate } = useLocalSearchParams<{ id?: string; plate?: string }>();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Vehicle State
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // STEP 1: Release Order & AI OCR
  const [roLetterDoc, setRoLetterDoc] = useState<ReleaseDocAttachment | null>(null);
  const [isScanningRo, setIsScanningRo] = useState(false);
  const [extractedPlate, setExtractedPlate] = useState('');
  const [extractedEngine, setExtractedEngine] = useState('');
  const [extractedChassis, setExtractedChassis] = useState('');

  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixFieldType, setFixFieldType] = useState<'registration' | 'engine' | 'chassis'>('registration');
  const [fixFieldValue, setFixFieldValue] = useState('');

  const [roDate, setRoDate] = useState<Date>(new Date());
  const [waiverDaysConfig, setWaiverDaysConfig] = useState<number>(2);
  const [approvedTillDate, setApprovedTillDate] = useState<Date>(new Date());
  const [dailyRate, setDailyRate] = useState<number>(0);

  // STEP 2: Recipient Details
  const [recipientType, setRecipientType] = useState<ReleasePersonType>('CUSTOMER');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const [selectedIdType, setSelectedIdType] = useState<IndianIdType | null>('Aadhaar Card');
  const [idNumberText, setIdNumberText] = useState('');
  const [idProofDocFront, setIdProofDocFront] = useState<ReleaseDocAttachment | null>(null);
  const [idProofDocBack, setIdProofDocBack] = useState<ReleaseDocAttachment | null>(null);

  // STEP 3: Payment & Charges
  const [chargeOption, setChargeOption] = useState<PaymentChargeOption>('REPO_PLUS_PARKING');
  const [repoCharge, setRepoCharge] = useState<string>('2500');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>('Cash');
  const [onlinePaidToName, setOnlinePaidToName] = useState('');
  const [onlineScreenshot, setOnlineScreenshot] = useState<ReleaseDocAttachment | null>(null);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitOnlineAmount, setSplitOnlineAmount] = useState('');

  // STEP 4: Exit Photo
  const [handoverPhoto, setHandoverPhoto] = useState<ReleaseDocAttachment | null>(null);

  // Dropdown Modals
  const [paymentModeDropdownVisible, setPaymentModeDropdownVisible] = useState(false);
  const [idTypeDropdownVisible, setIdTypeDropdownVisible] = useState(false);
  const [chargeDropdownVisible, setChargeDropdownVisible] = useState(false);
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

  // Load Vehicle Details
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

        if (data.bank?.parkingWaiverDays !== undefined) {
          setWaiverDaysConfig(data.bank.parkingWaiverDays);
        }
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

  // Trigger OCR Scan
  const triggerAiRoScan = async (attachment: ReleaseDocAttachment) => {
    setIsScanningRo(true);
    try {
      const parsed = await performRealRoOcr(attachment.uri, vehicle);
      setIsScanningRo(false);

      setExtractedPlate(parsed.registrationNumber || '');
      setExtractedEngine(parsed.engineNumber || '');
      setExtractedChassis(parsed.chassisNumber || '');

      if (parsed.roDate) setRoDate(parsed.roDate);
      if (parsed.waiverDays) setWaiverDaysConfig(parsed.waiverDays);
      if (parsed.approvedTillDate) setApprovedTillDate(parsed.approvedTillDate);

      if (parsed.requiresThirdPartyAuth) {
        setRecipientType('BUYER');
      } else if (parsed.authorizedCustomer) {
        setRecipientType('CUSTOMER');
        setRecipientName(parsed.authorizedCustomer);
      }
    } catch (err) {
      setIsScanningRo(false);
    }
  };

  // Matches
  const plateMatch = calculateIdentifierMatch(vehicle?.vehicleNumber, extractedPlate, 'registration');
  const engineMatch = calculateIdentifierMatch(vehicle?.engineNumber, extractedEngine, 'engine');
  const chassisMatch = calculateIdentifierMatch(vehicle?.chassisNumber, extractedChassis, 'chassis');

  // Calculations
  const entryDate = vehicle?.entryDate ? new Date(vehicle.entryDate) : (vehicle?.createdAt ? new Date(vehicle.createdAt) : new Date());
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - entryDate.getTime());
  const stayDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const chargeableDays = Math.max(0, stayDays - waiverDaysConfig);
  const isFreeRelease = chargeOption === 'NOTHING';

  let baseParkingAmount = 0;
  let baseRepoAmount = 0;

  if (chargeOption === 'REPO_PLUS_PARKING') {
    baseParkingAmount = chargeableDays * dailyRate;
    baseRepoAmount = parseFloat(repoCharge) || 0;
  } else if (chargeOption === 'ONLY_PARKING') {
    baseParkingAmount = chargeableDays * dailyRate;
  } else if (chargeOption === 'ONLY_REPO') {
    baseRepoAmount = parseFloat(repoCharge) || 0;
  }

  const finalTotalAmount = isFreeRelease ? 0 : baseParkingAmount + baseRepoAmount;

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

  const handleSelectPaymentMode = (pm: PaymentMode) => {
    setPaymentMode(pm);
    setPaymentModeDropdownVisible(false);
    if (pm === 'Cash + Online' && finalTotalAmount > 0 && !splitCashAmount && !splitOnlineAmount) {
      setSplitCashAmount('');
      setSplitOnlineAmount(finalTotalAmount.toString());
    }
  };

  // Validations
  const isStep1Fulfilled = roLetterDoc !== null;
  const isStep2Fulfilled =
    recipientName.trim().length >= 2 &&
    recipientPhone.trim().length === 10 &&
    idProofDocFront !== null &&
    (!isTwoSidedId || idProofDocBack !== null);

  const isStep3Fulfilled =
    isFreeRelease ||
    (paymentMode !== null &&
      (paymentMode === 'Cash' || paymentMode === 'Cheque' || paymentMode === 'DD' || paymentMode === 'NEFT/RTGS'
        ? true
        : paymentMode === 'Online'
        ? onlinePaidToName.trim().length >= 2 && onlineScreenshot !== null
        : paymentMode === 'Cash + Online'
        ? numSplitCash > 0 && numSplitOnline > 0 && onlinePaidToName.trim().length >= 2 && onlineScreenshot !== null
        : true));

  const isStep4Fulfilled = handoverPhoto !== null;

  // Upload Handlers
  const handlePickImage = async (fromCamera: boolean) => {
    const target = activeUploadTarget;
    setActiveUploadTarget(null);
    if (!target) return;

    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });

      if (!result.canceled && result.assets && result.assets[0]) {
        const localUri = result.assets[0].uri;
        const attachObj: ReleaseDocAttachment = { uri: localUri, type: 'image', isUploading: true };

        if (target === 'ro_letter') setRoLetterDoc(attachObj);
        else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'image/jpeg');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, type: 'image', isUploading: false };

        if (target === 'ro_letter') {
          setRoLetterDoc(doneObj);
          triggerAiRoScan(doneObj);
        } else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err) {}
  };

  const handlePickDocument = async () => {
    const target = activeUploadTarget;
    setActiveUploadTarget(null);
    if (!target) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const doc = result.assets[0];
        const localUri = doc.uri;
        const name = doc.name || 'document.pdf';
        const attachObj: ReleaseDocAttachment = { uri: localUri, name, type: 'pdf', isUploading: true };

        if (target === 'ro_letter') setRoLetterDoc(attachObj);
        else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'application/pdf');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, name, type: 'pdf', isUploading: false };

        if (target === 'ro_letter') {
          setRoLetterDoc(doneObj);
          triggerAiRoScan(doneObj);
        } else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err) {}
  };

  // Submit
  const handleSubmitPakkaRelease = async () => {
    if (!isStep4Fulfilled) {
      Alert.alert('Required', 'Please attach gate handover photo.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        releaseType: 'PAKKA',
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientType,
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
        throw new Error(res?.error || 'Could not complete release.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to release');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishGatePass = () => {
    setShowGatePassModal(false);
    if (router.canGoBack()) router.back();
    else router.replace('/tenant_admin/admin/vehicles' as any);
  };

  const vehicleNumber = (vehicle?.vehicleNumber || extractedPlate || 'PAKKA RELEASE').toUpperCase();

  const handleNextStep = () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as any);
    } else {
      handleSubmitPakkaRelease();
    }
  };

  const isCurrentStepValid =
    currentStep === 1
      ? isStep1Fulfilled
      : currentStep === 2
      ? isStep2Fulfilled
      : currentStep === 3
      ? isStep3Fulfilled
      : isStep4Fulfilled;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <ReleaseHeader
        vehicleNumber={vehicleNumber}
        subtitle="Pakka Release Desk"
        onBackPress={() => {
          if (currentStep > 1) setCurrentStep((prev) => (prev - 1) as any);
          else if (router.canGoBack()) router.back();
          else router.replace('/tenant_admin/admin/vehicles/release' as any);
        }}
      />

      {/* 4-Step Progress Tabs */}
      <View style={styles.stepTabsRow}>
        {[
          { step: 1, label: '1. OCR' },
          { step: 2, label: '2. Details' },
          { step: 3, label: '3. Payment' },
          { step: 4, label: '4. Photo' },
        ].map((item) => {
          const isActive = currentStep === item.step;
          const isDone = currentStep > item.step;

          return (
            <TouchableOpacity
              key={item.step}
              style={[
                styles.stepTab,
                isActive && styles.stepTabActive,
                isDone && styles.stepTabDone,
              ]}
              onPress={() => {
                if (isDone || (item.step === 2 && isStep1Fulfilled) || (item.step === 3 && isStep2Fulfilled) || (item.step === 4 && isStep3Fulfilled)) {
                  setCurrentStep(item.step as any);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stepTabText,
                  isActive && styles.stepTabTextActive,
                  isDone && styles.stepTabTextDone,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* STEP 1: OCR SCAN                                                         */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            {/* Big Prominent Dropzone / Upload Box */}
            {roLetterDoc ? (
              <View style={styles.uploadedDocBigCard}>
                <View style={styles.docBigCardLeft}>
                  <View style={styles.docIconCircle}>
                    <FileCheck size={26} color="#0062FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docBigCardName} numberOfLines={1}>
                      {roLetterDoc.name || 'Release_Order_Document.pdf'}
                    </Text>
                    <Text style={styles.docBigCardStatus}>
                      {isScanningRo ? 'Reading & Verifying with AI...' : 'Scanned & Ready'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.reUploadBtn}
                  onPress={() => {
                    setRoLetterDoc(null);
                    setActiveUploadTarget('ro_letter');
                  }}
                >
                  <RefreshCw size={13} color="#0062FF" />
                  <Text style={styles.reUploadBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.bigDropzoneBox}
                onPress={() => setActiveUploadTarget('ro_letter')}
                activeOpacity={0.8}
              >
                <View style={styles.bigDropzoneIconCircle}>
                  <ScanLine size={32} color="#0062FF" strokeWidth={2.2} />
                </View>
                <Text style={styles.bigDropzoneTitle}>Scan / Upload Release Order (RO)</Text>
                <Text style={styles.bigDropzoneSub}>
                  Tap to capture from camera or choose PDF / Image
                </Text>

                <View style={styles.dropzoneActionBtnsRow}>
                  <View style={styles.dzActionPillPrimary}>
                    <Camera size={15} color="#FFFFFF" />
                    <Text style={styles.dzActionPillPrimaryText}>Open Camera</Text>
                  </View>
                  <View style={styles.dzActionPillSecondary}>
                    <Upload size={14} color="#0062FF" />
                    <Text style={styles.dzActionPillSecondaryText}>Browse Files</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* OCR Identifier Verification */}
            {roLetterDoc && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Sparkles size={15} color="#7C3AED" />
                  <Text style={styles.cardTitle}>OCR Verification</Text>
                </View>

                {[plateMatch, engineMatch, chassisMatch].map((item) => (
                  <View key={item.field} style={styles.verifyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyLabel}>{item.label}</Text>
                      <Text style={styles.verifySub}>Yard: {item.yardVal} • Doc: {item.docVal || '—'}</Text>
                    </View>

                    <View style={styles.verifyRight}>
                      <View style={[styles.statusTag, item.isMatched ? styles.tagGreen : styles.tagRed]}>
                        <Text style={[styles.statusTagText, item.isMatched ? styles.textGreen : styles.textRed]}>
                          {item.statusText}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          setFixFieldType(item.field);
                          setFixFieldValue(item.docVal || '');
                          setFixModalVisible(true);
                        }}
                      >
                        <Edit3 size={13} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: RECIPIENT DETAILS                                                */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            {/* Person Type */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Release Person</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentItem, recipientType === 'CUSTOMER' && styles.segmentItemActive]}
                  onPress={() => setRecipientType('CUSTOMER')}
                >
                  <Text style={[styles.segmentText, recipientType === 'CUSTOMER' && styles.segmentTextActive]}>
                    Borrower / Customer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentItem, recipientType === 'BUYER' && styles.segmentItemActive]}
                  onPress={() => setRecipientType('BUYER')}
                >
                  <Text style={[styles.segmentText, recipientType === 'BUYER' && styles.segmentTextActive]}>
                    Buyer / Representative
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contact Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recipient Details</Text>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
                value={recipientName}
                onChangeText={setRecipientName}
              />

              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="10-Digit Mobile Number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
              />
            </View>

            {/* ID Proof */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ID Proof</Text>
              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setIdTypeDropdownVisible(true)}
              >
                <Text style={styles.selectBoxText}>{selectedIdType || 'Select ID Type'}</Text>
                <ChevronDown size={15} color="#64748B" />
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="ID Number (Optional)"
                placeholderTextColor="#94A3B8"
                value={idNumberText}
                onChangeText={setIdNumberText}
                autoCapitalize="characters"
              />

              <View style={styles.idPhotoGrid}>
                {/* Front */}
                <View style={{ flex: 1 }}>
                  {idProofDocFront ? (
                    <View style={styles.thumbBox}>
                      <Image source={{ uri: idProofDocFront.uri }} style={styles.thumbImg} />
                      <TouchableOpacity style={styles.thumbDelete} onPress={() => setIdProofDocFront(null)}>
                        <X size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadThumbBtn} onPress={() => setActiveUploadTarget('idproof_front')}>
                      <Camera size={18} color="#0062FF" />
                      <Text style={styles.uploadThumbText}>ID Front Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Back */}
                {isTwoSidedId && (
                  <View style={{ flex: 1 }}>
                    {idProofDocBack ? (
                      <View style={styles.thumbBox}>
                        <Image source={{ uri: idProofDocBack.uri }} style={styles.thumbImg} />
                        <TouchableOpacity style={styles.thumbDelete} onPress={() => setIdProofDocBack(null)}>
                          <X size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.uploadThumbBtn} onPress={() => setActiveUploadTarget('idproof_back')}>
                        <Camera size={18} color="#0062FF" />
                        <Text style={styles.uploadThumbText}>ID Back Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: PAYMENT & CHARGES                                                */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            {/* Component */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Charge Component</Text>
              <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setChargeDropdownVisible(true)}
              >
                <Text style={styles.selectBoxText}>
                  {CHARGE_OPTIONS.find((o) => o.key === chargeOption)?.label || 'Select Charge'}
                </Text>
                <ChevronDown size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Stay & Calculation */}
            {!isFreeRelease && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Calculation</Text>
                <View style={styles.calcBox}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Stay: {stayDays}d (−{waiverDaysConfig}d waiver)</Text>
                    <Text style={styles.calcVal}>{chargeableDays}d @ ₹{dailyRate}/d</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.calcRow}>
                    <Text style={styles.calcTotalLabel}>Total Amount</Text>
                    <Text style={styles.calcTotalVal}>₹{finalTotalAmount.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Payment Mode */}
            {!isFreeRelease && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payment Mode</Text>
                <TouchableOpacity
                  style={styles.selectBox}
                  onPress={() => setPaymentModeDropdownVisible(true)}
                >
                  <Text style={styles.selectBoxText}>
                    {PAYMENT_MODES.find((pm) => pm.key === paymentMode)?.label || 'Select Payment Mode'}
                  </Text>
                  <ChevronDown size={15} color="#64748B" />
                </TouchableOpacity>

                {(paymentMode === 'Online' || paymentMode === 'Cash + Online') && (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Paid To (Account / QR Name)"
                      placeholderTextColor="#94A3B8"
                      value={onlinePaidToName}
                      onChangeText={setOnlinePaidToName}
                    />

                    {onlineScreenshot ? (
                      <View style={styles.fileUploadedRow}>
                        <ImageIcon size={16} color="#0062FF" />
                        <Text style={styles.fileNameText}>Screenshot Attached</Text>
                        <TouchableOpacity onPress={() => setOnlineScreenshot(null)}>
                          <X size={15} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setActiveUploadTarget('screenshot')}>
                        <Camera size={15} color="#0062FF" />
                        <Text style={styles.secondaryBtnText}>Upload Payment Screenshot</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: EXIT HANDOVER PHOTO                                              */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            {/* Gate Photo */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Gate Exit Handover Photo</Text>
              {handoverPhoto ? (
                <View style={styles.gatePhotoBox}>
                  <Image source={{ uri: handoverPhoto.uri }} style={styles.gateImg} />
                  <TouchableOpacity style={styles.retakeBtn} onPress={() => setHandoverPhoto(null)}>
                    <X size={12} color="#FFFFFF" />
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.gateUploadBox} onPress={() => setActiveUploadTarget('handover')}>
                  <Camera size={28} color="#0062FF" />
                  <Text style={styles.gateUploadTitle}>Capture Handover Photo</Text>
                  <Text style={styles.gateUploadSub}>Recipient with vehicle at gate</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Release Summary</Text>
              <View style={styles.summaryList}>
                <Text style={styles.summaryItem}>✓ RO Document Verified</Text>
                <Text style={styles.summaryItem}>✓ Recipient: {recipientName || 'Borrower'} ({recipientPhone})</Text>
                <Text style={styles.summaryItem}>
                  ✓ Amount: {isFreeRelease ? 'Free (₹0)' : `₹${finalTotalAmount.toLocaleString('en-IN')} (${paymentMode})`}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* FIXED BOTTOM ACTION BAR                                                   */}
      {/* ========================================================================= */}
      <View style={[styles.fixedBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.bottomBackBtn}
            onPress={() => setCurrentStep((prev) => (prev - 1) as any)}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color="#475569" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.bottomPrimaryBtn,
            (!isCurrentStepValid || submitting) && styles.bottomPrimaryBtnDisabled,
            currentStep === 4 && styles.bottomSuccessBtn,
          ]}
          disabled={!isCurrentStepValid || submitting}
          onPress={handleNextStep}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              {currentStep === 4 ? (
                <>
                  <ShieldCheck size={18} color="#FFFFFF" />
                  <Text style={styles.bottomPrimaryBtnText}>Confirm Release & Gate Pass</Text>
                </>
              ) : (
                <>
                  <Text style={styles.bottomPrimaryBtnText}>
                    {currentStep === 1
                      ? 'Next: Recipient Details'
                      : currentStep === 2
                      ? 'Next: Payment & Charges'
                      : 'Next: Gate Exit Photo'}
                  </Text>
                  <ArrowRight size={17} color="#FFFFFF" />
                </>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Upload Choice Modal */}
      <Modal visible={activeUploadTarget !== null} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActiveUploadTarget(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Attach Photo / File</Text>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handlePickImage(true)}>
              <Camera size={18} color="#0062FF" />
              <Text style={styles.sheetBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handlePickImage(false)}>
              <ImageIcon size={18} color="#0062FF" />
              <Text style={styles.sheetBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={handlePickDocument}>
              <FileText size={18} color="#0062FF" />
              <Text style={styles.sheetBtnText}>Choose Document (PDF)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ID Type Modal */}
      <Modal visible={idTypeDropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setIdTypeDropdownVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select ID Type</Text>
            {INDIAN_ID_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.sheetOption}
                onPress={() => {
                  setSelectedIdType(t);
                  setIdTypeDropdownVisible(false);
                }}
              >
                <Text style={[styles.sheetOptionText, selectedIdType === t && styles.sheetOptionTextActive]}>{t}</Text>
                {selectedIdType === t && <Check size={15} color="#0062FF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Charge Modal */}
      <Modal visible={chargeDropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setChargeDropdownVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Charge</Text>
            {CHARGE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                style={styles.sheetOption}
                onPress={() => {
                  setChargeOption(o.key);
                  setChargeDropdownVisible(false);
                }}
              >
                <Text style={[styles.sheetOptionText, chargeOption === o.key && styles.sheetOptionTextActive]}>{o.label}</Text>
                {chargeOption === o.key && <Check size={15} color="#0062FF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Mode Modal */}
      <Modal visible={paymentModeDropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPaymentModeDropdownVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Payment Mode</Text>
            {PAYMENT_MODES.map((pm) => (
              <TouchableOpacity
                key={pm.key}
                style={styles.sheetOption}
                onPress={() => handleSelectPaymentMode(pm.key)}
              >
                <Text style={[styles.sheetOptionText, paymentMode === pm.key && styles.sheetOptionTextActive]}>{pm.label}</Text>
                {paymentMode === pm.key && <Check size={15} color="#0062FF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Fix Modal */}
      <Modal visible={fixModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setFixModalVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Correct Value</Text>
            <TextInput
              style={styles.input}
              value={fixFieldValue}
              onChangeText={setFixFieldValue}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 10 }]}
              onPress={() => {
                if (fixFieldType === 'registration') setExtractedPlate(fixFieldValue.trim());
                else if (fixFieldType === 'engine') setExtractedEngine(fixFieldValue.trim());
                else if (fixFieldType === 'chassis') setExtractedChassis(fixFieldValue.trim());
                setFixModalVisible(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Gate Pass Modal */}
      <GatePassModal
        visible={showGatePassModal}
        gatePassResult={gatePassResult}
        onClose={handleFinishGatePass}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  stepTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  stepTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  stepTabDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  stepTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTabTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  stepTabTextDone: {
    color: '#059669',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 90,
  },
  stepContainer: {
    gap: 10,
  },
  bigDropzoneBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0062FF',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bigDropzoneIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bigDropzoneTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  bigDropzoneSub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
  dropzoneActionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dzActionPillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0062FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dzActionPillPrimaryText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dzActionPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dzActionPillSecondaryText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  uploadedDocBigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docBigCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBigCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  docBigCardStatus: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  reUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reUploadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0062FF',
    borderRadius: 8,
    paddingVertical: 10,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0062FF',
  },
  fileUploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginHorizontal: 8,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  verifyLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  verifySub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  verifyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagGreen: {
    backgroundColor: '#DCFCE7',
  },
  tagRed: {
    backgroundColor: '#FEE2E2',
  },
  statusTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#DC2626',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '500',
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  selectBoxText: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  segmentText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
  idPhotoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  uploadThumbBtn: {
    height: 65,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  uploadThumbText: {
    fontSize: 10.5,
    color: '#0062FF',
    fontWeight: '600',
  },
  thumbBox: {
    height: 65,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbDelete: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  calcVal: {
    fontSize: 11.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  calcTotalLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  calcTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0062FF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  gateUploadBox: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gateUploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0062FF',
  },
  gateUploadSub: {
    fontSize: 11,
    color: '#64748B',
  },
  gatePhotoBox: {
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  gateImg: {
    width: '100%',
    height: '100%',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  retakeBtnText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryList: {
    gap: 4,
  },
  summaryItem: {
    fontSize: 11.5,
    color: '#059669',
    fontWeight: '600',
  },
  fixedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0062FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomPrimaryBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  bottomSuccessBtn: {
    backgroundColor: '#059669',
  },
  bottomPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 16,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetOptionText: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '500',
  },
  sheetOptionTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },
});
