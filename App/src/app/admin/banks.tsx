import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest, getUserInfo } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ChevronLeft,
  Building,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  Trash2,
  Settings,
  Mail,
  Phone,
} from 'lucide-react-native';

const VEHICLE_TYPES = ['TW', 'THREE_W', 'FW', 'CV'] as const;
const TYPE_LABELS: Record<string, string> = {
  TW: '2-Wheeler',
  THREE_W: '3-Wheeler',
  FW: '4-Wheeler',
  CV: 'Commercial',
};

interface Bank {
  id: string;
  name: string;
  isThirdParty: boolean;
  parentId: string | null;
  parkingEnabled?: boolean;
  kachhaParkingRate?: number;
  pakkaParkingRate?: number;
  releaseOrderParkingRate?: number;
  parkingPayer?: 'CUSTOMER' | 'BANK';
  parkingWaiverDays?: number;
  branchAddress?: string | null;
  customerCareEmail?: string | null;
  customerCarePhone?: string | null;
  parkingRates: { vehicleType: string; dailyRate: number; kachhaRate?: number; pakkaRate?: number; releaseOrderRate?: number }[];
  parent?: { id: string; name: string };
}

export interface PhaseRates {
  kachha: string;
  pakka: string;
  releaseOrder: string;
}

export type VehiclePhaseRatesMap = Record<'TW' | 'THREE_W' | 'FW' | 'CV', PhaseRates>;

export default function BanksScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 3-Phase Bank Parking Config States
  const [waiverDays, setWaiverDays] = useState('2');
  const [parkingPayer, setParkingPayer] = useState<'CUSTOMER' | 'BANK'>('CUSTOMER');

  // Per-Vehicle Type (2W, 3W, 4W, CV) 3-Phase Rates State
  const [vehiclePhaseRates, setVehiclePhaseRates] = useState<VehiclePhaseRatesMap>({
    TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
    THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
    FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
    CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
  });

  // Add bank modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addType, setAddType] = useState<'direct' | 'third_party' | 'shift'>('direct');
  const [newBankName, setNewBankName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [customerCareEmail, setCustomerCareEmail] = useState('');
  const [customerCarePhone, setCustomerCarePhone] = useState('');
  const [subBanks, setSubBanks] = useState([{ name: '', branchAddress: '', customerCareEmail: '', customerCarePhone: '', rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' } }]);
  const [newSubRates, setNewSubRates] = useState({ TW: '50', THREE_W: '100', FW: '150', CV: '400' });
  const [saving, setSaving] = useState(false);

  // Edit rates & details modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBranchAddress, setEditBranchAddress] = useState('');
  const [editCustomerCareEmail, setEditCustomerCareEmail] = useState('');
  const [editCustomerCarePhone, setEditCustomerCarePhone] = useState('');
  const [savingRates, setSavingRates] = useState(false);

  // Add sub-bank modal state
  const [addSubModalVisible, setAddSubModalVisible] = useState(false);
  const [targetThirdParty, setTargetThirdParty] = useState<Bank | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubAddress, setNewSubAddress] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubPhone, setNewSubPhone] = useState('');
  const [savingNewSub, setSavingNewSub] = useState(false);



  const loadBanks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiRequest('/api/banks');
      if (res.success && res.data) {
        setBanks(res.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load banks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const info = await getUserInfo();
      setUserRole(info?.role || '');
      loadBanks();
    };
    init();
  }, []);

  const isAdmin = userRole === 'TENANT_ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER';

  const handleRefresh = () => {
    setRefreshing(true);
    loadBanks(true);
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteBank = (bank: Bank) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can delete banks.');
      return;
    }
    Alert.alert(
      'Delete Bank',
      `Are you sure you want to delete "${bank.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/banks/${bank.id}`, { method: 'DELETE' });
              loadBanks(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete bank');
            }
          },
        },
      ]
    );
  };

  const resetAddModal = () => {
    setAddType('direct');
    setNewBankName('');
    setBranchAddress('');
    setCustomerCareEmail('');
    setCustomerCarePhone('');
    setVehiclePhaseRates({
      TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
      THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
      FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
      CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
    });
    setSubBanks([{ name: '', branchAddress: '', customerCareEmail: '', customerCarePhone: '', rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' } }]);
  };

  const handleSaveBank = async () => {
    if (!newBankName.trim()) {
      Alert.alert('Error', 'Please enter a bank name');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: newBankName.trim(),
        isThirdParty: addType === 'third_party',
        bankCategory: addType === 'shift' ? 'SHIFT_BANK' : (addType === 'third_party' ? 'THIRD_PARTY_BANK' : 'DIRECT_BANK'),
        isShiftBank: addType === 'shift',
        branchAddress: branchAddress.trim() || undefined,
        customerCareEmail: customerCareEmail.trim() || undefined,
        customerCarePhone: customerCarePhone.trim() || undefined,
        parkingWaiverDays: Number(waiverDays || 0),
        parkingPayer: parkingPayer,
      };

      if (addType === 'direct') {
        payload.rates = {
          TW: {
            kachhaRate: Number(vehiclePhaseRates.TW.kachha || 0),
            pakkaRate: Number(vehiclePhaseRates.TW.pakka || 0),
            releaseOrderRate: Number(vehiclePhaseRates.TW.releaseOrder || 0),
            dailyRate: Number(vehiclePhaseRates.TW.pakka || vehiclePhaseRates.TW.kachha || 0),
          },
          THREE_W: {
            kachhaRate: Number(vehiclePhaseRates.THREE_W.kachha || 0),
            pakkaRate: Number(vehiclePhaseRates.THREE_W.pakka || 0),
            releaseOrderRate: Number(vehiclePhaseRates.THREE_W.releaseOrder || 0),
            dailyRate: Number(vehiclePhaseRates.THREE_W.pakka || vehiclePhaseRates.THREE_W.kachha || 0),
          },
          FW: {
            kachhaRate: Number(vehiclePhaseRates.FW.kachha || 0),
            pakkaRate: Number(vehiclePhaseRates.FW.pakka || 0),
            releaseOrderRate: Number(vehiclePhaseRates.FW.releaseOrder || 0),
            dailyRate: Number(vehiclePhaseRates.FW.pakka || vehiclePhaseRates.FW.kachha || 0),
          },
          CV: {
            kachhaRate: Number(vehiclePhaseRates.CV.kachha || 0),
            pakkaRate: Number(vehiclePhaseRates.CV.pakka || 0),
            releaseOrderRate: Number(vehiclePhaseRates.CV.releaseOrder || 0),
            dailyRate: Number(vehiclePhaseRates.CV.pakka || vehiclePhaseRates.CV.kachha || 0),
          },
        };
      } else {
        // Third party with sub-banks
        payload.subBanks = subBanks
          .filter(sb => sb.name.trim())
          .map(sb => ({
            name: sb.name.trim(),
            branchAddress: sb.branchAddress?.trim() || undefined,
            customerCareEmail: sb.customerCareEmail?.trim() || undefined,
            customerCarePhone: sb.customerCarePhone?.trim() || undefined,
            rates: {
              TW: Number(sb.rates.TW),
              THREE_W: Number(sb.rates.THREE_W),
              FW: Number(sb.rates.FW),
              CV: Number(sb.rates.CV),
            },
          }));
      }

      const res = await apiRequest('/api/banks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setAddModalVisible(false);
        resetAddModal();
        loadBanks(true);
        Alert.alert('Success', `Bank "${newBankName}" created successfully!`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create bank');
    } finally {
      setSaving(false);
    }
  };

  // Edit Rates Handlers
  const handleOpenEditModal = (bank: Bank) => {
    setEditingBank(bank);
    setEditBankName(bank.name || '');
    setEditBranchAddress(bank.branchAddress || '');
    setEditCustomerCareEmail(bank.customerCareEmail || '');
    setEditCustomerCarePhone(bank.customerCarePhone || '');
    setWaiverDays(bank.parkingWaiverDays?.toString() || '2');
    setParkingPayer(bank.parkingPayer || 'CUSTOMER');

    const updatedRates: Record<'TW' | 'THREE_W' | 'FW' | 'CV', PhaseRates> = {
      TW: { kachha: '50', pakka: '100', releaseOrder: '150' },
      THREE_W: { kachha: '80', pakka: '120', releaseOrder: '180' },
      FW: { kachha: '100', pakka: '150', releaseOrder: '200' },
      CV: { kachha: '200', pakka: '300', releaseOrder: '400' },
    };

    VEHICLE_TYPES.forEach(type => {
      const match: any = bank.parkingRates?.find(r => r.vehicleType === type);
      if (match) {
        updatedRates[type] = {
          kachha: String(match.kachhaRate || match.dailyRate || 100),
          pakka: String(match.pakkaRate || match.dailyRate || 150),
          releaseOrder: String(match.releaseOrderRate || match.dailyRate || 200),
        };
      }
    });

    setVehiclePhaseRates(updatedRates);
    setEditModalVisible(true);
  };

  const handleSaveEditedRates = async () => {
    if (!editingBank) return;

    setSavingRates(true);
    try {
      // 1. Update Bank details, waiver days, and parking payer
      await apiRequest(`/api/banks/${editingBank.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editBankName.trim() || editingBank.name,
          branchAddress: editBranchAddress.trim() || null,
          customerCareEmail: editCustomerCareEmail.trim() || null,
          customerCarePhone: editCustomerCarePhone.trim() || null,
          parkingWaiverDays: Number(waiverDays || 0),
          parkingPayer: parkingPayer,
        }),
      });

      // 2. Save 3-phase rates per vehicle category
      const promises = VEHICLE_TYPES.map(type => {
        const r = vehiclePhaseRates[type];
        return apiRequest('/api/rates', {
          method: 'POST',
          body: JSON.stringify({
            bankId: editingBank.id,
            vehicleType: type,
            dailyRate: Number(r.pakka || r.kachha || 0),
            kachhaRate: Number(r.kachha || 0),
            pakkaRate: Number(r.pakka || 0),
            releaseOrderRate: Number(r.releaseOrder || 0),
          }),
        });
      });

      await Promise.all(promises);
      setEditModalVisible(false);
      loadBanks(true);
      Alert.alert('Success', `Bank "${editBankName.trim() || editingBank.name}" details updated.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update bank');
    } finally {
      setSavingRates(false);
    }
  };

  // Add Sub-Bank to Network Handlers
  const handleOpenAddSubModal = (thirdParty: Bank) => {
    setTargetThirdParty(thirdParty);
    setNewSubName('');
    setNewSubAddress('');
    setNewSubEmail('');
    setNewSubPhone('');
    setNewSubRates({ TW: '50', THREE_W: '100', FW: '150', CV: '400' });
    setAddSubModalVisible(true);
  };

  const handleAddSubBankToNetwork = async () => {
    if (!targetThirdParty) return;
    if (!newSubName.trim()) {
      Alert.alert('Error', 'Please enter a valid sub-bank name');
      return;
    }

    const ratesValid = VEHICLE_TYPES.every(t => newSubRates[t] !== '' && Number(newSubRates[t]) >= 0);
    if (!ratesValid) {
      Alert.alert('Error', 'All parking rates must be valid positive numbers');
      return;
    }

    setSavingNewSub(true);
    try {
      const res = await apiRequest('/api/banks', {
        method: 'POST',
        body: JSON.stringify({
          name: newSubName.trim(),
          isThirdParty: false,
          parentId: targetThirdParty.id,
          branchAddress: newSubAddress.trim() || undefined,
          customerCareEmail: newSubEmail.trim() || undefined,
          customerCarePhone: newSubPhone.trim() || undefined,
          rates: {
            TW: Number(newSubRates.TW),
            THREE_W: Number(newSubRates.THREE_W),
            FW: Number(newSubRates.FW),
            CV: Number(newSubRates.CV),
          },
        }),
      });

      if (res.success) {
        setAddSubModalVisible(false);
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.add(targetThirdParty.id);
          return next;
        });
        loadBanks(true);
        Alert.alert('Success', `Sub-bank "${newSubName}" added to "${targetThirdParty.name}"`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add sub-bank');
    } finally {
      setSavingNewSub(false);
    }
  };

  // Build display list: group direct banks and third-party groups
  const directBanks = banks.filter(b => !b.isThirdParty && !b.parentId);
  const thirdPartyGroups = banks.filter(b => b.isThirdParty);
  const subBankMap: Record<string, Bank[]> = {};
  banks.filter(b => b.parentId).forEach(b => {
    if (!subBankMap[b.parentId!]) subBankMap[b.parentId!] = [];
    subBankMap[b.parentId!].push(b);
  });

  const allFilteredDirect = search
    ? directBanks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : directBanks;
  const allFilteredGroups = search
    ? thirdPartyGroups.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (subBankMap[g.id] || []).some(sb => sb.name.toLowerCase().includes(search.toLowerCase()))
      )
    : thirdPartyGroups;

  const getRateForType = (bank: Bank, type: string) =>
    bank.parkingRates?.find(r => r.vehicleType === type)?.dailyRate ?? '-';

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Bank Management</ThemedText>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search banks..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <ThemedText style={{ color: '#64748B', marginTop: 10 }}>Loading banks...</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />}
        >
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{directBanks.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Direct Banks</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{thirdPartyGroups.length}</ThemedText>
              <ThemedText style={styles.statLabel}>3rd Party Groups</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{banks.filter(b => b.parentId).length}</ThemedText>
              <ThemedText style={styles.statLabel}>Sub-Banks</ThemedText>
            </View>
          </View>

          {/* Direct Banks */}
          {allFilteredDirect.length > 0 && (
            <>
              <ThemedText style={styles.sectionTitle}>🏦 Direct Banks</ThemedText>
              {allFilteredDirect.map(bank => (
                <View key={bank.id} style={styles.bankCard}>
                  <View style={styles.bankCardHeader}>
                    <View style={styles.bankIconCircle}>
                      <Building size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.bankName}>{bank.name}</ThemedText>
                      <ThemedText style={styles.bankType}>Direct Bank</ThemedText>
                    </View>
                    {isAdmin && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={() => handleOpenEditModal(bank)} activeOpacity={0.7}>
                          <Settings size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteBank(bank)} activeOpacity={0.7}>
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Branch Address & Customer Care Info */}
                  {(bank.branchAddress || bank.customerCarePhone || bank.customerCareEmail) && (
                    <View style={styles.bankContactContainer}>
                      {!!bank.branchAddress && (
                        <View style={styles.contactRow}>
                          <Building size={13} color="#4F46E5" style={{ marginTop: 2, marginRight: 5 }} />
                          <ThemedText style={styles.contactText} numberOfLines={2}>
                            {bank.branchAddress}
                          </ThemedText>
                        </View>
                      )}
                      <View style={styles.contactBadgesRow}>
                        {!!bank.customerCarePhone && (
                          <View style={styles.contactBadge}>
                            <Phone size={11} color="#059669" style={{ marginRight: 4 }} />
                            <ThemedText style={styles.contactPhoneText}>{bank.customerCarePhone}</ThemedText>
                          </View>
                        )}
                        {!!bank.customerCareEmail && (
                          <View style={styles.contactBadge}>
                            <Mail size={11} color="#2563EB" style={{ marginRight: 4 }} />
                            <ThemedText style={styles.contactEmailText}>{bank.customerCareEmail}</ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {bank.parkingRates?.length > 0 && (
                    <View style={styles.ratesGrid}>
                      {VEHICLE_TYPES.map(t => (
                        <View key={t} style={styles.rateChip}>
                          <ThemedText style={styles.rateChipType}>{TYPE_LABELS[t]}</ThemedText>
                          <ThemedText style={styles.rateChipVal}>₹{getRateForType(bank, t)}/day</ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Third Party Groups */}
          {allFilteredGroups.length > 0 && (
            <>
              <ThemedText style={styles.sectionTitle}>🏢 Third Party Groups</ThemedText>
              {allFilteredGroups.map(group => {
                const subs = subBankMap[group.id] || [];
                const isExpanded = expandedGroups.has(group.id);
                return (
                  <View key={group.id} style={styles.groupCard}>
                    <TouchableOpacity
                      style={styles.groupHeader}
                      onPress={() => toggleGroup(group.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.bankIconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <Building size={16} color="#B45309" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.bankName}>{group.name}</ThemedText>
                        <ThemedText style={styles.bankType}>{subs.length} Sub-Bank{subs.length !== 1 ? 's' : ''}</ThemedText>
                      </View>
                      {isAdmin && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 }}>
                          <TouchableOpacity onPress={() => handleOpenAddSubModal(group)} activeOpacity={0.7}>
                            <Plus size={16} color="#4F46E5" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteBank(group)} activeOpacity={0.7}>
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                      {isExpanded ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                    </TouchableOpacity>

                    {isExpanded && subs.map(sub => (
                      <View key={sub.id} style={styles.subBankRow}>
                        <View style={styles.subBankDot} />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.subBankName}>{sub.name}</ThemedText>

                          {/* Sub-bank Contact Info */}
                          {(sub.branchAddress || sub.customerCarePhone || sub.customerCareEmail) && (
                            <View style={{ marginTop: 2, marginBottom: 4 }}>
                              {!!sub.branchAddress && (
                                <View style={styles.contactRow}>
                                  <Building size={11} color="#64748B" style={{ marginTop: 1, marginRight: 4 }} />
                                  <ThemedText style={[styles.contactText, { fontSize: 11 }]} numberOfLines={1}>
                                    {sub.branchAddress}
                                  </ThemedText>
                                </View>
                              )}
                              <View style={styles.contactBadgesRow}>
                                {!!sub.customerCarePhone && (
                                  <View style={[styles.contactBadge, { paddingVertical: 2, paddingHorizontal: 5 }]}>
                                    <Phone size={9} color="#059669" style={{ marginRight: 3 }} />
                                    <ThemedText style={[styles.contactPhoneText, { fontSize: 10 }]}>{sub.customerCarePhone}</ThemedText>
                                  </View>
                                )}
                                {!!sub.customerCareEmail && (
                                  <View style={[styles.contactBadge, { paddingVertical: 2, paddingHorizontal: 5 }]}>
                                    <Mail size={9} color="#2563EB" style={{ marginRight: 3 }} />
                                    <ThemedText style={[styles.contactEmailText, { fontSize: 10 }]}>{sub.customerCareEmail}</ThemedText>
                                  </View>
                                )}
                              </View>
                            </View>
                          )}

                          {sub.parkingRates?.length > 0 && (
                            <View style={styles.ratesGridSmall}>
                              {VEHICLE_TYPES.map(t => (
                                <ThemedText key={t} style={styles.subRateChip}>
                                  {t}: ₹{getRateForType(sub, t)}
                                </ThemedText>
                              ))}
                            </View>
                          )}
                        </View>
                        {isAdmin && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity onPress={() => handleOpenEditModal(sub)} activeOpacity={0.7}>
                              <Settings size={14} color="#64748B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteBank(sub)} activeOpacity={0.7}>
                              <Trash2 size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {allFilteredDirect.length === 0 && allFilteredGroups.length === 0 && (
            <View style={styles.emptyState}>
              <Building size={40} color="#CBD5E1" />
              <ThemedText style={styles.emptyTitle}>No Banks Found</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                {search ? `No results for "${search}"` : 'Add your first bank using the + button above.'}
              </ThemedText>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Bank Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Add New Bank</ThemedText>
                <TouchableOpacity onPress={() => { setAddModalVisible(false); resetAddModal(); }} activeOpacity={0.7}>
                  <ThemedText style={styles.modalCloseBtn}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Bank Type Selector */}
                <ThemedText style={styles.modalLabel}>Bank Type *</ThemedText>
                <View style={styles.typeSelectorRow}>
                  <TouchableOpacity
                    style={[styles.typeOption, addType === 'direct' && styles.typeOptionSelected]}
                    onPress={() => setAddType('direct')}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.typeOptionText, addType === 'direct' && styles.typeOptionTextSelected]}>
                      Direct Bank
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeOption, addType === 'third_party' && styles.typeOptionSelected]}
                    onPress={() => setAddType('third_party')}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.typeOptionText, addType === 'third_party' && styles.typeOptionTextSelected]}>
                      Third Party
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      addType === 'shift' && styles.typeOptionSelected,
                      addType === 'shift' && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
                    ]}
                    onPress={() => setAddType('shift')}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.typeOptionText, addType === 'shift' && { color: '#B45309', fontWeight: '800' }]}>
                      🚚 Shift Bank
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                {/* Bank Name */}
                <ThemedText style={styles.modalLabel}>
                  {addType === 'direct' ? 'Bank Name *' : 'Group Name *'}
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder={addType === 'direct' ? 'e.g. HDFC Bank' : 'e.g. Swift Recovery Group'}
                  placeholderTextColor="#94A3B8"
                  value={newBankName}
                  onChangeText={setNewBankName}
                />

                {/* Branch Address */}
                <ThemedText style={styles.modalLabel}>📍 Branch / Office Address</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Civil Lines, Main Road, Kanpur"
                  placeholderTextColor="#94A3B8"
                  value={branchAddress}
                  onChangeText={setBranchAddress}
                />

                {/* Customer Care Contact Details */}
                <ThemedText style={styles.modalLabel}>📞 Customer Care Contact</ThemedText>
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Customer Care Mobile (e.g. 9876543210)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={customerCarePhone}
                    onChangeText={setCustomerCarePhone}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Customer Care Email (e.g. care@bank.com)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={customerCareEmail}
                    onChangeText={setCustomerCareEmail}
                  />
                </View>

                {/* Rates for Direct Bank */}
                {addType === 'direct' && (
                  <>
                    <ThemedText style={styles.modalLabel}>Vehicle-Wise 3-Phase Rates (2W / 3W / 4W / CV)</ThemedText>
                    {VEHICLE_TYPES.map(t => (
                      <View key={t} style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 8 }}>
                          {TYPE_LABELS[t]} ({t})
                        </ThemedText>
                        
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#B45309', marginBottom: 2 }}>Kachha (₹)</ThemedText>
                            <TextInput
                              style={[styles.rateInput, { textAlign: 'center' }]}
                              value={vehiclePhaseRates[t].kachha}
                              onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], kachha: val } }))}
                              keyboardType="numeric"
                              placeholder="50"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#047857', marginBottom: 2 }}>Pakka (₹)</ThemedText>
                            <TextInput
                              style={[styles.rateInput, { textAlign: 'center' }]}
                              value={vehiclePhaseRates[t].pakka}
                              onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], pakka: val } }))}
                              keyboardType="numeric"
                              placeholder="100"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#4338CA', marginBottom: 2 }}>After RO (₹)</ThemedText>
                            <TextInput
                              style={[styles.rateInput, { textAlign: 'center' }]}
                              value={vehiclePhaseRates[t].releaseOrder}
                              onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], releaseOrder: val } }))}
                              keyboardType="numeric"
                              placeholder="150"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}


                {/* Sub-banks for Third Party */}
                {addType === 'third_party' && (
                  <>
                    <ThemedText style={styles.modalLabel}>Sub-Banks</ThemedText>
                    {subBanks.map((sb, index) => (
                      <View key={index} style={styles.subBankInputCard}>
                        <ThemedText style={styles.subBankInputTitle}>Sub-Bank {index + 1}</ThemedText>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Sub-bank name (e.g. ICICI via Swift)"
                          placeholderTextColor="#94A3B8"
                          value={sb.name}
                          onChangeText={val =>
                            setSubBanks(prev => prev.map((s, i) => i === index ? { ...s, name: val } : s))
                          }
                        />
                        <TextInput
                          style={[styles.modalInput, { marginTop: 6 }]}
                          placeholder="Branch Address (optional)"
                          placeholderTextColor="#94A3B8"
                          value={sb.branchAddress}
                          onChangeText={val =>
                            setSubBanks(prev => prev.map((s, i) => i === index ? { ...s, branchAddress: val } : s))
                          }
                        />
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                          <TextInput
                            style={[styles.modalInput, { flex: 1, fontSize: 12 }]}
                            placeholder="Mobile No."
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                            value={sb.customerCarePhone}
                            onChangeText={val =>
                              setSubBanks(prev => prev.map((s, i) => i === index ? { ...s, customerCarePhone: val } : s))
                            }
                          />
                          <TextInput
                            style={[styles.modalInput, { flex: 1, fontSize: 12 }]}
                            placeholder="Email ID"
                            placeholderTextColor="#94A3B8"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={sb.customerCareEmail}
                            onChangeText={val =>
                              setSubBanks(prev => prev.map((s, i) => i === index ? { ...s, customerCareEmail: val } : s))
                            }
                          />
                        </View>
                        <View style={styles.ratesInputGrid}>
                          {VEHICLE_TYPES.map(t => (
                            <View key={t} style={styles.rateInputItem}>
                              <ThemedText style={styles.rateInputLabel}>{t}</ThemedText>
                              <TextInput
                                style={styles.rateInput}
                                value={sb.rates[t]}
                                onChangeText={val =>
                                  setSubBanks(prev =>
                                    prev.map((s, i) =>
                                      i === index ? { ...s, rates: { ...s.rates, [t]: val } } : s
                                    )
                                  )
                                }
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.addSubBankBtn}
                      onPress={() =>
                        setSubBanks(prev => [
                          ...prev,
                          { name: '', branchAddress: '', customerCareEmail: '', customerCarePhone: '', rates: { TW: '50', THREE_W: '100', FW: '150', CV: '400' } },
                        ])
                      }
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color="#4F46E5" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.addSubBankBtnText}>Add Sub-Bank</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveBank}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.saveBtnText}>Create Bank</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Rates & Details Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Edit Bank Details & Rates
              </ThemedText>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} activeOpacity={0.7}>
                <ThemedText style={styles.modalCloseBtn}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Bank Name */}
              <ThemedText style={styles.modalLabel}>Bank Name *</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editBankName}
                onChangeText={setEditBankName}
                placeholder="Bank Name"
                placeholderTextColor="#94A3B8"
              />

              {/* Branch Address */}
              <ThemedText style={styles.modalLabel}>📍 Branch / Office Address</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editBranchAddress}
                onChangeText={setEditBranchAddress}
                placeholder="e.g. Civil Lines, Main Road, Kanpur"
                placeholderTextColor="#94A3B8"
              />

              {/* Customer Care Contact */}
              <ThemedText style={styles.modalLabel}>📞 Customer Care Contact</ThemedText>
              <View style={{ gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerCarePhone}
                  onChangeText={setEditCustomerCarePhone}
                  placeholder="Customer Care Mobile (e.g. 9876543210)"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerCareEmail}
                  onChangeText={setEditCustomerCareEmail}
                  placeholder="Customer Care Email (e.g. care@bank.com)"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <ThemedText style={styles.modalLabel}>Vehicle-Wise 3-Phase Rates (2W / 3W / 4W / CV)</ThemedText>
              
              {VEHICLE_TYPES.map(t => (
                <View key={t} style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 8 }}>
                    {TYPE_LABELS[t]} ({t})
                  </ThemedText>
                  
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#B45309', marginBottom: 2 }}>Kachha (₹)</ThemedText>
                      <TextInput
                        style={[styles.rateInput, { textAlign: 'center' }]}
                        value={vehiclePhaseRates[t].kachha}
                        onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], kachha: val } }))}
                        keyboardType="numeric"
                        placeholder="50"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#047857', marginBottom: 2 }}>Pakka (₹)</ThemedText>
                      <TextInput
                        style={[styles.rateInput, { textAlign: 'center' }]}
                        value={vehiclePhaseRates[t].pakka}
                        onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], pakka: val } }))}
                        keyboardType="numeric"
                        placeholder="100"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#4338CA', marginBottom: 2 }}>After RO (₹)</ThemedText>
                      <TextInput
                        style={[styles.rateInput, { textAlign: 'center' }]}
                        value={vehiclePhaseRates[t].releaseOrder}
                        onChangeText={val => setVehiclePhaseRates(prev => ({ ...prev, [t]: { ...prev[t], releaseOrder: val } }))}
                        keyboardType="numeric"
                        placeholder="150"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Waiver Days & Payer Config */}
              <ThemedText style={[styles.modalLabel, { marginTop: 8 }]}>Waiver Days & Payer Rules</ThemedText>
              <View style={{ gap: 10, marginBottom: 15 }}>
                <View>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>Free Waiver Days (after RO Date)</ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    value={waiverDays}
                    onChangeText={setWaiverDays}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>Parking Paid By</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.typeOption, parkingPayer === 'CUSTOMER' && styles.typeOptionSelected, { flex: 1 }]}
                      onPress={() => setParkingPayer('CUSTOMER')}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.typeOptionText, parkingPayer === 'CUSTOMER' && styles.typeOptionTextSelected]}>Customer</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeOption, parkingPayer === 'BANK' && styles.typeOptionSelected, { flex: 1 }]}
                      onPress={() => setParkingPayer('BANK')}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.typeOptionText, parkingPayer === 'BANK' && styles.typeOptionTextSelected]}>Bank</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, savingRates && { opacity: 0.7 }]}
              onPress={handleSaveEditedRates}
              disabled={savingRates}
              activeOpacity={0.8}
            >
              {savingRates ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveBtnText}>Save Details & Rates</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Sub-Bank to Network Modal */}
      <Modal
        visible={addSubModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddSubModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Add Sub-Bank to {targetThirdParty?.name}
              </ThemedText>
              <TouchableOpacity onPress={() => setAddSubModalVisible(false)} activeOpacity={0.7}>
                <ThemedText style={styles.modalCloseBtn}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.modalLabel}>Sub-Bank Name *</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. ICICI Bank"
                placeholderTextColor="#94A3B8"
                value={newSubName}
                onChangeText={setNewSubName}
              />

              <ThemedText style={styles.modalLabel}>📍 Branch Address</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Station Road Branch"
                placeholderTextColor="#94A3B8"
                value={newSubAddress}
                onChangeText={setNewSubAddress}
              />

              <ThemedText style={styles.modalLabel}>📞 Customer Care Contact</ThemedText>
              <View style={{ gap: 8, marginBottom: 10 }}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Customer Care Mobile"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={newSubPhone}
                  onChangeText={setNewSubPhone}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Customer Care Email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newSubEmail}
                  onChangeText={setNewSubEmail}
                />
              </View>

              <ThemedText style={styles.modalLabel}>Daily Parking Rates (₹/day)</ThemedText>
              <View style={styles.ratesInputGrid}>
                {VEHICLE_TYPES.map(t => (
                  <View key={t} style={styles.rateInputItem}>
                    <ThemedText style={styles.rateInputLabel}>{TYPE_LABELS[t]}</ThemedText>
                    <TextInput
                      style={styles.rateInput}
                      value={newSubRates[t]}
                      onChangeText={val => setNewSubRates(prev => ({ ...prev, [t]: val }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, savingNewSub && { opacity: 0.7 }]}
              onPress={handleAddSubBankToNetwork}
              disabled={savingNewSub}
              activeOpacity={0.8}
            >
              {savingNewSub ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveBtnText}>Add Sub-Bank</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 13 },
  scrollContent: { padding: 12 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
  statLabel: { fontSize: 9, color: '#64748B', fontWeight: '600', marginTop: 1, textAlign: 'center' },

  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  bankCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  bankCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bankIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  bankName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  bankType: { fontSize: 10, color: '#94A3B8', fontWeight: '500', marginTop: 0 },

  bankContactContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  contactBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  contactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactPhoneText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  contactEmailText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },

  ratesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  rateChip: {
    backgroundColor: '#F8FAFC', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', minWidth: 64,
  },
  rateChipType: { fontSize: 9, color: '#64748B', fontWeight: '600' },
  rateChipVal: { fontSize: 11, color: '#0F172A', fontWeight: '700', marginTop: 1 },

  groupCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  subBankRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8,
  },
  subBankDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5', marginTop: 6,
  },
  subBankName: { fontSize: 12, fontWeight: '700', color: '#334155' },
  ratesGridSmall: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  subRateChip: {
    backgroundColor: '#EEF2FF', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    fontSize: 9, color: '#1D4ED8', fontWeight: '600',
  },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 14 },
  emptySubtitle: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { fontSize: 18, color: '#64748B', fontWeight: '600', padding: 4 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#0F172A',
  },

  typeSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2,
    borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC',
  },
  typeOptionSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  typeOptionText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeOptionTextSelected: { color: '#1D4ED8' },

  ratesInputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  rateInputItem: { width: '48%' },
  rateInputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
  rateInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: '#0F172A', fontWeight: '700',
  },

  subBankInputCard: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0',
  },
  subBankInputTitle: { fontSize: 12, fontWeight: '700', color: '#4F46E5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  addSubBankBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#DBEAFE', borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 10, backgroundColor: '#EEF2FF', marginTop: 4,
  },
  addSubBankBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },

  saveBtn: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
