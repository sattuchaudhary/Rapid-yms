import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Clipboard,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Check,
  X,
  Plus,
  Trash2,
  Printer,
  ChevronRight,
  ChevronDown,
  Car,
  Bike,
  Truck,
  Building,
  CheckCircle2,
  FileText,
  User,
  Phone,
  Calendar,
  Clock,
  Share2,
  Copy,
  MapPin,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Search,
  AlertCircle,
  HelpCircle,
  Layers,
  AlertTriangle,
  FileCheck,
  ThumbsUp,
  MinusCircle,
  XCircle,
  CloudUpload,
  RefreshCw,
  Edit3,
} from 'lucide-react-native';

import { apiRequest, getUserInfo, lookupRapidRepoVehicle } from '@/services/api';
import { DEFAULT_CHECKLIST, CustomInventoryItem } from '../settings/inventory-customization';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type VehicleType = 'TW' | 'THREE_W' | 'FW' | 'CV';
type BankCategory = 'direct' | 'third_party' | 'shift' | 'cash';

interface PhotoSlot {
  type: string;
  label: string;
  uri?: string;
  remoteUrl?: string;
  uploadStatus?: 'idle' | 'uploading' | 'uploaded' | 'error';
}

const STANDARD_PHOTO_SLOTS: PhotoSlot[] = [
  { type: 'customer', label: 'Customer with Vehicle' },
  { type: 'front', label: 'Front View' },
  { type: 'back', label: 'Rear View' },
  { type: 'left', label: 'Left Side Profile' },
  { type: 'right', label: 'Right Side Profile' },
  { type: 'engine', label: 'Engine Number' },
  { type: 'chassis', label: 'Chassis Number' },
];

const DRAFT_KEY = 'rapid_yms_inward_draft';

const uriToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[CheckIn] Error converting URI to base64:', error);
    return uri;
  }
};

export default function VehicleAddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);

  // Active in-flight upload promises map
  const uploadPromisesRef = useRef<Record<string, Promise<string | null>>>({});

  // Wizard Steps: 1: Specs & Repo, 2: Photos, 3: Inventory Checklist, 4: Success & Gate Pass
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittingText, setSubmittingText] = useState<string>('Saving vehicle entry...');
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);

  // Edit Mode state (to allow modifying without re-typing from scratch)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Dynamic Keyboard Height Tracking for smooth scroll offsets
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Tenant / Yard Details
  const [tenantName, setTenantName] = useState<string>('RAPID PARKING YARD');
  const [tenantAddress, setTenantAddress] = useState<string>('GURUGRAM, HARYANA');

  // Step 1: Specs & Repossession (By default, NOTHING is pre-selected)
  const [entryDate, setEntryDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('');
  const [vehicleTypePickerVisible, setVehicleTypePickerVisible] = useState<boolean>(false);

  const [brand, setBrand] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [chassisNumber, setChassisNumber] = useState<string>('');
  const [engineNumber, setEngineNumber] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [loanNumber, setLoanNumber] = useState<string>('');
  const [repoAgency, setRepoAgency] = useState<string>('');
  const [repoAgentName, setRepoAgentName] = useState<string>('');
  const [placeOfPossession, setPlaceOfPossession] = useState<string>(''); // Default Empty!

  // Financer / Bank States (Default Empty)
  const [banks, setBanks] = useState<any[]>([]);
  const [bankCategory, setBankCategory] = useState<BankCategory | ''>('');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState<boolean>(false);

  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [bankPickerVisible, setBankPickerVisible] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<'direct' | 'third_party' | 'sub'>('direct');
  const [bankSearch, setBankSearch] = useState<string>('');

  // Quick Add Bank Modal
  const [quickAddBankVisible, setQuickAddBankVisible] = useState<boolean>(false);
  const [quickBankName, setQuickBankName] = useState<string>('');
  const [savingQuickBank, setSavingQuickBank] = useState<boolean>(false);

  // Step 2: Photos (With Background Upload State)
  const [photos, setPhotos] = useState<PhotoSlot[]>(STANDARD_PHOTO_SLOTS);
  const [extraSlots, setExtraSlots] = useState<string[]>([]);
  const [activePhotoPickerSlot, setActivePhotoPickerSlot] = useState<string | null>(null);

  // Step 3: Simple & Visual Checklist (Default Condition Empty)
  const [masterInventory, setMasterInventory] = useState<CustomInventoryItem[]>([]);
  const [inventoryValues, setInventoryValues] = useState<Record<string, { isPresent: boolean; remarks: string }>>({});
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [overallCondition, setOverallCondition] = useState<'Good' | 'Average' | 'Bad' | ''>('');
  const [yardRemarks, setYardRemarks] = useState<string>('');

  // Step 4: Created Vehicle Data & Gate Pass
  const [createdVehicle, setCreatedVehicle] = useState<any>(null);

  // Rapid Repo Live Auto-Search & Smart Bank Matching States
  const [searchingRapidRepo, setSearchingRapidRepo] = useState<boolean>(false);
  const [rapidRepoMatchBanner, setRapidRepoMatchBanner] = useState<string | null>(null);
  const lookupTimeoutRef = useRef<any>(null);
  const lastLookedUpPlateRef = useRef<string>('');

  /**
   * Smart Bank Matcher: Matches incoming raw bank string (e.g. "IDFC March", "HDFC AUTO LOAN", "BAJAJ FIN")
   * with registered Direct Banks and Third Party Groups / Sub-Banks in YMS.
   */
  const findSmartBankMatch = useCallback(
    (
      rawBankName: string,
      bankList: any[]
    ): {
      category: BankCategory;
      bankId: string;
      bankName: string;
      thirdPartyId?: string;
      groupName?: string;
    } | null => {
      if (!rawBankName || !Array.isArray(bankList) || bankList.length === 0) {
        return null;
      }

      // Top Indian Financial Anchor Brand Keywords
      const KNOWN_ANCHORS = [
        'idfc',
        'hdfc',
        'icici',
        'sbi',
        'kotak',
        'bajaj',
        'axis',
        'chola',
        'cholamandalam',
        'tvs',
        'hero',
        'herofincorp',
        'mahindra',
        'mmfsl',
        'indusind',
        'yes',
        'au',
        'bandhan',
        'piramal',
        'shriram',
        'poonawalla',
        'tata',
        'fullerton',
        'smfg',
        'muthoot',
        'manappuram',
        'canara',
        'pnb',
        'bob',
        'baroda',
        'union',
        'equitas',
        'ujjivan',
        'fedbank',
        'federal',
      ];

      // Tokenize & normalize incoming string
      const clean = (s: string) =>
        (s || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ' ')
          .replace(
            /\b(bank|limited|ltd|finance|financial|services|corp|co|branch|march|car|auto|tw|loan|pvt|india|woff|writeoff|pool|two|wheeler|commercial|cv|collection|recovery|agency)\b/g,
            ''
          )
          .replace(/\s+/g, ' ')
          .trim();

      const rawClean = clean(rawBankName);
      const rawTokens = rawClean.split(' ').filter(t => t.length >= 2);

      // Find if raw string contains any recognized primary anchor (e.g. 'idfc')
      const rawAnchor = KNOWN_ANCHORS.find(a =>
        rawTokens.some(t => t === a || t.startsWith(a) || a.startsWith(t))
      );

      // 1. Separate into Direct Banks and Third Party Groups
      const directBanks = bankList.filter(b => !b.isThirdParty && !b.parentId);
      const thirdPartyGroups = bankList.filter(b => b.isThirdParty && !b.parentId);

      const calculateScore = (targetName: string): number => {
        const targetClean = clean(targetName);
        if (!targetClean || !rawClean) return 0;

        // Exact match or contains
        if (targetClean === rawClean) return 100;
        if (rawClean.startsWith(targetClean) || targetClean.startsWith(rawClean)) return 90;
        if (rawClean.includes(targetClean) || targetClean.includes(rawClean)) return 80;

        const targetTokens = targetClean.split(' ').filter(t => t.length >= 2);

        // Heavy Boost for Anchor Keyword Match (e.g. 'idfc' in 'idfc ashok verma woff' matching 'idfc first bank')
        if (rawAnchor && targetTokens.some(t => t === rawAnchor || t.startsWith(rawAnchor) || rawAnchor.startsWith(t))) {
          return 95;
        }

        // Token overlap match
        let matchedTokens = 0;
        for (const t of rawTokens) {
          if (targetTokens.some(tgt => tgt === t || tgt.startsWith(t) || t.startsWith(tgt))) {
            matchedTokens++;
          }
        }
        if (matchedTokens > 0) {
          return (matchedTokens / Math.max(rawTokens.length, targetTokens.length)) * 70;
        }
        return 0;
      };

      // 2. Priority 1: Check Direct Banks
      let bestDirect: { bank: any; score: number } | null = null;
      for (const b of directBanks) {
        const score = calculateScore(b.name);
        if (score >= 40 && (!bestDirect || score > bestDirect.score)) {
          bestDirect = { bank: b, score };
        }
      }

      // 3. Priority 2: Check Third Party Groups and Sub-Banks
      let bestThirdParty: { group: any; subBank?: any; score: number } | null = null;
      for (const group of thirdPartyGroups) {
        const groupScore = calculateScore(group.name);
        if (groupScore >= 40 && (!bestThirdParty || groupScore > bestThirdParty.score)) {
          bestThirdParty = { group, score: groupScore };
        }
        if (Array.isArray(group.subBanks)) {
          for (const sub of group.subBanks) {
            const subScore = calculateScore(sub.name);
            if (subScore >= 40 && (!bestThirdParty || subScore > bestThirdParty.score)) {
              bestThirdParty = { group, subBank: sub, score: subScore };
            }
          }
        }
      }

      // 4. Decide Best Match (Direct Bank prioritized)
      if (bestDirect && (!bestThirdParty || bestDirect.score >= bestThirdParty.score)) {
        return {
          category: 'direct',
          bankId: bestDirect.bank.id,
          bankName: bestDirect.bank.name,
        };
      }

      if (bestThirdParty) {
        if (bestThirdParty.subBank) {
          return {
            category: 'third_party',
            thirdPartyId: bestThirdParty.group.id,
            groupName: bestThirdParty.group.name,
            bankId: bestThirdParty.subBank.id,
            bankName: bestThirdParty.subBank.name,
          };
        }
        return {
          category: 'third_party',
          thirdPartyId: bestThirdParty.group.id,
          groupName: bestThirdParty.group.name,
          bankId: bestThirdParty.group.id,
          bankName: bestThirdParty.group.name,
        };
      }

      return null;
    },
    []
  );

  /**
   * Auto-Search Rapid Repo and Populate Details with Smart Bank Selection
   */
  const triggerRapidRepoAutoLookup = useCallback(
    async (plate: string, availableBanks?: any[]) => {
      const cleanPlate = (plate || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanPlate.length < 6 || cleanPlate === lastLookedUpPlateRef.current) {
        return;
      }

      lastLookedUpPlateRef.current = cleanPlate;
      setSearchingRapidRepo(true);

      try {
        const res = await lookupRapidRepoVehicle({ regNumber: cleanPlate });
        if (res?.success && res?.data) {
          const data = res.data;
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }

          // Auto-fill core vehicle specs
          if (data.customerName) setCustomerName(data.customerName);
          if (data.vehicleMake) setBrand(data.vehicleMake);
          if (data.vehicleModel) setModel(data.vehicleModel);
          if (data.chassisNumber) setChassisNumber(data.chassisNumber);
          if (data.engineNumber) setEngineNumber(data.engineNumber);
          if (data.loanNumber) {
            setLoanNumber(data.loanNumber);
            setRepoAgency(prev => prev || data.loanNumber);
          }

          // Smart Bank Matching
          const bankListToUse = availableBanks || banks;
          let matchedBankLabel = '';
          if (data.bankName) {
            const smartMatch = findSmartBankMatch(data.bankName, bankListToUse);
            if (smartMatch) {
              setBankCategory(smartMatch.category);
              setSelectedBankId(smartMatch.bankId);
              setSelectedBankName(smartMatch.bankName);
              if (smartMatch.thirdPartyId) setSelectedThirdPartyId(smartMatch.thirdPartyId);
              if (smartMatch.groupName) setSelectedGroupName(smartMatch.groupName);
              matchedBankLabel = `Matched Bank: ${smartMatch.bankName}`;
            } else {
              setBankCategory('direct');
              setSelectedBankName(data.bankName);
              matchedBankLabel = `Bank: ${data.bankName}`;
            }
          }

          const modelStr = [data.vehicleMake, data.vehicleModel].filter(Boolean).join(' ');
          setRapidRepoMatchBanner(
            `✓ Rapid Repo: ${modelStr || 'Vehicle Found'}${matchedBankLabel ? ` • ${matchedBankLabel}` : ''}`
          );
        }
      } catch (err) {
        // Silent catch for live typing
      } finally {
        setSearchingRapidRepo(false);
      }
    },
    [banks, findSmartBankMatch]
  );

  const handleVehicleNumberChange = (text: string) => {
    const upper = text.toUpperCase();
    setVehicleNumber(upper);
    setRapidRepoMatchBanner(null);

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    const clean = upper.replace(/[^A-Z0-9]/g, '');
    if (clean.length >= 6) {
      lookupTimeoutRef.current = setTimeout(() => {
        triggerRapidRepoAutoLookup(upper);
      }, 550);
    }
  };

  // Read search prefill params if navigated from Rapid Repo Vehicle Search
  const searchParams = useLocalSearchParams<{
    prefillVehicleNumber?: string;
    prefillCustomerName?: string;
    prefillBankName?: string;
    prefillBrand?: string;
    prefillModel?: string;
    prefillChassisNumber?: string;
    prefillEngineNumber?: string;
    prefillLoanNumber?: string;
  }>();

  useEffect(() => {
    if (searchParams.prefillVehicleNumber) {
      setVehicleNumber(searchParams.prefillVehicleNumber);
    }
    if (searchParams.prefillCustomerName) {
      setCustomerName(searchParams.prefillCustomerName);
    }
    if (searchParams.prefillBankName) {
      const smartMatch = findSmartBankMatch(searchParams.prefillBankName, banks);
      if (smartMatch) {
        setBankCategory(smartMatch.category);
        setSelectedBankId(smartMatch.bankId);
        setSelectedBankName(smartMatch.bankName);
        if (smartMatch.thirdPartyId) setSelectedThirdPartyId(smartMatch.thirdPartyId);
        if (smartMatch.groupName) setSelectedGroupName(smartMatch.groupName);
      } else {
        setSelectedBankName(searchParams.prefillBankName);
        setBankCategory('direct');
      }
    }
    if (searchParams.prefillBrand) {
      setBrand(searchParams.prefillBrand);
    }
    if (searchParams.prefillModel) {
      setModel(searchParams.prefillModel);
    }
    if (searchParams.prefillChassisNumber) {
      setChassisNumber(searchParams.prefillChassisNumber);
    }
    if (searchParams.prefillEngineNumber) {
      setEngineNumber(searchParams.prefillEngineNumber);
    }
    if (searchParams.prefillLoanNumber) {
      setLoanNumber(searchParams.prefillLoanNumber);
    }
  }, [
    searchParams.prefillVehicleNumber,
    searchParams.prefillCustomerName,
    searchParams.prefillBankName,
    searchParams.prefillBrand,
    searchParams.prefillModel,
    searchParams.prefillChassisNumber,
    searchParams.prefillEngineNumber,
    searchParams.prefillLoanNumber,
    banks,
    findSmartBankMatch,
  ]);

  // Fetch Tenant Details
  useEffect(() => {
    const loadTenantInfo = async () => {
      try {
        const savedConfig = await AsyncStorage.getItem('yms_print_config');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed.headerTitle) setTenantName(parsed.headerTitle);
          if (parsed.headerAddress) setTenantAddress(parsed.headerAddress);
          return;
        }

        const user = await getUserInfo();
        if (user && (user as any).tenant) {
          const t = (user as any).tenant;
          if (t.yardName) setTenantName(t.yardName);
          if (t.address) setTenantAddress(t.address);
        }
      } catch (err) {
        console.warn('[CheckIn] Error loading tenant details:', err);
      }
    };
    loadTenantInfo();
  }, []);

  // Load Banks
  const fetchBanks = useCallback(async () => {
    try {
      const res = await apiRequest('/api/banks');
      if (res?.success && Array.isArray(res.data)) {
        setBanks(res.data);
      } else if (Array.isArray(res)) {
        setBanks(res);
      }
    } catch (err) {
      console.warn('[CheckIn] Fetch Banks Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // Load Inventory Configuration
  useEffect(() => {
    const loadInventoryConfig = async () => {
      setLoadingInventory(true);
      try {
        const local = await AsyncStorage.getItem('yms_master_checklist_v2');
        let checklist: CustomInventoryItem[] = DEFAULT_CHECKLIST;

        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            checklist = parsed;
          }
        } else {
          try {
            const apiRes = await apiRequest('/api/inventory/config');
            if (apiRes?.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
              checklist = apiRes.data;
            }
          } catch (e) {}
        }

        const activeItems = checklist.filter(it => it.enabled !== false).sort((a, b) => a.order - b.order);
        setMasterInventory(activeItems);

        const initialVals: Record<string, { isPresent: boolean; remarks: string }> = {};
        activeItems.forEach(it => {
          initialVals[it.id] = {
            isPresent: false,
            remarks: '',
          };
        });
        setInventoryValues(initialVals);
      } catch (e) {
        console.warn('[CheckIn] Load Inventory Error:', e);
      } finally {
        setLoadingInventory(false);
      }
    };
    loadInventoryConfig();
  }, []);

  // Draft Auto-Save
  useEffect(() => {
    const checkProgress =
      vehicleNumber.trim() ||
      customerName.trim() ||
      selectedBankName.trim() ||
      photos.some(p => !!p.uri) ||
      repoAgency.trim() ||
      vehicleType;

    setHasUnsavedChanges(!!checkProgress && step < 4);

    if (checkProgress && !formSubmitted && !editingVehicleId) {
      const draftPayload = {
        vehicleNumber,
        vehicleType,
        brand,
        model,
        chassisNumber,
        engineNumber,
        customerName,
        customerPhone,
        loanNumber,
        repoAgency,
        repoAgentName,
        placeOfPossession,
        bankCategory,
        selectedBankId,
        selectedBankName,
        selectedThirdPartyId,
        selectedGroupName,
        photos,
        extraSlots,
        overallCondition,
        yardRemarks,
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload)).catch(() => {});
    }
  }, [
    vehicleNumber,
    vehicleType,
    brand,
    model,
    chassisNumber,
    engineNumber,
    customerName,
    customerPhone,
    loanNumber,
    repoAgency,
    repoAgentName,
    placeOfPossession,
    bankCategory,
    selectedBankId,
    selectedBankName,
    selectedThirdPartyId,
    selectedGroupName,
    photos,
    extraSlots,
    overallCondition,
    yardRemarks,
    step,
    formSubmitted,
    editingVehicleId,
  ]);

  // Draft Auto-Restore Prompt on Mount
  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_KEY);
        if (saved) {
          const d = JSON.parse(saved);
          if (d.vehicleNumber || d.customerName || d.selectedBankName || d.vehicleType) {
            Alert.alert(
              'Resume Incomplete Entry?',
              `Found an unsaved vehicle check-in for ${d.vehicleNumber || 'a vehicle'}. Do you want to restore it?`,
              [
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => AsyncStorage.removeItem(DRAFT_KEY).catch(() => {}),
                },
                {
                  text: 'Restore',
                  onPress: () => {
                    if (d.vehicleNumber) setVehicleNumber(d.vehicleNumber);
                    if (d.vehicleType) setVehicleType(d.vehicleType);
                    if (d.brand) setBrand(d.brand);
                    if (d.model) setModel(d.model);
                    if (d.chassisNumber) setChassisNumber(d.chassisNumber);
                    if (d.engineNumber) setEngineNumber(d.engineNumber);
                    if (d.customerName) setCustomerName(d.customerName);
                    if (d.customerPhone) setCustomerPhone(d.customerPhone);
                    if (d.loanNumber) setLoanNumber(d.loanNumber);
                    if (d.repoAgency) setRepoAgency(d.repoAgency);
                    if (d.repoAgentName) setRepoAgentName(d.repoAgentName);
                    if (d.placeOfPossession) setPlaceOfPossession(d.placeOfPossession);
                    if (d.bankCategory) setBankCategory(d.bankCategory);
                    if (d.selectedBankId) setSelectedBankId(d.selectedBankId);
                    if (d.selectedBankName) setSelectedBankName(d.selectedBankName);
                    if (d.selectedThirdPartyId) setSelectedThirdPartyId(d.selectedThirdPartyId);
                    if (d.selectedGroupName) setSelectedGroupName(d.selectedGroupName);
                    if (d.photos) setPhotos(d.photos);
                    if (d.extraSlots) setExtraSlots(d.extraSlots);
                    if (d.overallCondition) setOverallCondition(d.overallCondition);
                    if (d.yardRemarks) setYardRemarks(d.yardRemarks);
                  },
                },
              ]
            );
          }
        }
      } catch (err) {
        console.warn('[CheckIn] Draft restore failed:', err);
      }
    };
    restoreDraft();
  }, []);

  // Navigation Guard for Unsaved Changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!hasUnsavedChanges || step === 4 || formSubmitted) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Discard Inward Entry?',
        'You have entered vehicle details. Going back will save it as a local draft. Are you sure you want to leave?',
        [
          { text: 'Keep Editing', style: 'cancel', onPress: () => {} },
          {
            text: 'Discard & Leave',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, step, formSubmitted]);

  // Duplicate Plate Number Check
  const checkDuplicateVehicle = async (plateNumber: string): Promise<boolean> => {
    if (editingVehicleId) return true; // Skip duplicate check if updating an already created vehicle

    const formatted = plateNumber.trim().toUpperCase();
    if (!formatted || formatted.length < 4) return true;

    setCheckingDuplicate(true);
    try {
      const response = await apiRequest(`/api/vehicles?search=${encodeURIComponent(formatted)}`);
      if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
        const matched = response.data.find((v: any) => v.vehicleNumber?.toUpperCase() === formatted);
        if (matched) {
          if (matched.yardStatus === 'KACHHA' || matched.yardStatus === 'PAKKA') {
            Alert.alert(
              '⚠️ Vehicle Already In Yard',
              `Vehicle ${formatted} is currently inside the yard.\n\nStatus: ${matched.yardStatus}\nEntry Date: ${new Date(matched.entryDate).toLocaleString('en-IN')}`,
              [{ text: 'Close', style: 'cancel' }]
            );
            return false;
          } else if (matched.yardStatus === 'RELEASED') {
            const releaseDate = matched.release?.releasedAt
              ? new Date(matched.release.releasedAt).toLocaleDateString('en-IN')
              : 'Previous Stay';
            return new Promise<boolean>(resolve => {
              Alert.alert(
                '🔄 Previous Vehicle Record Found',
                `This vehicle was previously in the yard and released on ${releaseDate}.\n\nDo you want to check-in this vehicle again?`,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Proceed Re-Entry', onPress: () => resolve(true) },
                ]
              );
            });
          }
        }
      }
      return true;
    } catch (err) {
      console.warn('[CheckIn] Duplicate check error:', err);
      return true;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Step 1 Validation & Proceed
  const handleProceedToPhotos = async () => {
    const cleanedPlate = vehicleNumber.trim().toUpperCase();
    if (!cleanedPlate || cleanedPlate.length < 4) {
      Alert.alert('Validation Error', 'Please enter a valid vehicle registration plate number.');
      return;
    }

    if (!vehicleType) {
      Alert.alert('Validation Error', 'Please select a vehicle category (2W, 3W, 4W, or Commercial).');
      return;
    }

    if (!bankCategory) {
      Alert.alert('Validation Error', 'Please select a Financer / Bank category.');
      return;
    }

    if (bankCategory !== 'cash' && !selectedBankName) {
      Alert.alert('Validation Error', 'Please select a specific bank or financer group.');
      return;
    }

    const canProceed = await checkDuplicateVehicle(cleanedPlate);
    if (!canProceed) return;

    Keyboard.dismiss();

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setStep(2);
  };

  // Quick Add Bank
  const handleQuickAddBank = async () => {
    if (!quickBankName.trim()) {
      Alert.alert('Validation', 'Please enter bank or agency name.');
      return;
    }

    setSavingQuickBank(true);
    try {
      const res = await apiRequest('/api/banks', {
        method: 'POST',
        body: JSON.stringify({
          name: quickBankName.trim().toUpperCase(),
          isThirdParty: bankCategory === 'third_party',
          parentId: bankCategory === 'third_party' && selectedThirdPartyId ? selectedThirdPartyId : undefined,
          parkingRates: [
            { vehicleType: 'TW', dailyRate: 50 },
            { vehicleType: 'THREE_W', dailyRate: 80 },
            { vehicleType: 'FW', dailyRate: 100 },
            { vehicleType: 'CV', dailyRate: 200 },
          ],
        }),
      });

      if (res?.success && res.data) {
        await fetchBanks();
        setSelectedBankId(res.data.id);
        setSelectedBankName(res.data.name);
        setQuickBankName('');
        setQuickAddBankVisible(false);
        setBankPickerVisible(false);
        Alert.alert('Success', `Bank "${res.data.name}" added successfully.`);
      } else {
        throw new Error(res?.message || 'Could not add bank');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add bank');
    } finally {
      setSavingQuickBank(false);
    }
  };

  // =========================================================================
  // OPTIMISTIC BACKGROUND PHOTO UPLOAD PIPELINE (Instagram / Gmail style)
  // =========================================================================
  const uploadPhotoToCloud = async (slotType: string, localUri: string): Promise<string | null> => {
    try {
      // 1. Get Presigned URL
      const presignedRes = await apiRequest(
        `/api/uploads/presigned-url?fileType=image/jpeg&folder=vehicles&fileSize=100000`
      );
      const { uploadUrl, publicUrl } = presignedRes?.data || {};

      if (!uploadUrl || !publicUrl) {
        throw new Error('Presigned upload URL missing from server');
      }

      // 2. Direct S3 Upload if not mock
      if (!uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(localUri).then(r => r.blob());
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });

        if (!uploadRes.ok) {
          throw new Error(`S3 upload returned HTTP ${uploadRes.status}`);
        }
      }

      // 3. Mark as successfully uploaded
      setPhotos(prev =>
        prev.map(p => (p.type === slotType ? { ...p, remoteUrl: publicUrl, uploadStatus: 'uploaded' } : p))
      );

      return publicUrl;
    } catch (err) {
      console.warn(`[BackgroundUpload] Failed to upload photo (${slotType}):`, err);
      setPhotos(prev =>
        prev.map(p => (p.type === slotType ? { ...p, uploadStatus: 'error' } : p))
      );
      return null;
    }
  };

  const startBackgroundUpload = (slotType: string, localUri: string) => {
    // Set status to uploading immediately in UI
    setPhotos(prev =>
      prev.map(p => (p.type === slotType ? { ...p, uri: localUri, uploadStatus: 'uploading' } : p))
    );

    // Kick off background Promise
    const uploadPromise = uploadPhotoToCloud(slotType, localUri);
    uploadPromisesRef.current[slotType] = uploadPromise;
  };

  // Photo Capture & Gallery Picking with Instant Background Upload
  const handleCapturePhoto = async (type: string) => {
    setActivePhotoPickerSlot(null);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please enable camera permissions to capture inspection photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhotos(prev => {
          const exists = prev.some(p => p.type === type);
          if (exists) {
            return prev.map(p =>
              p.type === type ? { ...p, uri: compressed.uri, uploadStatus: 'uploading' } : p
            );
          }
          return [
            ...prev,
            { type, label: `Extra Photo ${extraSlots.length}`, uri: compressed.uri, uploadStatus: 'uploading' },
          ];
        });

        // Trigger Instant Background Upload
        startBackgroundUpload(type, compressed.uri);
      }
    } catch (err) {
      console.warn('[CheckIn] Camera capture error:', err);
      Alert.alert('Camera Error', 'Could not capture photo.');
    }
  };

  const handlePickFromGallery = async (type: string) => {
    setActivePhotoPickerSlot(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery Permission Required', 'Please enable media library access to select vehicle photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhotos(prev => {
          const exists = prev.some(p => p.type === type);
          if (exists) {
            return prev.map(p =>
              p.type === type ? { ...p, uri: compressed.uri, uploadStatus: 'uploading' } : p
            );
          }
          return [
            ...prev,
            { type, label: `Extra Photo ${extraSlots.length}`, uri: compressed.uri, uploadStatus: 'uploading' },
          ];
        });

        // Trigger Instant Background Upload
        startBackgroundUpload(type, compressed.uri);
      }
    } catch (err) {
      console.warn('[CheckIn] Gallery pick error:', err);
      Alert.alert('Gallery Error', 'Could not pick image.');
    }
  };

  const handleRemovePhoto = (type: string) => {
    delete uploadPromisesRef.current[type];
    setPhotos(prev =>
      prev.map(p => (p.type === type ? { ...p, uri: undefined, remoteUrl: undefined, uploadStatus: 'idle' } : p))
    );
  };

  const handleRetryUpload = (slot: PhotoSlot) => {
    if (slot.uri) {
      startBackgroundUpload(slot.type, slot.uri);
    }
  };

  const handleAddExtraPhotoSlot = () => {
    const nextSlotId = `extra_${extraSlots.length + 1}`;
    setExtraSlots(prev => [...prev, nextSlotId]);
    setPhotos(prev => [
      ...prev,
      { type: nextSlotId, label: `Extra Photo ${extraSlots.length + 1}`, uploadStatus: 'idle' },
    ]);
  };

  // Step 3: Set Inventory Yes/No
  const setInventoryItemStatus = (id: string, isPresent: boolean) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setInventoryValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isPresent,
      },
    }));
  };

  // =========================================================================
  // Final Inward Submit or Update (Instant because photos are pre-uploaded!)
  // =========================================================================
  const handleSubmitInward = async () => {
    if (!overallCondition) {
      Alert.alert('Validation Error', 'Please select vehicle condition (Good / Average / Bad).');
      return;
    }

    Keyboard.dismiss();

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    setSubmitting(true);
    setSubmittingText(editingVehicleId ? 'Updating vehicle entry...' : 'Finalizing entry...');

    try {
      // 1. Check if any photo is still in the middle of uploading; wait for it seamlessly
      const pendingUploadSlots = photos.filter(p => !!p.uri && p.uploadStatus === 'uploading');
      if (pendingUploadSlots.length > 0) {
        setSubmittingText('Completing photo uploads...');
        const pendingPromises = pendingUploadSlots
          .map(p => uploadPromisesRef.current[p.type])
          .filter(Boolean);
        await Promise.all(pendingPromises);
      }

      // 2. Prepare payload
      const combinedRepoAgency = `Agency: ${repoAgency.trim()} | Agent: ${repoAgentName.trim()} | Place: ${placeOfPossession.trim()}`;

      const inventoryPayload = [
        ...masterInventory.map(item => {
          const val = inventoryValues[item.id] || { isPresent: false, remarks: '' };
          return {
            itemName: item.itemName,
            isPresent: !!val.isPresent,
            remarks: val.remarks || undefined,
          };
        }),
        { itemName: 'Body Condition', isPresent: true, remarks: overallCondition },
        { itemName: 'Yard Remarks', isPresent: true, remarks: yardRemarks },
      ];

      const payload = {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType: vehicleType || 'FW',
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        chassisNumber: chassisNumber.trim() || undefined,
        engineNumber: engineNumber.trim() || undefined,
        bankName: selectedBankName.trim() || (bankCategory === 'cash' ? 'DIRECT CASH / OTHER' : 'DIRECT BANK'),
        bankId: selectedBankId || undefined,
        loanNumber: loanNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        repoAgency: combinedRepoAgency,
        entryDate: entryDate.toISOString(),
        inventory: inventoryPayload,
      };

      if (editingVehicleId) {
        // UPDATE EXISTING VEHICLE (PUT /api/vehicles/:id)
        setSubmittingText('Saving updates...');
        const updateRes = await apiRequest(`/api/vehicles/${editingVehicleId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (updateRes?.success && updateRes.data) {
          const updatedVehicle = updateRes.data;

          // Link any newly uploaded photos
          const photosWithRemote = photos.filter(p => !!p.remoteUrl);
          if (photosWithRemote.length > 0) {
            await Promise.all(
              photosWithRemote.map(p =>
                apiRequest(`/api/vehicles/${editingVehicleId}/photos`, {
                  method: 'POST',
                  body: JSON.stringify({
                    photoType: p.type,
                    s3Url: p.remoteUrl,
                    fileSize: 100000,
                  }),
                }).catch(() => {})
              )
            );
          }

          setCreatedVehicle(updatedVehicle);
          setFormSubmitted(true);
          setStep(4);
          Alert.alert('Updated', 'Vehicle details updated successfully!');
        } else {
          throw new Error(updateRes?.message || 'Failed to update vehicle.');
        }
      } else {
        // CREATE NEW VEHICLE (POST /api/vehicles)
        setSubmittingText('Creating vehicle record...');
        const response = await apiRequest('/api/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (response?.success && response.data) {
          const newVehicle = response.data;
          const vehicleId = newVehicle.id;

          // Link pre-uploaded photos to the created vehicle record in parallel
          const photosWithRemote = photos.filter(p => !!p.remoteUrl);
          if (photosWithRemote.length > 0) {
            setSubmittingText('Linking photos...');
            await Promise.all(
              photosWithRemote.map(p =>
                apiRequest(`/api/vehicles/${vehicleId}/photos`, {
                  method: 'POST',
                  body: JSON.stringify({
                    photoType: p.type,
                    s3Url: p.remoteUrl,
                    fileSize: 100000,
                  }),
                }).catch(e => console.warn(`[CheckIn] Link photo error for ${p.type}:`, e))
              )
            );
          }

          setCreatedVehicle(newVehicle);
          setFormSubmitted(true);
          await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
          setStep(4);
        } else {
          throw new Error(response?.message || 'Failed to complete vehicle entry.');
        }
      }
    } catch (err: any) {
      console.error('[CheckIn] Submit Error:', err);
      Alert.alert('Submission Error', err.message || 'Verification or saving failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Professional Gate Pass HTML
  const generateGatePassHTML = async (): Promise<string> => {
    const formattedDate = entryDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const activeChecklist = masterInventory.filter(it => it.printEnabled !== false);
    let checklistCells = '';

    for (let i = 0; i < activeChecklist.length; i += 2) {
      const item1 = activeChecklist[i];
      const item2 = activeChecklist[i + 1];

      const renderCell = (it?: CustomInventoryItem) => {
        if (!it) return '<td style="border: 1px solid #E2E8F0; width: 50%; background-color: #FAFAFA;"></td>';
        const val = inventoryValues[it.id] || { isPresent: false, remarks: '' };
        const badge = val.isPresent
          ? '<span style="background-color: #DCFCE7; color: #166534; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px;">YES</span>'
          : '<span style="background-color: #FEE2E2; color: #991B1B; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px;">NO</span>';

        return `
          <td style="padding: 6px 10px; border: 1px solid #E2E8F0; width: 50%; font-size: 11px; color: #0F172A;">
            <strong>${it.itemName}</strong>: ${badge}
          </td>
        `;
      };

      checklistCells += `<tr>${renderCell(item1)}${renderCell(item2)}</tr>`;
    }

    const photoCards = await Promise.all(
      photos
        .filter(p => !!p.uri)
        .map(async p => {
          const b64 = await uriToBase64(p.uri!);
          return `
            <div style="width: 31.3%; margin: 1%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 4px; text-align: center; background-color: #FFFFFF; box-sizing: border-box;">
              <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.label}</div>
              <div style="width: 100%; height: 125px; display: flex; align-items: center; justify-content: center; background-color: #F8FAFC; border-radius: 4px; overflow: hidden;">
                <img src="${b64}" style="max-width: 100%; max-height: 125px; width: auto; height: auto; object-fit: contain; border-radius: 4px;" />
              </div>
            </div>
          `;
        })
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; }
            .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 8px; margin-bottom: 12px; }
            .yard-name { font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0F172A; letter-spacing: 0.5px; }
            .yard-address { font-size: 11px; color: #475569; margin-top: 2px; }
            .pass-title { display: inline-block; background-color: #0F172A; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 20px; margin-top: 6px; text-transform: uppercase; }
            .section-title { font-size: 12px; font-weight: 700; color: #0F172A; text-transform: uppercase; border-left: 3px solid #2563EB; padding-left: 6px; margin: 12px 0 6px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .info-table td { padding: 6px 8px; border: 1px solid #E2E8F0; font-size: 11px; }
            .info-table td.label { width: 22%; background-color: #F8FAFC; font-weight: 600; color: #475569; }
            .info-table td.val { width: 28%; font-weight: 600; color: #0F172A; }
            .photos-wrap { display: flex; flex-wrap: wrap; margin: 6px -1%; }
            .footer { margin-top: 20px; border-top: 1px dashed #94A3B8; padding-top: 8px; text-align: center; font-size: 10px; color: #64748B; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="yard-name">${tenantName}</div>
            <div class="yard-address">${tenantAddress}</div>
            <div class="pass-title">VEHICLE INWARD PASS (GATE PASS)</div>
          </div>

          <div class="section-title">Vehicle & Repossession Details</div>
          <table class="info-table">
            <tr>
              <td class="label">Vehicle No:</td>
              <td class="val" style="font-size: 14px; color: #1E3A8A;">${vehicleNumber.toUpperCase()}</td>
              <td class="label">Entry Date:</td>
              <td class="val">${formattedDate}</td>
            </tr>
            <tr>
              <td class="label">Vehicle Type:</td>
              <td class="val">${vehicleType || '-'}</td>
              <td class="label">Make & Model:</td>
              <td class="val">${brand || '-'} ${model || ''}</td>
            </tr>
            <tr>
              <td class="label">Financer / Bank:</td>
              <td class="val">${selectedBankName || 'DIRECT CASH'}</td>
              <td class="label">Repo Agency:</td>
              <td class="val">${repoAgency || '-'}</td>
            </tr>
            <tr>
              <td class="label">Repo Agent:</td>
              <td class="val">${repoAgentName || '-'}</td>
              <td class="label">Possession City:</td>
              <td class="val">${placeOfPossession || '-'}</td>
            </tr>
            <tr>
              <td class="label">Customer Name:</td>
              <td class="val">${customerName || '-'}</td>
              <td class="label">Customer Phone:</td>
              <td class="val">${customerPhone || '-'}</td>
            </tr>
            <tr>
              <td class="label">Chassis Number:</td>
              <td class="val">${chassisNumber || '-'}</td>
              <td class="label">Engine Number:</td>
              <td class="val">${engineNumber || '-'}</td>
            </tr>
          </table>

          <div class="section-title">Physical Inspection & Inventory Checklist</div>
          <table>${checklistCells}</table>

          <div class="section-title">Condition & Yard Observations</div>
          <table class="info-table">
            <tr>
              <td class="label">Overall Condition:</td>
              <td class="val" style="color: ${overallCondition === 'Good' ? '#166534' : overallCondition === 'Average' ? '#D97706' : '#DC2626'}; font-weight: 700;">
                ${(overallCondition || 'N/A').toUpperCase()}
              </td>
              <td class="label">Yard Remarks:</td>
              <td class="val">${yardRemarks || 'No damage noted'}</td>
            </tr>
          </table>

          ${photoCards.length > 0 ? `
            <div class="section-title">Inspection Photographs</div>
            <div class="photos-wrap">${photoCards.join('')}</div>
          ` : ''}

          <div class="footer">
            *** COMPUTER SYSTEM GENERATED DOCUMENT • NO PHYSICAL SIGNATURE REQUIRED ***
          </div>
        </body>
      </html>
    `;
  };

  // Print Gate Pass (AirPrint / System Dialog)
  const handlePrintGatePass = async () => {
    try {
      const html = await generateGatePassHTML();
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Error', err.message || 'Could not launch print service.');
    }
  };

  // Share Gate Pass as PDF
  const handleShareGatePass = async () => {
    try {
      const html = await generateGatePassHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${vehicleNumber.toUpperCase()} Inward Gate Pass`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not export or share PDF.');
    }
  };

  // Start Modifying / Editing Created Entry
  const handleStartEditCreatedEntry = () => {
    if (createdVehicle) {
      setEditingVehicleId(createdVehicle.id);
      setStep(1);
    }
  };

  // Reset for New Inward
  const handleResetForNew = () => {
    uploadPromisesRef.current = {};
    setEditingVehicleId(null);
    setStep(1);
    setVehicleNumber('');
    setVehicleType('');
    setBrand('');
    setModel('');
    setChassisNumber('');
    setEngineNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setRepoAgency('');
    setRepoAgentName('');
    setBankCategory('');
    setSelectedThirdPartyId('');
    setSelectedGroupName('');
    setSelectedBankId('');
    setSelectedBankName('');
    setPhotos(STANDARD_PHOTO_SLOTS);
    setExtraSlots([]);
    setOverallCondition('');
    setYardRemarks('');
    setCreatedVehicle(null);
    setFormSubmitted(false);
    setHasUnsavedChanges(false);
  };

  // Filtered Banks for picker modes
  const filteredBankOptions = useMemo(() => {
    let options: any[] = [];
    if (pickerMode === 'direct') {
      options = banks.filter(b => !b.isThirdParty && !b.parentId);
    } else if (pickerMode === 'third_party') {
      options = banks.filter(b => b.isThirdParty);
    } else {
      // sub-bank mode
      options = banks.filter(b => b.parentId === selectedThirdPartyId);
    }

    if (!bankSearch.trim()) return options;
    return options.filter(b => b.name?.toLowerCase().includes(bankSearch.toLowerCase()));
  }, [banks, pickerMode, selectedThirdPartyId, bankSearch]);

  const VEHICLE_CATEGORIES_LIST = [
    { key: 'TW' as VehicleType, label: '2-Wheeler (TW)', icon: Bike },
    { key: 'THREE_W' as VehicleType, label: '3-Wheeler (THREE_W)', icon: Truck },
    { key: 'FW' as VehicleType, label: '4-Wheeler (FW)', icon: Car },
    { key: 'CV' as VehicleType, label: 'Commercial Vehicle (CV)', icon: Truck },
  ];

  const BANK_CATEGORIES_LIST = [
    { key: 'direct' as BankCategory, label: 'Direct Bank', desc: 'Predefined paneled bank rates' },
    { key: 'third_party' as BankCategory, label: 'Third Party Group', desc: 'Parent financer / agency group' },
    { key: 'shift' as BankCategory, label: '🚚 Shift / Non-Paneled Bank', desc: 'Queued for yard transfer' },
    { key: 'cash' as BankCategory, label: 'Cash / Other', desc: 'Direct custody / general parking' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (step > 1 && step < 4) setStep(step - 1);
            else router.back();
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {step === 4
              ? 'Entry Completed'
              : editingVehicleId
              ? `Edit Vehicle • ${vehicleNumber || 'Modify'}`
              : 'Vehicle Inward (Check-In)'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {step === 1 ? 'Step 1 of 3: Vehicle & Specs' : step === 2 ? 'Step 2 of 3: Handover Photos' : step === 3 ? 'Step 3 of 3: Inspection Checklist' : 'Gate Pass Generated'}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Progress Wizard Bar (Steps 1-3) */}
      {step < 4 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            {[1, 2, 3].map(st => (
              <React.Fragment key={st}>
                <View
                  style={[
                    styles.progressDot,
                    step >= st && styles.progressDotActive,
                    step === st && styles.progressDotCurrent,
                  ]}
                >
                  {step > st ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.progressDotText,
                        step >= st && styles.progressDotTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  )}
                </View>
                {st < 3 && (
                  <View
                    style={[
                      styles.progressLine,
                      step > st && styles.progressLineActive,
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Body Content with Native Scroll View & Focus Auto-Scroll */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: isKeyboardVisible ? keyboardHeight + 120 : insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================================= */}
          {/* STEP 1: SIMPLIFIED, CLEAN & COMPACT SPECS FORM */}
          {/* ========================================================================= */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              {/* Edit Mode Notice Banner */}
              {editingVehicleId && (
                <View style={styles.editNoticeBanner}>
                  <Edit3 size={15} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.editNoticeText}>
                    Editing submitted vehicle record. Changes will update the database & Gate Pass.
                  </Text>
                </View>
              )}

              {/* Ultra-Compact Timestamp Header */}
              <View style={styles.compactDateBar}>
                <View style={styles.compactDateLeft}>
                  <Calendar size={13} color="#2563EB" />
                  <Text style={styles.compactDateLabel}>Inward Date & Time:</Text>
                </View>

                <View style={styles.compactDatePills}>
                  <TouchableOpacity
                    style={styles.compactDateChip}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.compactDateChipText}>
                      {entryDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.compactDateChip}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Clock size={11} color="#475569" style={{ marginRight: 3 }} />
                    <Text style={styles.compactDateChipText}>
                      {entryDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={entryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    setShowDatePicker(false);
                    if (selected) {
                      const next = new Date(entryDate);
                      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                      setEntryDate(next);
                      if (Platform.OS === 'android') {
                        setTimeout(() => setShowTimePicker(true), 200);
                      }
                    }
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={entryDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    setShowTimePicker(false);
                    if (selected) {
                      const next = new Date(entryDate);
                      next.setHours(selected.getHours(), selected.getMinutes());
                      setEntryDate(next);
                    }
                  }}
                />
              )}

              {/* CARD 1: PRIMARY VEHICLE & FINANCER IDENTIFIERS */}
              <View style={styles.cleanSectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.cardHeaderIconBg}>
                    <Car size={15} color="#2563EB" />
                  </View>
                  <Text style={styles.sectionCardTitle}>Vehicle & Financer</Text>
                </View>

                {/* Registration Number Plate Input */}
                <View style={styles.fieldBlock}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Vehicle Registration No. *</Text>
                    {searchingRapidRepo && (
                      <View style={styles.searchingPill}>
                        <ActivityIndicator size="small" color="#2563EB" style={{ transform: [{ scale: 0.7 }] }} />
                        <Text style={styles.searchingPillText}>Auto-Searching Rapid Repo...</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.plateInputContainer}>
                    <View style={styles.plateIndBadge}>
                      <Text style={styles.plateIndText}>IND</Text>
                    </View>
                    <TextInput
                      style={styles.plateInput}
                      placeholder="HR-26-BQ-8811"
                      placeholderTextColor="#94A3B8"
                      value={vehicleNumber}
                      onChangeText={handleVehicleNumberChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={16}
                    />
                    {checkingDuplicate && (
                      <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 10 }} />
                    )}
                  </View>

                  {/* Auto-filled Success Badge */}
                  {rapidRepoMatchBanner && !searchingRapidRepo && (
                    <View style={styles.autoFillSuccessBadge}>
                      <Sparkles size={13} color="#059669" strokeWidth={2.2} />
                      <Text style={styles.autoFillSuccessText} numberOfLines={1}>
                        {rapidRepoMatchBanner}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Vehicle Category Dropdown */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Vehicle Category *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setVehicleTypePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        !vehicleType && { color: '#94A3B8' },
                      ]}
                    >
                      {vehicleType === 'TW'
                        ? '🏍️ 2-Wheeler (TW)'
                        : vehicleType === 'THREE_W'
                        ? '🛺 3-Wheeler (THREE_W)'
                        : vehicleType === 'FW'
                        ? '🚗 4-Wheeler (FW)'
                        : vehicleType === 'CV'
                        ? '🚛 Commercial Vehicle (CV)'
                        : '-- Select Vehicle Category --'}
                    </Text>
                    <ChevronDown size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Bank Category Dropdown */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Financer / Bank Category *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setCategoryPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        !bankCategory && { color: '#94A3B8' },
                      ]}
                    >
                      {bankCategory === 'direct'
                        ? '🏦 Direct Bank'
                        : bankCategory === 'third_party'
                        ? '🏢 Third Party Group'
                        : bankCategory === 'shift'
                        ? '🚚 Shift / Non-Paneled Bank'
                        : bankCategory === 'cash'
                        ? '💵 Cash / Other'
                        : '-- Select Bank Category --'}
                    </Text>
                    <ChevronDown size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Specific Bank / Group Dropdown */}
                {bankCategory && bankCategory !== 'cash' && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      {bankCategory === 'third_party' ? 'Select Financer Group *' : 'Select Bank Name *'}
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => {
                        setPickerMode(bankCategory === 'third_party' ? 'third_party' : 'direct');
                        setBankSearch('');
                        setBankPickerVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dropdownTriggerText,
                          !(bankCategory === 'third_party' ? selectedGroupName : selectedBankName) && { color: '#94A3B8' },
                        ]}
                      >
                        {bankCategory === 'third_party'
                          ? selectedGroupName || '-- Choose Financer Group --'
                          : selectedBankName || '-- Choose Bank Name --'}
                      </Text>
                      <ChevronDown size={17} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Nested Sub-Bank Dropdown if Third-Party */}
                {bankCategory === 'third_party' && selectedThirdPartyId && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Select Branch / Sub-Agency *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => {
                        setPickerMode('sub');
                        setBankSearch('');
                        setBankPickerVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dropdownTriggerText,
                          !selectedBankName && { color: '#94A3B8' },
                        ]}
                      >
                        {selectedBankName || '-- Select Sub-Agency / Branch --'}
                      </Text>
                      <ChevronDown size={17} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Loan / Agreement Number */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Loan / Agreement Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. AGR12345678 or L-998822"
                    placeholderTextColor="#94A3B8"
                    value={loanNumber}
                    onChangeText={t => setLoanNumber(t.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                {/* Shift Warning Banner */}
                {bankCategory === 'shift' && (
                  <View style={styles.shiftWarningBanner}>
                    <AlertTriangle size={16} color="#D97706" style={{ marginRight: 6 }} />
                    <Text style={styles.shiftWarningText}>
                      Vehicle will be auto-flagged as &quot;Shift Pending&quot; for yard transfer.
                    </Text>
                  </View>
                )}
              </View>

              {/* CARD 2: CUSTOMER, SPECS & REPO DETAILS */}
              <View style={styles.cleanSectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={styles.cardHeaderIconBg}>
                    <User size={15} color="#2563EB" />
                  </View>
                  <Text style={styles.sectionCardTitle}>Customer, Specs & Repo Details</Text>
                </View>

                {/* Customer Details Row */}
                <View style={styles.twoColumnRow}>
                  <View style={[styles.fieldBlock, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>Customer Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Full name"
                      placeholderTextColor="#94A3B8"
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>

                  <View style={[styles.fieldBlock, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Customer Phone</Text>
                    <View style={styles.phoneInputRow}>
                      <TextInput
                        style={[styles.textInput, { flex: 1 }]}
                        placeholder="Mobile No."
                        placeholderTextColor="#94A3B8"
                        value={customerPhone}
                        onChangeText={t => setCustomerPhone(t.replace(/[^0-9]/g, ''))}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                      {customerPhone.length > 0 && (
                        <TouchableOpacity
                          style={styles.miniCopyBtn}
                          onPress={() => {
                            Clipboard.setString(customerPhone);
                            Alert.alert('Copied', 'Phone number copied.');
                          }}
                          activeOpacity={0.7}
                        >
                          <Copy size={13} color="#2563EB" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* Make & Model Row */}
                <View style={styles.twoColumnRow}>
                  <View style={[styles.fieldBlock, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>Brand / Make</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Maruti, Tata, etc."
                      placeholderTextColor="#94A3B8"
                      value={brand}
                      onChangeText={setBrand}
                    />
                  </View>

                  <View style={[styles.fieldBlock, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Model Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Swift, Nexon, etc."
                      placeholderTextColor="#94A3B8"
                      value={model}
                      onChangeText={setModel}
                    />
                  </View>
                </View>

                {/* Chassis & Engine Row */}
                <View style={styles.twoColumnRow}>
                  <View style={[styles.fieldBlock, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>Chassis Number</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Last digits"
                      placeholderTextColor="#94A3B8"
                      value={chassisNumber}
                      onChangeText={t => setChassisNumber(t.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={[styles.fieldBlock, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Engine Number</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Engine code"
                      placeholderTextColor="#94A3B8"
                      value={engineNumber}
                      onChangeText={t => setEngineNumber(t.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Repo Details Row */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Repo Agency Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Om Sai Associates"
                    placeholderTextColor="#94A3B8"
                    value={repoAgency}
                    onChangeText={setRepoAgency}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                  />
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={[styles.fieldBlock, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.fieldLabel}>Repo Agent Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Agent name"
                      placeholderTextColor="#94A3B8"
                      value={repoAgentName}
                      onChangeText={setRepoAgentName}
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                    />
                  </View>

                  <View style={[styles.fieldBlock, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Possession City</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="City / Area"
                      placeholderTextColor="#94A3B8"
                      value={placeOfPossession}
                      onChangeText={setPlaceOfPossession}
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: HANDOVER PHOTOS (INSTANT BACKGROUND UPLOAD) */}
          {/* ========================================================================= */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.infoBanner}>
                <CloudUpload size={18} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.infoBannerText}>
                  Photos auto-upload to cloud in the background as you shoot them for zero-delay check-in.
                </Text>
              </View>

              <View style={styles.photoGrid}>
                {photos.map(slot => {
                  const isUploading = slot.uploadStatus === 'uploading';
                  const isUploaded = slot.uploadStatus === 'uploaded';
                  const isError = slot.uploadStatus === 'error';

                  return (
                    <View key={slot.type} style={styles.photoCard}>
                      <Text style={styles.photoSlotLabel} numberOfLines={1}>
                        {slot.label}
                      </Text>

                      {slot.uri ? (
                        <View style={styles.photoPreviewContainer}>
                          <Image source={{ uri: slot.uri }} style={styles.photoImage} />

                          {/* Top Right Delete Button */}
                          <TouchableOpacity
                            style={styles.photoDeleteBtn}
                            onPress={() => handleRemovePhoto(slot.type)}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={13} color="#EF4444" strokeWidth={2.4} />
                          </TouchableOpacity>

                          {/* Bottom Background Upload Status Indicator */}
                          {isUploading && (
                            <View style={styles.uploadStatusBadge}>
                              <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 4 }} />
                              <Text style={styles.uploadStatusText}>Uploading...</Text>
                            </View>
                          )}

                          {isUploaded && (
                            <View style={[styles.uploadStatusBadge, styles.uploadStatusBadgeSuccess]}>
                              <Check size={11} color="#166534" strokeWidth={3} style={{ marginRight: 3 }} />
                              <Text style={styles.uploadStatusTextSuccess}>Ready</Text>
                            </View>
                          )}

                          {isError && (
                            <TouchableOpacity
                              style={[styles.uploadStatusBadge, styles.uploadStatusBadgeError]}
                              onPress={() => handleRetryUpload(slot)}
                              activeOpacity={0.8}
                            >
                              <RefreshCw size={11} color="#991B1B" style={{ marginRight: 3 }} />
                              <Text style={styles.uploadStatusTextError}>Retry</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.photoPlaceholder}
                          onPress={() => setActivePhotoPickerSlot(slot.type)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.cameraIconCircle}>
                            <Camera size={20} color="#2563EB" />
                          </View>
                          <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Add Extra Photo Slot */}
              <TouchableOpacity
                style={styles.addExtraPhotoBtn}
                onPress={handleAddExtraPhotoSlot}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#2563EB" />
                <Text style={styles.addExtraPhotoBtnText}>+ Add Another Photo Angle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUPER SIMPLE, VISUAL & EASY INVENTORY CHECKLIST */}
          {/* ========================================================================= */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              {/* Overall Body Condition (3 Large Visual Cards) */}
              <View style={styles.cleanSectionCard}>
                <Text style={styles.visualSectionTitle}>1. Overall Vehicle Condition *</Text>
                <Text style={styles.visualSectionSub}>Gaadi ki sthiti select karein:</Text>

                <View style={styles.simpleConditionGrid}>
                  {[
                    { key: 'Good' as const, label: 'Thik Hai (Good)', color: '#16A34A', bg: '#DCFCE7', icon: ThumbsUp },
                    { key: 'Average' as const, label: 'Sadharan (Average)', color: '#D97706', bg: '#FEF3C7', icon: MinusCircle },
                    { key: 'Bad' as const, label: 'Kharab (Damage)', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
                  ].map(cond => {
                    const isSelected = overallCondition === cond.key;
                    const IconComp = cond.icon;
                    return (
                      <TouchableOpacity
                        key={cond.key}
                        style={[
                          styles.simpleConditionCard,
                          isSelected && {
                            borderColor: cond.color,
                            backgroundColor: cond.bg,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'ios' || Platform.OS === 'android') {
                            Haptics.selectionAsync().catch(() => {});
                          }
                          setOverallCondition(cond.key);
                        }}
                        activeOpacity={0.75}
                      >
                        <IconComp
                          size={24}
                          color={isSelected ? cond.color : '#64748B'}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={[
                            styles.simpleConditionLabel,
                            isSelected && { color: cond.color, fontWeight: '800' },
                          ]}
                        >
                          {cond.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Visual 1-Tap YES/NO Checklist */}
              <View style={styles.cleanSectionCard}>
                <Text style={styles.visualSectionTitle}>2. Accessories Checklist</Text>
                <Text style={styles.visualSectionSub}>
                  Kya-kya item gaadi me available hai? YES ya NO dabayein:
                </Text>

                {loadingInventory ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
                ) : (
                  <View style={styles.simpleChecklistGrid}>
                    {masterInventory.map(item => {
                      const isYes = !!inventoryValues[item.id]?.isPresent;

                      return (
                        <View key={item.id} style={styles.simpleChecklistRow}>
                          <Text style={styles.simpleChecklistName} numberOfLines={1}>
                            {item.itemName}
                          </Text>

                          <View style={styles.simpleToggleWrap}>
                            {/* YES Button */}
                            <TouchableOpacity
                              style={[
                                styles.toggleChoiceBtn,
                                isYes && styles.toggleYesActive,
                              ]}
                              onPress={() => setInventoryItemStatus(item.id, true)}
                              activeOpacity={0.7}
                            >
                              <Check size={13} color={isYes ? '#FFFFFF' : '#166534'} strokeWidth={3} />
                              <Text style={[styles.toggleChoiceText, isYes && styles.toggleChoiceTextActive]}>
                                YES
                              </Text>
                            </TouchableOpacity>

                            {/* NO Button */}
                            <TouchableOpacity
                              style={[
                                styles.toggleChoiceBtn,
                                !isYes && styles.toggleNoActive,
                              ]}
                              onPress={() => setInventoryItemStatus(item.id, false)}
                              activeOpacity={0.7}
                            >
                              <X size={13} color={!isYes ? '#FFFFFF' : '#991B1B'} strokeWidth={3} />
                              <Text style={[styles.toggleChoiceText, !isYes && styles.toggleChoiceTextActive]}>
                                NO
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Simple Remarks Box with Auto Scroll on Focus */}
              <View style={styles.cleanSectionCard}>
                <Text style={styles.visualSectionTitle}>3. Remarks / Note (Optional)</Text>
                <TextInput
                  style={styles.simpleRemarksInput}
                  placeholder="Agar koi damage ya special note ho to yahan likhein..."
                  placeholderTextColor="#94A3B8"
                  value={yardRemarks}
                  onChangeText={setYardRemarks}
                  multiline
                  numberOfLines={3}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 150);
                  }}
                />
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS & GATE PASS ACTIONS */}
          {/* ========================================================================= */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.successCard}>
                <View style={styles.successIconCircle}>
                  <CheckCircle2 size={44} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>
                  {editingVehicleId ? 'Vehicle Record Updated!' : 'Inward Entry Successful!'}
                </Text>
                <Text style={styles.successSubtitle}>
                  {editingVehicleId
                    ? 'Changes have been saved to the database and updated Gate Pass is ready.'
                    : 'Vehicle registration has been saved to the database and gate pass is generated.'}
                </Text>

                <View style={styles.successSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Vehicle Plate:</Text>
                    <Text style={styles.summaryValue}>{vehicleNumber.toUpperCase()}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Category & Type:</Text>
                    <Text style={styles.summaryValue}>{vehicleType || '-'} • {brand || ''} {model || ''}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Financer / Bank:</Text>
                    <Text style={styles.summaryValue}>{selectedBankName || 'DIRECT CASH'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Possession City:</Text>
                    <Text style={styles.summaryValue}>{placeOfPossession || '-'}</Text>
                  </View>
                </View>
              </View>

              {/* Gate Pass Action Buttons */}
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handlePrintGatePass}
                  activeOpacity={0.8}
                >
                  <Printer size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionButtonText}>Print Gate Pass (A4)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={handleShareGatePass}
                  activeOpacity={0.8}
                >
                  <Share2 size={18} color="#0F172A" style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryActionButtonText}>Share Gate Pass PDF</Text>
                </TouchableOpacity>

                {/* Edit This Entry Button */}
                <TouchableOpacity
                  style={styles.editEntryButton}
                  onPress={handleStartEditCreatedEntry}
                  activeOpacity={0.8}
                >
                  <Edit3 size={17} color="#2563EB" style={{ marginRight: 8 }} />
                  <Text style={styles.editEntryButtonText}>✏️ Edit This Entry / Modify Details</Text>
                </TouchableOpacity>

                <View style={styles.bottomNavRow}>
                  <TouchableOpacity
                    style={styles.textLinkBtn}
                    onPress={handleResetForNew}
                    activeOpacity={0.7}
                  >
                    <Plus size={15} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={styles.textLinkBtnText}>New Inward Entry</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textLinkBtn}
                    onPress={() => router.replace('/tenant_admin/admin/vehicles' as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.textLinkBtnText}>View Vehicles List →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Persistent Bottom Step Navigation Button (Steps 1-3) - Automatically hidden when typing */}
      {step < 4 && !isKeyboardVisible && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.bottomBackBtn}
              onPress={() => {
                Keyboard.dismiss();
                setStep(step - 1);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomBackBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.bottomNextBtn,
              step === 1 && { flex: 1 },
              submitting && { opacity: 0.7 },
            ]}
            onPress={() => {
              if (step === 1) handleProceedToPhotos();
              else if (step === 2) {
                Keyboard.dismiss();
                setStep(3);
              } else if (step === 3) handleSubmitInward();
            }}
            disabled={submitting || checkingDuplicate}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.bottomNextBtnText}>{submittingText}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.bottomNextBtnText}>
                  {step === 1
                    ? 'Continue to Photos'
                    : step === 2
                    ? 'Continue to Inspection'
                    : editingVehicleId
                    ? 'Save & Update Record'
                    : 'Complete Inward Entry'}
                </Text>
                <ChevronRight size={17} color="#FFFFFF" strokeWidth={2.4} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODALS: DROPDOWN PICKERS */}
      {/* ========================================================================= */}

      {/* 1. Vehicle Type Picker Modal */}
      <Modal
        visible={vehicleTypePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVehicleTypePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVehicleTypePickerVisible(false)}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Category</Text>
              <TouchableOpacity
                onPress={() => setVehicleTypePickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {VEHICLE_CATEGORIES_LIST.map(cat => {
              const isSelected = vehicleType === cat.key;
              const IconComp = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.pickerOptionRow,
                    isSelected && styles.pickerOptionRowSelected,
                  ]}
                  onPress={() => {
                    setVehicleType(cat.key);
                    setVehicleTypePickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <IconComp size={18} color="#2563EB" style={{ marginRight: 12 }} />
                  <Text style={styles.pickerOptionText}>{cat.label}</Text>
                  {isSelected && <Check size={18} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Bank Category Picker Modal */}
      <Modal
        visible={categoryPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryPickerVisible(false)}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank Category</Text>
              <TouchableOpacity
                onPress={() => setCategoryPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {BANK_CATEGORIES_LIST.map(cat => {
              const isSelected = bankCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.pickerOptionRow,
                    isSelected && styles.pickerOptionRowSelected,
                  ]}
                  onPress={() => {
                    setBankCategory(cat.key);
                    setSelectedBankId('');
                    setSelectedBankName(cat.key === 'cash' ? 'DIRECT CASH / OTHER' : '');
                    setSelectedThirdPartyId('');
                    setSelectedGroupName('');
                    setCategoryPickerVisible(false);
                    if (cat.key !== 'cash') {
                      setTimeout(() => {
                        setPickerMode(cat.key === 'third_party' ? 'third_party' : 'direct');
                        setBankSearch('');
                        setBankPickerVisible(true);
                      }, 250);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerOptionText}>{cat.label}</Text>
                    <Text style={styles.pickerOptionSub}>{cat.desc}</Text>
                  </View>
                  {isSelected && <Check size={18} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3. Bank Picker Modal */}
      <Modal
        visible={bankPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === 'direct' ? 'Select Direct Bank' : pickerMode === 'third_party' ? 'Select Financer Group' : 'Select Sub-Agency / Branch'}
              </Text>
              <TouchableOpacity
                onPress={() => setBankPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search bank / financer..."
                placeholderTextColor="#94A3B8"
                value={bankSearch}
                onChangeText={setBankSearch}
                autoCorrect={false}
              />
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {filteredBankOptions.length === 0 ? (
                <View style={styles.emptyBankContainer}>
                  <Text style={styles.emptyBankText}>No banks found</Text>
                </View>
              ) : (
                filteredBankOptions.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[
                      styles.bankListItem,
                      selectedBankId === b.id && styles.bankListItemSelected,
                    ]}
                    onPress={() => {
                      if (pickerMode === 'third_party') {
                        setSelectedThirdPartyId(b.id);
                        setSelectedGroupName(b.name);
                        setSelectedBankId('');
                        setSelectedBankName('');
                        setPickerMode('sub');
                        setBankSearch('');
                      } else {
                        setSelectedBankId(b.id);
                        setSelectedBankName(b.name);
                        setBankPickerVisible(false);
                      }
                    }}
                  >
                    <Building size={16} color="#2563EB" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankListItemText}>{b.name}</Text>
                      {b.parkingRates && b.parkingRates.length > 0 && (
                        <Text style={styles.bankListItemRates}>
                          Rates: 2W ₹{b.parkingRates.find((r: any) => r.vehicleType === 'TW')?.dailyRate ?? '-'} · 4W ₹{b.parkingRates.find((r: any) => r.vehicleType === 'FW')?.dailyRate ?? '-'}
                        </Text>
                      )}
                    </View>
                    {((pickerMode !== 'third_party' && selectedBankId === b.id) || (pickerMode === 'third_party' && selectedThirdPartyId === b.id)) && (
                      <Check size={18} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Quick Add Bank Button */}
            <TouchableOpacity
              style={styles.quickAddBankTrigger}
              onPress={() => setQuickAddBankVisible(true)}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.quickAddBankTriggerText}>+ Add New Bank / Agency</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Quick Add Bank Modal */}
      <Modal
        visible={quickAddBankVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQuickAddBankVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Add Financer / Bank</Text>
              <TouchableOpacity
                onPress={() => setQuickAddBankVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Bank / Financer Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. HDFC Bank, Cholamandalam, etc."
                placeholderTextColor="#94A3B8"
                value={quickBankName}
                onChangeText={setQuickBankName}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryActionButton, savingQuickBank && { opacity: 0.7 }]}
              onPress={handleQuickAddBank}
              disabled={savingQuickBank}
              activeOpacity={0.8}
            >
              {savingQuickBank ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionButtonText}>Save & Select Bank</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. Photo Choice Modal */}
      <Modal
        visible={!!activePhotoPickerSlot}
        animationType="fade"
        transparent
        onRequestClose={() => setActivePhotoPickerSlot(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePhotoPickerSlot(null)}
        >
          <View style={[styles.actionSheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.actionSheetTitle}>Select Photo Source</Text>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => activePhotoPickerSlot && handleCapturePhoto(activePhotoPickerSlot)}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconBg}>
                <Camera size={20} color="#2563EB" />
              </View>
              <Text style={styles.actionSheetItemText}>Take Photo with Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => activePhotoPickerSlot && handlePickFromGallery(activePhotoPickerSlot)}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconBg}>
                <ImageIcon size={20} color="#2563EB" />
              </View>
              <Text style={styles.actionSheetItemText}>Choose from Photo Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setActivePhotoPickerSlot(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#2563EB',
  },
  progressDotCurrent: {
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  progressDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  progressDotTextActive: {
    color: '#FFFFFF',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#2563EB',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  stepContainer: {
    gap: 10,
  },
  editNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  compactDateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  compactDateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  compactDatePills: {
    flexDirection: 'row',
    gap: 6,
  },
  compactDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  compactDateChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  cleanSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  cardHeaderIconBg: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  fieldBlock: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 3,
  },
  plateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  plateIndBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 9,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateIndText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  plateInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  shiftWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  shiftWarningText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0F172A',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniCopyBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  twoColumnRow: {
    flexDirection: 'row',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 15,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCard: {
    width: (SCREEN_WIDTH - 34) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    padding: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoSlotLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    height: 95,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  uploadStatusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadStatusBadgeSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  uploadStatusBadgeError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  uploadStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
  },
  uploadStatusTextSuccess: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  uploadStatusTextError: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
  },
  photoPlaceholder: {
    height: 95,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  photoPlaceholderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  addExtraPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 9,
  },
  addExtraPhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  visualSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  visualSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  simpleConditionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  simpleConditionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simpleConditionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  simpleChecklistGrid: {
    gap: 6,
  },
  simpleChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  simpleChecklistName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 10,
  },
  simpleToggleWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleYesActive: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  toggleNoActive: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  toggleChoiceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  toggleChoiceTextActive: {
    color: '#FFFFFF',
  },
  simpleRemarksInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  successSubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 15,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  actionButtonGroup: {
    gap: 8,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 11,
  },
  primaryActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 11,
  },
  secondaryActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  editEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 11,
  },
  editEntryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  bottomNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  textLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  textLinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomBackBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  bottomNextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 7,
    paddingVertical: 9,
  },
  bottomNextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionRowSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pickerOptionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  emptyBankContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyBankText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  bankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bankListItemSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  bankListItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  bankListItemRates: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  quickAddBankTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 7,
    paddingVertical: 9,
    marginTop: 10,
  },
  quickAddBankTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 18,
    gap: 9,
  },
  actionSheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionSheetIconBg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  actionSheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 9,
  },
  actionSheetCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  searchingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  searchingPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  autoFillSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    gap: 6,
  },
  autoFillSuccessText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
});
