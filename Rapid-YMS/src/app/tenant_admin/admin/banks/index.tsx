import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Landmark,
  Building2,
  ChevronRight,
  ArrowRightLeft,
  Building,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { apiRequest, getUserInfo } from '@/services/api';
import { Bank, VEHICLE_TYPES, VehiclePhaseRatesMap } from './types';
import BanksHeader from './header';
import BanksBottomBar from './bottomBar';
import AddBankModal, { AddBankType } from './components/AddBankModal';
import AddThirdPartyMainModal from './components/AddThirdPartyMainModal';
import EditBankModal from './components/EditBankModal';
import AddSubBankModal from './components/AddSubBankModal';
import BankOptionsModal from './components/BankOptionsModal';
import BankDetailsView from './components/BankDetailsView';
import SuccessToast from './components/SuccessToast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BankCategory = 'DIRECT' | 'THIRD_PARTY' | 'SHIFT' | null;

export default function BankManagementScreen() {
  const router = useRouter();
  const menuScrollRef = useRef<ScrollView>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const subListScrollRef = useRef<ScrollView>(null);
  const detailScrollRef = useRef<ScrollView>(null);

  // User state
  const [userRole, setUserRole] = useState<string>('');
  const [canManage, setCanManage] = useState<boolean>(true);

  // Banks data state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Navigation & Category state (4 Levels: 0 = Menu, 1 = Category List, 2 = Direct Detail / 3rd Party Sub-Banks, 3 = 3rd Party Sub-Bank Detail)
  const [selectedCategory, setSelectedCategory] = useState<BankCategory>(null);
  const [selectedThirdPartyGroup, setSelectedThirdPartyGroup] = useState<Bank | null>(null);
  const [selectedBankDetail, setSelectedBankDetail] = useState<Bank | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Modal states
  const [optionsModalVisible, setOptionsModalVisible] = useState<boolean>(false);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [addModalInitialType, setAddModalInitialType] = useState<AddBankType>('direct');
  const [addThirdPartyModalVisible, setAddThirdPartyModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedBankToEdit, setSelectedBankToEdit] = useState<Bank | null>(null);

  const [addSubModalVisible, setAddSubModalVisible] = useState<boolean>(false);
  const [targetThirdPartyGroup, setTargetThirdPartyGroup] = useState<Bank | null>(null);

  // Success Toast state
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastTitle, setToastTitle] = useState<string>('Success');
  const [toastMessage, setToastMessage] = useState<string>('');

  const showSuccessToast = (title: string, message: string) => {
    setToastTitle(title);
    setToastMessage(message);
    setToastVisible(true);
  };

  // Load Banks from API
  const loadBanks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiRequest('/api/banks');
      if (res && res.success && Array.isArray(res.data)) {
        setBanks(res.data);
      } else if (Array.isArray(res)) {
        setBanks(res);
      }
    } catch (err: any) {
      console.error('[Load Banks Error]', err);
      Alert.alert('Error', err.message || 'Failed to load banks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const info = await getUserInfo();
        const role = info?.role || '';
        setUserRole(role);
        setCanManage(
          role === 'SUPER_ADMIN' ||
          role === 'MANAGER' ||
          role === 'ADMIN' ||
          (role as string) === 'TENANT_ADMIN'
        );
      } catch (err) {
        console.warn('[User info error]', err);
      }
      loadBanks();
    };
    init();
  }, [loadBanks]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBanks(true);
  };

  // Split banks into categories
  const {
    directBanks,
    thirdPartyGroups,
    shiftBanks,
    subBankMap,
    totalSubBanksCount,
  } = useMemo(() => {
    const direct: Bank[] = [];
    const thirdParty: Bank[] = [];
    const shift: Bank[] = [];
    const subMap: Record<string, Bank[]> = {};
    let subCount = 0;

    banks.forEach(b => {
      if (b.parentId) {
        if (!subMap[b.parentId]) subMap[b.parentId] = [];
        subMap[b.parentId].push(b);
        subCount++;
      } else if (b.isThirdParty || b.bankCategory === 'THIRD_PARTY_BANK') {
        thirdParty.push(b);
      } else if (b.isShiftBank || b.bankCategory === 'SHIFT_BANK') {
        shift.push(b);
      } else {
        direct.push(b);
      }
    });

    return {
      directBanks: direct,
      thirdPartyGroups: thirdParty,
      shiftBanks: shift,
      subBankMap: subMap,
      totalSubBanksCount: subCount,
    };
  }, [banks]);

  // Search filtering
  const query = searchQuery.trim().toLowerCase();

  const filteredDirectBanks = useMemo(() => {
    if (!query) return directBanks;
    return directBanks.filter(
      b =>
        b.name.toLowerCase().includes(query) ||
        (b.branchAddress && b.branchAddress.toLowerCase().includes(query)) ||
        (b.customerCarePhone && b.customerCarePhone.includes(query))
    );
  }, [directBanks, query]);

  const filteredShiftBanks = useMemo(() => {
    if (!query) return shiftBanks;
    return shiftBanks.filter(
      b =>
        b.name.toLowerCase().includes(query) ||
        (b.branchAddress && b.branchAddress.toLowerCase().includes(query)) ||
        (b.customerCarePhone && b.customerCarePhone.includes(query))
    );
  }, [shiftBanks, query]);

  const filteredThirdPartyGroups = useMemo(() => {
    if (!query) return thirdPartyGroups;
    return thirdPartyGroups.filter(g => {
      const groupMatch =
        g.name.toLowerCase().includes(query) ||
        (g.branchAddress && g.branchAddress.toLowerCase().includes(query));
      const subs = subBankMap[g.id] || [];
      const subMatch = subs.some(
        s =>
          s.name.toLowerCase().includes(query) ||
          (s.branchAddress && s.branchAddress.toLowerCase().includes(query))
      );
      return groupMatch || subMatch;
    });
  }, [thirdPartyGroups, subBankMap, query]);

  // Sub-banks under selected 3rd party group
  const liveSelectedThirdParty = useMemo(() => {
    if (!selectedThirdPartyGroup) return null;
    return banks.find(b => b.id === selectedThirdPartyGroup.id) || selectedThirdPartyGroup;
  }, [banks, selectedThirdPartyGroup]);

  const subBanksOfSelectedGroup = useMemo(() => {
    if (!liveSelectedThirdParty) return [];
    const subs = subBankMap[liveSelectedThirdParty.id] || [];
    if (!query) return subs;
    return subs.filter(
      s =>
        s.name.toLowerCase().includes(query) ||
        (s.branchAddress && s.branchAddress.toLowerCase().includes(query)) ||
        (s.customerCarePhone && s.customerCarePhone.includes(query))
    );
  }, [liveSelectedThirdParty, subBankMap, query]);

  // Live selected bank for details screen
  const liveSelectedBank = useMemo(() => {
    if (!selectedBankDetail) return null;
    return banks.find(b => b.id === selectedBankDetail.id) || selectedBankDetail;
  }, [banks, selectedBankDetail]);

  // Navigation Slide handlers
  const handleSelectCategory = (cat: BankCategory) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedCategory(cat);
    setSelectedThirdPartyGroup(null);
    setSelectedBankDetail(null);
    listScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectThirdPartyGroup = (group: Bank) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedThirdPartyGroup(group);
    setSelectedBankDetail(null);
    subListScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(slideAnim, {
      toValue: 2,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectDirectOrShiftBank = (bank: Bank) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedBankDetail(bank);
    detailScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(slideAnim, {
      toValue: 2,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectSubBankDetail = (subBank: Bank) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedBankDetail(subBank);
    detailScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(slideAnim, {
      toValue: 3,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handleBackToSubBankList = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.spring(slideAnim, {
      toValue: 2,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start(() => {
      setSelectedBankDetail(null);
    });
  };

  const handleBackToThirdPartyList = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start(() => {
      setSelectedThirdPartyGroup(null);
      setSelectedBankDetail(null);
    });
  };

  const handleBackToBankList = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start(() => {
      setSelectedBankDetail(null);
    });
  };

  const handleBackToMenu = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCategory(null);
      setSelectedThirdPartyGroup(null);
      setSelectedBankDetail(null);
      setSearchQuery('');
      setIsSearching(false);
    });
  };

  const handleHeaderBack = () => {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    } else if (selectedCategory === 'THIRD_PARTY' && selectedThirdPartyGroup && selectedBankDetail) {
      handleBackToSubBankList();
    } else if (selectedCategory === 'THIRD_PARTY' && selectedThirdPartyGroup && !selectedBankDetail) {
      handleBackToThirdPartyList();
    } else if (selectedBankDetail) {
      handleBackToBankList();
    } else if (selectedCategory) {
      handleBackToMenu();
    } else {
      router.back();
    }
  };

  const getHeaderTitle = () => {
    if (selectedBankDetail) return selectedBankDetail.name;
    if (selectedThirdPartyGroup) return selectedThirdPartyGroup.name;
    if (selectedCategory === 'DIRECT') return 'Direct Pannel Bank';
    if (selectedCategory === 'THIRD_PARTY') return '3rd Party Pannel bank';
    if (selectedCategory === 'SHIFT') return 'Shift (Not Panneled)';
    return 'Bank Management';
  };

  // Dynamic Bottom Bar Add Button logic
  const getBottomAddConfig = () => {
    if (selectedCategory === 'THIRD_PARTY' && selectedThirdPartyGroup && !selectedBankDetail) {
      return {
        label: 'Add Sub-Bank',
        onPress: () => handleOpenAddSubBank(selectedThirdPartyGroup),
      };
    }
    if (selectedCategory === 'THIRD_PARTY' && !selectedThirdPartyGroup) {
      return {
        label: 'Add 3rd Party Main Bank',
        onPress: () => setAddThirdPartyModalVisible(true),
      };
    }
    if (selectedCategory === 'SHIFT') {
      return {
        label: 'Add Shift Bank',
        onPress: () => {
          setAddModalInitialType('shift');
          setAddModalVisible(true);
        },
      };
    }
    return {
      label: 'Add Bank',
      onPress: () => {
        setAddModalInitialType('direct');
        setAddModalVisible(true);
      },
    };
  };

  const bottomAddConfig = getBottomAddConfig();

  // Save new bank / 3rd party
  const handleSaveNewBank = async (payload: any) => {
    const res = await apiRequest('/api/banks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.success !== false) {
      loadBanks(true);
      const isThirdParty = payload.isThirdParty || payload.bankCategory === 'THIRD_PARTY_BANK';
      showSuccessToast(
        isThirdParty ? '3rd Party Added' : 'Bank Added',
        `"${payload.name}" has been registered successfully.`
      );
    }
  };

  // Save edited bank
  const handleOpenEditModal = (bank: Bank) => {
    setSelectedBankToEdit(bank);
    setEditModalVisible(true);
  };

  const handleSaveEditedBank = async (
    bankId: string,
    detailsPayload: any,
    phaseRates: VehiclePhaseRatesMap
  ) => {
    await apiRequest(`/api/banks/${bankId}`, {
      method: 'PUT',
      body: JSON.stringify(detailsPayload),
    });

    const promises = VEHICLE_TYPES.map(type => {
      const r = phaseRates[type];
      return apiRequest('/api/rates', {
        method: 'POST',
        body: JSON.stringify({
          bankId: bankId,
          vehicleType: type,
          dailyRate: Number(r.pakka || r.kachha || 0),
          kachhaRate: Number(r.kachha || 0),
          pakkaRate: Number(r.pakka || 0),
          releaseOrderRate: Number(r.releaseOrder || 0),
        }),
      });
    });

    await Promise.all(promises);
    loadBanks(true);
    showSuccessToast('Bank Updated', 'Bank details & rates saved successfully.');
  };

  // Add Sub-Bank
  const handleOpenAddSubBank = (group: Bank) => {
    setTargetThirdPartyGroup(group);
    setAddSubModalVisible(true);
  };

  const handleSaveNewSubBank = async (parentId: string, subBankPayload: any) => {
    const res = await apiRequest('/api/banks', {
      method: 'POST',
      body: JSON.stringify(subBankPayload),
    });

    if (res && res.success !== false) {
      loadBanks(true);
      showSuccessToast(
        'Sub-Bank Added',
        `"${subBankPayload.name}" connected under ${targetThirdPartyGroup?.name || 'network'}.`
      );
    }
  };

  // Delete Bank
  const handleDeleteBank = (bank: Bank) => {
    if (!canManage) {
      Alert.alert('Permission Denied', 'Only authorized admins can delete banks.');
      return;
    }

    Alert.alert(
      'Delete Bank',
      `Are you sure you want to delete "${bank.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/banks/${bank.id}`, { method: 'DELETE' });
              loadBanks(true);
              if (selectedBankDetail?.id === bank.id) {
                if (selectedCategory === 'THIRD_PARTY') {
                  handleBackToSubBankList();
                } else {
                  handleBackToBankList();
                }
              } else if (selectedThirdPartyGroup?.id === bank.id) {
                handleBackToThirdPartyList();
              }
              showSuccessToast('Bank Removed', `"${bank.name}" removed from directory.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete bank.');
            }
          },
        },
      ]
    );
  };

  const handleSearchTrigger = () => {
    setIsSearching(true);
  };

  const slideTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, -SCREEN_WIDTH, -SCREEN_WIDTH * 2, -SCREEN_WIDTH * 3],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Dynamic Header */}
      <BanksHeader
        title={getHeaderTitle()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onBackPress={handleHeaderBack}
        onMenuPress={() => setOptionsModalVisible(true)}
        isSearching={isSearching}
        onToggleSearch={setIsSearching}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0062FF" />
          <Text style={styles.loadingText}>Loading bank directory...</Text>
        </View>
      ) : (
        /* 4-Tier Horizontal Sliding Container */
        <Animated.View
          style={[
            styles.sliderContainer,
            {
              transform: [{ translateX: slideTranslateX }],
            },
          ]}
        >
          {/* LEVEL 1 (Index 0): 3 Main Category Selection Cards */}
          <View style={styles.screenPage}>
            <ScrollView
              ref={menuScrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.menuScrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#0062FF"
                />
              }
            >
              {/* 1. Direct Pannel Bank Option */}
              <TouchableOpacity
                style={styles.categoryCard}
                onPress={() => handleSelectCategory('DIRECT')}
                activeOpacity={0.75}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                  <Building2 size={22} color="#0062FF" strokeWidth={2.2} />
                </View>
                <Text style={styles.categoryTitle}>Direct Pannel Bank</Text>
                <View style={[styles.categoryBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.categoryBadgeText, { color: '#0062FF' }]}>
                    {directBanks.length} Banks
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 2. 3rd Party Pannel bank Option */}
              <TouchableOpacity
                style={styles.categoryCard}
                onPress={() => handleSelectCategory('THIRD_PARTY')}
                activeOpacity={0.75}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
                  <Landmark size={22} color="#D97706" strokeWidth={2.2} />
                </View>
                <Text style={styles.categoryTitle}>3rd Party Pannel bank</Text>
                <View style={[styles.categoryBadge, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={[styles.categoryBadgeText, { color: '#D97706' }]}>
                    {thirdPartyGroups.length} Networks
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 3. Shift (Not Panneled) Option */}
              <TouchableOpacity
                style={styles.categoryCard}
                onPress={() => handleSelectCategory('SHIFT')}
                activeOpacity={0.75}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
                  <ArrowRightLeft size={22} color="#16A34A" strokeWidth={2.2} />
                </View>
                <Text style={styles.categoryTitle}>Shift (Not Panneled)</Text>
                <View style={[styles.categoryBadge, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.categoryBadgeText, { color: '#16A34A' }]}>
                    {shiftBanks.length} Banks
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
              </TouchableOpacity>

              <View style={{ height: 120 }} />
            </ScrollView>
          </View>

          {/* LEVEL 2 (Index 1): Category Clean List (Direct Banks / 3rd Party Networks / Shift Banks) */}
          <View style={styles.screenPage}>
            <ScrollView
              ref={listScrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.listScrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#0062FF"
                />
              }
            >
              {/* Direct Banks Names List */}
              {selectedCategory === 'DIRECT' && (
                <View>
                  {filteredDirectBanks.map((bank) => (
                    <TouchableOpacity
                      key={bank.id}
                      style={styles.bankNameCard}
                      onPress={() => handleSelectDirectOrShiftBank(bank)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.bankNameIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Building2 size={20} color="#0062FF" strokeWidth={2.2} />
                      </View>
                      <View style={styles.bankNameInfo}>
                        <Text style={styles.bankNameText} numberOfLines={1}>
                          {bank.name}
                        </Text>
                        <Text style={styles.bankBranchText} numberOfLines={1}>
                          {bank.branchAddress || 'Main / Regional Hub'}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
                    </TouchableOpacity>
                  ))}

                  {filteredDirectBanks.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.emptyIconWrap}>
                        <Building2 size={36} color="#94A3B8" strokeWidth={1.8} />
                      </View>
                      <Text style={styles.emptyTitle}>No Direct Banks Found</Text>
                      <Text style={styles.emptySubtitle}>
                        {searchQuery
                          ? `No bank matching "${searchQuery}"`
                          : 'No direct panel banks found. Tap the + button to add one.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 3rd Party Main Networks Clean List */}
              {selectedCategory === 'THIRD_PARTY' && (
                <View>
                  {filteredThirdPartyGroups.map((group) => {
                    const subs = subBankMap[group.id] || [];
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={styles.bankNameCard}
                        onPress={() => handleSelectThirdPartyGroup(group)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.bankNameIconWrap, { backgroundColor: '#FFFBEB' }]}>
                          <Landmark size={20} color="#D97706" strokeWidth={2.2} />
                        </View>
                        <View style={styles.bankNameInfo}>
                          <Text style={styles.bankNameText} numberOfLines={1}>
                            {group.name}
                          </Text>
                          <Text style={styles.bankBranchText} numberOfLines={1}>
                            {subs.length > 0 ? `${subs.length} Connected Banks` : group.branchAddress || 'Agency Network'}
                          </Text>
                        </View>
                        <View style={styles.countBadgeMini}>
                          <Text style={styles.countBadgeMiniText}>{subs.length}</Text>
                        </View>
                        <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
                      </TouchableOpacity>
                    );
                  })}

                  {filteredThirdPartyGroups.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.emptyIconWrap}>
                        <Landmark size={36} color="#94A3B8" strokeWidth={1.8} />
                      </View>
                      <Text style={styles.emptyTitle}>No 3rd Party Networks Found</Text>
                      <Text style={styles.emptySubtitle}>
                        {searchQuery
                          ? `No network matching "${searchQuery}"`
                          : 'No 3rd party networks found. Tap "Add 3rd Party Main Bank" to add one.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Shift Banks Names Clean List */}
              {selectedCategory === 'SHIFT' && (
                <View>
                  {filteredShiftBanks.map((bank) => (
                    <TouchableOpacity
                      key={bank.id}
                      style={styles.bankNameCard}
                      onPress={() => handleSelectDirectOrShiftBank(bank)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.bankNameIconWrap, { backgroundColor: '#F0FDF4' }]}>
                        <ArrowRightLeft size={20} color="#16A34A" strokeWidth={2.2} />
                      </View>
                      <View style={styles.bankNameInfo}>
                        <Text style={styles.bankNameText} numberOfLines={1}>
                          {bank.name}
                        </Text>
                        <Text style={styles.bankBranchText} numberOfLines={1}>
                          {bank.branchAddress || 'Shift Account / Non-Panneled'}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
                    </TouchableOpacity>
                  ))}

                  {filteredShiftBanks.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.emptyIconWrap}>
                        <ArrowRightLeft size={36} color="#94A3B8" strokeWidth={1.8} />
                      </View>
                      <Text style={styles.emptyTitle}>No Shift Banks Found</Text>
                      <Text style={styles.emptySubtitle}>
                        {searchQuery
                          ? `No shift bank matching "${searchQuery}"`
                          : 'No non-panneled shift banks found. Tap the + button to add one.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>
          </View>

          {/* LEVEL 3 (Index 2): 
              - If 3rd Party: Sub-Banks Clean List under Selected 3rd Party (e.g. Mahindra Yard)
              - If Direct / Shift: Complete Bank Details Screen */}
          <View style={styles.screenPage}>
            {selectedCategory === 'THIRD_PARTY' ? (
              <ScrollView
                ref={subListScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.listScrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#0062FF"
                  />
                }
              >
                {liveSelectedThirdParty && (
                  <View>
                    {subBanksOfSelectedGroup.map((subBank) => (
                      <TouchableOpacity
                        key={subBank.id}
                        style={styles.bankNameCard}
                        onPress={() => handleSelectSubBankDetail(subBank)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.bankNameIconWrap, { backgroundColor: '#EFF6FF' }]}>
                          <Building2 size={20} color="#0062FF" strokeWidth={2.2} />
                        </View>
                        <View style={styles.bankNameInfo}>
                          <Text style={styles.bankNameText} numberOfLines={1}>
                            {subBank.name}
                          </Text>
                          <Text style={styles.bankBranchText} numberOfLines={1}>
                            {subBank.branchAddress || 'Main / Regional Branch'}
                          </Text>
                        </View>
                        <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
                      </TouchableOpacity>
                    ))}

                    {subBanksOfSelectedGroup.length === 0 && (
                      <View style={styles.emptyStateContainer}>
                        <View style={styles.emptyIconWrap}>
                          <Building size={36} color="#94A3B8" strokeWidth={1.8} />
                        </View>
                        <Text style={styles.emptyTitle}>No Banks Connected</Text>
                        <Text style={styles.emptySubtitle}>
                          {searchQuery
                            ? `No bank matching "${searchQuery}"`
                            : `No banks registered under ${liveSelectedThirdParty.name} yet. Tap "Add Sub-Bank" to connect one.`}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={{ height: 120 }} />
              </ScrollView>
            ) : (
              <ScrollView
                ref={detailScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#0062FF"
                  />
                }
              >
                {liveSelectedBank && (
                  <BankDetailsView
                    bank={liveSelectedBank}
                    subBanks={subBankMap[liveSelectedBank.id] || []}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteBank}
                    onAddSubBank={handleOpenAddSubBank}
                    canManage={canManage}
                  />
                )}

                <View style={{ height: 120 }} />
              </ScrollView>
            )}
          </View>

          {/* LEVEL 4 (Index 3): Sub-Bank Details Screen for 3rd Party Networks */}
          <View style={styles.screenPage}>
            <ScrollView
              ref={detailScrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#0062FF"
                />
              }
            >
              {liveSelectedBank && (
                <BankDetailsView
                  bank={liveSelectedBank}
                  subBanks={subBankMap[liveSelectedBank.id] || []}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteBank}
                  onAddSubBank={handleOpenAddSubBank}
                  canManage={canManage}
                />
              )}

              <View style={{ height: 120 }} />
            </ScrollView>
          </View>
        </Animated.View>
      )}

      {/* Modern Bottom Navigation / Action Bar */}
      <BanksBottomBar
        mode={selectedCategory === null ? 'navbar' : 'action'}
        onAddPress={bottomAddConfig.onPress}
        onSearchPress={handleSearchTrigger}
        canAdd={canManage}
        addLabel={bottomAddConfig.label}
      />

      {/* Add Bank Modal (for Direct / Shift) */}
      <AddBankModal
        visible={addModalVisible}
        initialBankType={addModalInitialType}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSaveNewBank}
      />

      {/* Add 3rd Party Main Bank Modal (Clean - No Sub-banks) */}
      <AddThirdPartyMainModal
        visible={addThirdPartyModalVisible}
        onClose={() => setAddThirdPartyModalVisible(false)}
        onSave={handleSaveNewBank}
      />

      {/* Edit Bank Modal */}
      <EditBankModal
        visible={editModalVisible}
        bank={selectedBankToEdit}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedBankToEdit(null);
        }}
        onSave={handleSaveEditedBank}
      />

      {/* Add Sub-Bank Modal */}
      <AddSubBankModal
        visible={addSubModalVisible}
        parentGroup={targetThirdPartyGroup}
        onClose={() => {
          setAddSubModalVisible(false);
          setTargetThirdPartyGroup(null);
        }}
        onSave={handleSaveNewSubBank}
      />

      {/* 3-Dot Options Action Modal */}
      <BankOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        onAddBankPress={() => {
          setAddModalInitialType('direct');
          setAddModalVisible(true);
        }}
        onRefreshPress={handleRefresh}
        canManage={canManage}
      />

      {/* Modern Animated Success Feedback Toast */}
      <SuccessToast
        visible={toastVisible}
        title={toastTitle}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_WIDTH * 4,
  },
  screenPage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  detailScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
  },
  sectionHeaderWrap: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  sectionSubHeading: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Level 2 List Styles
  categoryListHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  categoryListSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  addCategoryTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  addCategoryTopIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryTopTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#D97706',
  },
  addCategoryTopSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 1,
  },
  bankNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  bankNameIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameInfo: {
    flex: 1,
  },
  bankNameText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  bankBranchText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  countBadgeMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
  },
  countBadgeMiniText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },

  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
