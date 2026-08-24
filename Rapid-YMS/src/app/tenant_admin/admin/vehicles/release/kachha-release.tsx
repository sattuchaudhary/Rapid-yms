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
} from 'lucide-react-native';
import ReleaseHeader from './header';
import GatePassModal from './GatePassModal';
import {
  PaymentMode,
  ReleaseDocAttachment,
  GatePassResult,
} from './types';
import {
  getVehicleById,
  getVehicles,
  directReleaseVehicle,
  uploadFileToStorage,
} from '@/services/api';

type KachhaReasonType =
  | 'Loan Paid'
  | 'Repossession Cancelled'
  | 'Settlement'
  | 'Police / Legal'
  | 'Other Reason';

type PaymentChargeOption =
  | 'REPO_PLUS_PARKING'
  | 'ONLY_PARKING'
  | 'ONLY_REPO'
  | 'NOTHING';

type IndianIdType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'Driving License'
  | 'Voter ID'
  | 'Passport';

const KACHHA_REASON_OPTIONS: KachhaReasonType[] = [
  'Loan Paid',
  'Repossession Cancelled',
  'Settlement',
  'Police / Legal',
  'Other Reason',
];

const CHARGE_OPTIONS = [
  { key: 'REPO_PLUS_PARKING', label: 'Repo Charge + Parking' },
  { key: 'ONLY_PARKING', label: 'Only Parking' },
  { key: 'ONLY_REPO', label: 'Only Repo Charge' },
  { key: 'NOTHING', label: 'Nothing (₹0)' },
];

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

export default function KachhaReleaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, plate } = useLocalSearchParams<{ id?: string; plate?: string }>();

  // 1. Vehicle State
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // Dropdown Modals Visibility
  const [reasonDropdownVisible, setReasonDropdownVisible] = useState(false);
  const [chargeDropdownVisible, setChargeDropdownVisible] = useState(false);
  const [paymentModeDropdownVisible, setPaymentModeDropdownVisible] = useState(false);
  const [idTypeDropdownVisible, setIdTypeDropdownVisible] = useState(false);

  // STEP 1: REASON
  const [selectedReason, setSelectedReason] = useState<KachhaReasonType | null>(null);
  const [otherReasonText, setOtherReasonText] = useState('');

  // STEP 2: CHARGE COMPONENT
  const [chargeOption, setChargeOption] = useState<PaymentChargeOption | null>(null);

  // STEP 3: CUSTOMER DETAILS
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // STEP 4: STAY DATES & CALCULATION
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [dailyRate, setDailyRate] = useState<number>(0);
  const [repoCharge, setRepoCharge] = useState<string>('2500');
  const [gstOnParking, setGstOnParking] = useState(false);
  const [gstOnRepo, setGstOnRepo] = useState(false);

  // STEP 5: PAYMENT MODE
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [onlinePaidToName, setOnlinePaidToName] = useState('');
  const [onlineScreenshot, setOnlineScreenshot] = useState<ReleaseDocAttachment | null>(null);

  // Split Payment Inputs
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitOnlineAmount, setSplitOnlineAmount] = useState('');

  // CUSTOMER ID PROOF
  const [selectedIdType, setSelectedIdType] = useState<IndianIdType | null>(null);
  const [idNumberText, setIdNumberText] = useState('');
  const [idProofDocFront, setIdProofDocFront] = useState<ReleaseDocAttachment | null>(null);
  const [idProofDocBack, setIdProofDocBack] = useState<ReleaseDocAttachment | null>(null);

  // CUSTOMER PHOTO WITH VEHICLE
  const [handoverPhoto, setHandoverPhoto] = useState<ReleaseDocAttachment | null>(null);

  // Upload modal target
  const [activeUploadTarget, setActiveUploadTarget] = useState<
    'screenshot' | 'idproof_front' | 'idproof_back' | 'handover' | null
  >(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [gatePassResult, setGatePassResult] = useState<GatePassResult | null>(null);
  const [showGatePassModal, setShowGatePassModal] = useState(false);

  const isFreeRelease = chargeOption === 'NOTHING';

  const isTwoSidedId =
    selectedIdType === 'Aadhaar Card' ||
    selectedIdType === 'Driving License' ||
    selectedIdType === 'Voter ID';

  // Real-time calculation
  const diffTime = Math.max(0, releaseDate.getTime() - entryDate.getTime());
  const stayDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let baseParkingAmount = 0;
  let baseRepoAmount = 0;

  if (chargeOption === 'REPO_PLUS_PARKING') {
    baseParkingAmount = stayDays * dailyRate;
    baseRepoAmount = parseFloat(repoCharge) || 0;
  } else if (chargeOption === 'ONLY_PARKING') {
    baseParkingAmount = stayDays * dailyRate;
    baseRepoAmount = 0;
  } else if (chargeOption === 'ONLY_REPO') {
    baseParkingAmount = 0;
    baseRepoAmount = parseFloat(repoCharge) || 0;
  } else {
    baseParkingAmount = 0;
    baseRepoAmount = 0;
  }

  const parkingGstAmount = gstOnParking ? Math.round(baseParkingAmount * 0.18 * 100) / 100 : 0;
  const repoGstAmount = gstOnRepo ? Math.round(baseRepoAmount * 0.18 * 100) / 100 : 0;

  const finalTotalAmount = isFreeRelease
    ? 0
    : Math.round((baseParkingAmount + baseRepoAmount + parkingGstAmount + repoGstAmount) * 100) / 100;

  const numSplitCash = parseFloat(splitCashAmount) || 0;
  const numSplitOnline = parseFloat(splitOnlineAmount) || 0;
  const splitTotalSum = Math.round((numSplitCash + numSplitOnline) * 100) / 100;
  const splitDifference = Math.round((finalTotalAmount - splitTotalSum) * 100) / 100;

  // Auto-calculate remaining amount when user types in Cash input
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

  // Auto-calculate remaining amount when user types in Online input
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

  // Progressive validation
  const isStep1Fulfilled =
    selectedReason !== null &&
    (selectedReason !== 'Other Reason' || otherReasonText.trim().length >= 2);

  const isStep2Fulfilled = isStep1Fulfilled && chargeOption !== null;

  const isStep3Fulfilled =
    isStep2Fulfilled &&
    customerName.trim().length >= 2 &&
    customerPhone.trim().length === 10;

  const isStep4Fulfilled = isStep3Fulfilled;

  const isStep5PaymentFulfilled =
    isStep4Fulfilled &&
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

  const isIdProofFulfilled =
    isStep5PaymentFulfilled &&
    selectedIdType !== null &&
    idProofDocFront !== null &&
    (!isTwoSidedId || idProofDocBack !== null);

  const isHandoverPhotoFulfilled = isIdProofFulfilled && handoverPhoto !== null;

  // Fetch Vehicle
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
        if (data.customerName) setCustomerName(data.customerName);
        if (data.customerPhone) setCustomerPhone(data.customerPhone);

        if (data.entryDate) {
          setEntryDate(new Date(data.entryDate));
        }

        const vType = data.vehicleType;
        const bankRate = data.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vType);
        const resolvedKachhaRate =
          (bankRate?.kachhaRate && Number(bankRate.kachhaRate) > 0)
            ? Number(bankRate.kachhaRate)
            : (data.bank?.kachhaParkingRate && Number(data.bank.kachhaParkingRate) > 0)
            ? Number(data.bank.kachhaParkingRate)
            : (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0)
            ? Number(bankRate.dailyRate)
            : 0;
        setDailyRate(resolvedKachhaRate);
      } else {
        Alert.alert('Not Found', 'Vehicle details could not be loaded.');
      }
    } catch (err: any) {
      console.warn('[Fetch Vehicle Error]', err);
      Alert.alert('Error', err?.message || 'Failed to load vehicle details.');
    } finally {
      setLoading(false);
    }
  }, [id, plate]);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  const handleDatePicked = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setReleaseDate(selectedDate);
    }
  };

  // Upload Handlers
  const openUpload = (target: 'screenshot' | 'idproof_front' | 'idproof_back' | 'handover') => {
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
        Alert.alert('Permission Needed', 'Camera permission is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const localUri = result.assets[0].uri;
        const attachObj: ReleaseDocAttachment = { uri: localUri, type: 'image', isUploading: true };

        if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'image/jpeg');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, type: 'image', isUploading: false };

        if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
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

        if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'image/jpeg');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, type: 'image', isUploading: false };

        if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
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

        if (target === 'screenshot') setOnlineScreenshot(attachObj);
        else if (target === 'idproof_front') setIdProofDocFront(attachObj);
        else if (target === 'idproof_back') setIdProofDocBack(attachObj);
        else if (target === 'handover') setHandoverPhoto(attachObj);

        const cloudUrl = await uploadFileToStorage(localUri, 'releases', 'application/pdf');
        const doneObj: ReleaseDocAttachment = { uri: cloudUrl, name, type: 'pdf', isUploading: false };

        if (target === 'screenshot') setOnlineScreenshot(doneObj);
        else if (target === 'idproof_front') setIdProofDocFront(doneObj);
        else if (target === 'idproof_back') setIdProofDocBack(doneObj);
        else if (target === 'handover') setHandoverPhoto(doneObj);
      }
    } catch (err: any) {
      console.warn('[DocPicker Error]', err);
    }
  };

  // Submit Handler
  const handleSubmitKachhaRelease = async () => {
    if (!vehicle) return;
    if (!isHandoverPhotoFulfilled) {
      Alert.alert('Incomplete', 'Please fill all steps in sequence.');
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

    const finalReason = selectedReason === 'Other Reason' ? otherReasonText.trim() : selectedReason;

    try {
      setSubmitting(true);

      const payload = {
        releaseType: 'KACHHA',
        releasePersonType: 'CUSTOMER',
        customerIdProof: idProofDocFront!.uri,
        customerIdProofBack: idProofDocBack?.uri,
        handoverPhoto1: handoverPhoto!.uri,
        handoverPhoto2:
          !isFreeRelease && (paymentMode === 'Online' || paymentMode === 'Cash + Online')
            ? onlineScreenshot?.uri
            : undefined,
        paidAmount: isFreeRelease ? 0 : finalTotalAmount,
        totalAmount: isFreeRelease ? 0 : finalTotalAmount,
        paymentMode: isFreeRelease ? 'Free / Nothing' : paymentMode || 'Cash',
        remarks: `Kachha: ${finalReason} | Charge: ${chargeOption} | Mode: ${
          isFreeRelease
            ? 'Free (₹0)'
            : paymentMode === 'Cash + Online'
            ? `Cash: ₹${numSplitCash}, Online: ₹${numSplitOnline} (${onlinePaidToName})`
            : paymentMode === 'Online'
            ? `Online (${onlinePaidToName})`
            : paymentMode
        } | ID: ${selectedIdType} (${idNumberText || 'N/A'})`,
        releasedTo: customerName.trim(),
        mobileNumber: customerPhone.trim(),
      };

      const res = await directReleaseVehicle(vehicle.id, payload);

      if (res?.success && res?.data) {
        setGatePassResult(res.data);
        setShowGatePassModal(true);
      } else {
        throw new Error(res?.error || 'Failed to process release');
      }
    } catch (err: any) {
      console.warn('[Kachha Release Error]', err);
      Alert.alert('Release Failed', err?.message || 'Could not complete release.');
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
  const vehicleNumber = (vehicle?.vehicleNumber || 'KACHHA RELEASE').toUpperCase();

  const idProofStepNumber = isFreeRelease ? 5 : 6;
  const handoverStepNumber = isFreeRelease ? 6 : 7;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Clean Top Header */}
      <ReleaseHeader
        vehicleNumber={vehicleNumber}
        subtitle="Kachha Release"
        onBackPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/tenant_admin/admin/vehicles' as any);
        }}
        onMenuPress={() => setMenuModalVisible(true)}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading vehicle...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 85 }]}
        >
          {/* ========================================================= */}
          {/* STEP 1: REASON FOR RELEASE                                */}
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
              <Text style={styles.stepTitle}>Reason for Release *</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                selectedReason ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
              ]}
              onPress={() => setReasonDropdownVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownText, selectedReason && styles.dropdownTextFilled]}>
                {selectedReason || 'Select Reason...'}
              </Text>
              <ChevronDown size={17} color="#64748B" />
            </TouchableOpacity>

            {selectedReason === 'Other Reason' && (
              <TextInput
                style={[styles.textInput, { marginTop: 6 }]}
                placeholder="Enter specific reason..."
                placeholderTextColor="#94A3B8"
                value={otherReasonText}
                onChangeText={setOtherReasonText}
              />
            )}
          </View>

          {/* ========================================================= */}
          {/* STEP 2: PAYMENT CHARGE COMPONENT                          */}
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
                <Text style={styles.stepTitle}>Payment Charge *</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  chargeOption ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
                ]}
                onPress={() => setChargeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownText, chargeOption && styles.dropdownTextFilled]}>
                  {chargeOption
                    ? CHARGE_OPTIONS.find((c) => c.key === chargeOption)?.label
                    : 'Select Charges...'}
                </Text>
                <ChevronDown size={17} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Complete Step 1</Text>
            </View>
          )}

          {/* ========================================================= */}
          {/* STEP 3: CUSTOMER DETAILS                                  */}
          {/* ========================================================= */}
          {isStep2Fulfilled ? (
            <View style={[styles.stepCard, !isStep3Fulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isStep3Fulfilled && styles.stepBadgeDone]}>
                  {isStep3Fulfilled ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepBadgeText}>3</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>Customer Details *</Text>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Customer Name *"
                    placeholderTextColor="#94A3B8"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-Digit Phone *"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
                </View>
              </View>
            </View>
          ) : isStep1Fulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Complete Step 2</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* STEP 4: STAY & CALCULATION                                */}
          {/* ========================================================= */}
          {isStep3Fulfilled ? (
            <View style={styles.stepCard}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, styles.stepBadgeDone]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
                <Text style={styles.stepTitle}>Stay & Charges Calculation</Text>
              </View>

              {/* Dates Row */}
              <View style={styles.twoColRow}>
                <View style={styles.dateDisplayCard}>
                  <Text style={styles.dateLabel}>Entry Date</Text>
                  <Text style={styles.dateVal}>
                    {entryDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.dateDisplayCard, styles.dateDisplayCardActive]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.dateLabel}>Release Date</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} color="#0062FF" />
                    <Text style={[styles.dateVal, { color: '#0062FF' }]}>
                      {releaseDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={releaseDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDatePicked}
                  maximumDate={new Date()}
                />
              )}

              {/* Total Stay Days Banner */}
              <View style={styles.stayDaysBanner}>
                <Text style={styles.stayDaysText}>Total Stay: {stayDays} Days</Text>
              </View>

              {/* Charge Details */}
              {(chargeOption === 'REPO_PLUS_PARKING' || chargeOption === 'ONLY_PARKING') && (
                <View style={styles.chargeInputBlock}>
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Daily Rate (₹/day)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={dailyRate.toString()}
                        onChangeText={(txt) => setDailyRate(parseFloat(txt) || 0)}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', paddingTop: 14 }}>
                      <Text style={styles.subCalcText}>
                        {stayDays}d × ₹{dailyRate} = ₹{baseParkingAmount}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.gstCheckboxRow}
                    onPress={() => setGstOnParking(!gstOnParking)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkboxSquare, gstOnParking && styles.checkboxSquareChecked]}>
                      {gstOnParking && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.gstLabel}>
                      Add 18% GST on Parking (+₹{Math.round(baseParkingAmount * 0.18)})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(chargeOption === 'REPO_PLUS_PARKING' || chargeOption === 'ONLY_REPO') && (
                <View style={[styles.chargeInputBlock, { marginTop: 4 }]}>
                  <Text style={styles.fieldLabel}>Repo Charge (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={repoCharge}
                    onChangeText={setRepoCharge}
                    placeholder="2500"
                  />

                  <TouchableOpacity
                    style={styles.gstCheckboxRow}
                    onPress={() => setGstOnRepo(!gstOnRepo)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkboxSquare, gstOnRepo && styles.checkboxSquareChecked]}>
                      {gstOnRepo && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.gstLabel}>
                      Add 18% GST on Repo (+₹{Math.round((parseFloat(repoCharge) || 0) * 0.18)})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {isFreeRelease && (
                <View style={styles.freeBanner}>
                  <Text style={styles.freeBannerText}>Free Release (₹0)</Text>
                </View>
              )}

              {/* Total Ledger Card */}
              <View style={styles.totalCard}>
                {baseParkingAmount > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={styles.ledgerLabel}>Parking ({stayDays}d @ ₹{dailyRate})</Text>
                    <Text style={styles.ledgerVal}>₹{baseParkingAmount}</Text>
                  </View>
                )}
                {parkingGstAmount > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={[styles.ledgerLabel, { color: '#059669' }]}>Parking GST (18%)</Text>
                    <Text style={[styles.ledgerVal, { color: '#059669' }]}>+₹{parkingGstAmount}</Text>
                  </View>
                )}
                {baseRepoAmount > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={styles.ledgerLabel}>Repo Charge</Text>
                    <Text style={styles.ledgerVal}>₹{baseRepoAmount}</Text>
                  </View>
                )}
                {repoGstAmount > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={[styles.ledgerLabel, { color: '#059669' }]}>Repo GST (18%)</Text>
                    <Text style={[styles.ledgerVal, { color: '#059669' }]}>+₹{repoGstAmount}</Text>
                  </View>
                )}

                <View style={styles.finalTotalRow}>
                  <Text style={styles.finalTotalLabel}>TOTAL AMOUNT</Text>
                  <Text style={styles.finalTotalVal}>₹{finalTotalAmount.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          ) : isStep2Fulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Complete Step 3</Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* STEP 5: PAYMENT MODE (SHOWN ONLY IF PAYING)               */}
          {/* ========================================================= */}
          {!isFreeRelease && (
            isStep4Fulfilled ? (
              <View style={[styles.stepCard, !isStep5PaymentFulfilled && styles.stepCardActiveBorder]}>
                <View style={styles.stepHeaderRow}>
                  <View style={[styles.stepBadge, isStep5PaymentFulfilled && styles.stepBadgeDone]}>
                    {isStep5PaymentFulfilled ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text style={styles.stepBadgeText}>5</Text>
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
            ) : isStep3Fulfilled ? (
              <View style={styles.lockedStepCard}>
                <Lock size={13} color="#94A3B8" />
                <Text style={styles.lockedStepText}>Complete Step 4</Text>
              </View>
            ) : null
          )}

          {/* ========================================================= */}
          {/* CUSTOMER ID PROOF                                         */}
          {/* ========================================================= */}
          {isStep5PaymentFulfilled ? (
            <View style={[styles.stepCard, !isIdProofFulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isIdProofFulfilled && styles.stepBadgeDone]}>
                  {isIdProofFulfilled ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepBadgeText}>{idProofStepNumber}</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>Customer ID Proof *</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  selectedIdType ? styles.dropdownBtnFilled : styles.dropdownBtnEmpty,
                ]}
                onPress={() => setIdTypeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownText, selectedIdType && styles.dropdownTextFilled]}>
                  {selectedIdType || 'Select ID Type...'}
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

                  {/* Front Side */}
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

                  {/* Back Side (for 2-sided IDs) */}
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
          {/* CUSTOMER PHOTO WITH VEHICLE                               */}
          {/* ========================================================= */}
          {isIdProofFulfilled ? (
            <View style={[styles.stepCard, !isHandoverPhotoFulfilled && styles.stepCardActiveBorder]}>
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepBadge, isHandoverPhotoFulfilled && styles.stepBadgeDone]}>
                  {isHandoverPhotoFulfilled ? (
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
          ) : isStep5PaymentFulfilled ? (
            <View style={styles.lockedStepCard}>
              <Lock size={13} color="#94A3B8" />
              <Text style={styles.lockedStepText}>Attach Customer ID first</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ========================================================= */}
      {/* STICKY BOTTOM SUBMIT BUTTON                               */}
      {/* ========================================================= */}
      {vehicle && (
        <View style={[styles.stickyFooter, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!isHandoverPhotoFulfilled || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmitKachhaRelease}
            activeOpacity={0.85}
            disabled={!isHandoverPhotoFulfilled || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={17} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.submitBtnText}>
                  {isHandoverPhotoFulfilled
                    ? isFreeRelease
                      ? 'Complete Free Release (₹0)'
                      : `Complete Release & Gate Pass (₹${finalTotalAmount.toLocaleString('en-IN')})`
                    : 'Complete Steps in Sequence'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================= */}
      {/* DROPDOWN MODAL: REASON                                    */}
      {/* ========================================================= */}
      <Modal
        visible={reasonDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReasonDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setReasonDropdownVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select Reason for Release</Text>
                  <TouchableOpacity onPress={() => setReasonDropdownVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  {KACHHA_REASON_OPTIONS.map((item) => {
                    const isSelected = selectedReason === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive]}
                        onPress={() => {
                          setSelectedReason(item);
                          setReasonDropdownVisible(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                          {item}
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
      {/* DROPDOWN MODAL: CHARGES                                   */}
      {/* ========================================================= */}
      <Modal
        visible={chargeDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChargeDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setChargeDropdownVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Select Charges</Text>
                  <TouchableOpacity onPress={() => setChargeDropdownVisible(false)}>
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dropdownOptionsList}>
                  {CHARGE_OPTIONS.map((opt) => {
                    const isSelected = chargeOption === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive]}
                        onPress={() => {
                          setChargeOption(opt.key as PaymentChargeOption);
                          setChargeDropdownVisible(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                          {opt.label}
                        </Text>
                        {isSelected && <Check size={16} color="#059669" strokeWidth={2.6} />}
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
                  <Text style={styles.sheetTitle}>Upload</Text>
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

      {/* Gate Pass Clearance Modal */}
      <GatePassModal
        visible={showGatePassModal}
        onClose={handleFinishGatePass}
        gatePassData={gatePassResult}
        vehicle={vehicle}
        recipientName={customerName.trim()}
        recipientPhone={customerPhone.trim()}
        recipientType="Customer / Owner"
        paidAmount={finalTotalAmount}
        paymentMode={
          isFreeRelease
            ? 'Free Release (₹0)'
            : paymentMode === 'Cash + Online'
            ? `Cash (₹${numSplitCash}) + Online (₹${numSplitOnline})`
            : paymentMode || 'Cash'
        }
        releaseType="KACHHA"
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
  dateDisplayCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 2,
  },
  dateDisplayCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
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
  stayDaysBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
  },
  stayDaysText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0062FF',
  },
  chargeInputBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  subCalcText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0062FF',
  },
  gstCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkboxSquare: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  gstLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  freeBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  freeBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
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
    marginTop: 2,
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
