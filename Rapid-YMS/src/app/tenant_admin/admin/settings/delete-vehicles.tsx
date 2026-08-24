import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Search,
  X,
  Trash2,
  AlertTriangle,
  Check,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  Layers,
  MapPin,
  Clock,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Info,
} from 'lucide-react-native';
import {
  getVehicles,
  getTrashVehicles,
  softDeleteVehicles,
  restoreVehicles,
  bulkDeleteVehicles,
} from '@/services/api';

type MainViewMode = 'ACTIVE' | 'TRASH';
type CategoryFilter = 'ALL' | 'PAKKA' | 'KACHHA' | 'RELEASED' | 'SHIFTING';

export default function DeleteVehiclesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Mode: Active Vehicles vs Recycle Bin
  const [viewMode, setViewMode] = useState<MainViewMode>('ACTIVE');

  const [activeVehicles, setActiveVehicles] = useState<any[]>([]);
  const [trashVehicles, setTrashVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');

  // Selected vehicle IDs (for active or trash)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation Modals
  const [modalType, setModalType] = useState<'SOFT_DELETE' | 'RESTORE' | 'PERMANENT_DELETE' | null>(null);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'all'>('selected');

  // Fetch active vehicles and trash vehicles
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [activeRes, trashRes] = await Promise.allSettled([
        getVehicles({ limit: 500 }),
        getTrashVehicles(),
      ]);

      if (activeRes.status === 'fulfilled' && activeRes.value?.data) {
        setActiveVehicles(activeRes.value.data);
      } else {
        setActiveVehicles([]);
      }

      if (trashRes.status === 'fulfilled' && trashRes.value?.data) {
        setTrashVehicles(trashRes.value.data);
      } else {
        setTrashVehicles([]);
      }

      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('[Load Vehicles Error]', err);
      Alert.alert('Error', err?.message || 'Failed to load vehicle records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  // Switch view mode
  const handleSwitchMode = (mode: MainViewMode) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setViewMode(mode);
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  // Filtered active vehicles
  const filteredActiveVehicles = useMemo(() => {
    return activeVehicles.filter((v) => {
      if (selectedCategory === 'PAKKA' && v.yardStatus !== 'PAKKA') return false;
      if (selectedCategory === 'KACHHA' && v.yardStatus !== 'KACHHA') return false;
      if (selectedCategory === 'RELEASED' && v.yardStatus !== 'RELEASED') return false;
      if (selectedCategory === 'SHIFTING' && (!v.shiftStatus || v.shiftStatus === 'NONE')) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const vNum = (v.vehicleNumber || '').toLowerCase();
        const bName = (v.bankName || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        const brand = (v.brand || '').toLowerCase();
        const chassis = (v.chassisNumber || '').toLowerCase();
        const custName = (v.customerName || '').toLowerCase();

        return (
          vNum.includes(query) ||
          bName.includes(query) ||
          model.includes(query) ||
          brand.includes(query) ||
          chassis.includes(query) ||
          custName.includes(query)
        );
      }
      return true;
    });
  }, [activeVehicles, selectedCategory, searchQuery]);

  // Filtered trash vehicles
  const filteredTrashVehicles = useMemo(() => {
    return trashVehicles.filter((v) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const vNum = (v.vehicleNumber || '').toLowerCase();
        const bName = (v.bankName || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        const chassis = (v.chassisNumber || '').toLowerCase();

        return (
          vNum.includes(query) ||
          bName.includes(query) ||
          model.includes(query) ||
          chassis.includes(query)
        );
      }
      return true;
    });
  }, [trashVehicles, searchQuery]);

  // Counts for active tabs
  const categoryCounts = useMemo(() => {
    const counts = { ALL: activeVehicles.length, PAKKA: 0, KACHHA: 0, RELEASED: 0, SHIFTING: 0 };
    activeVehicles.forEach((v) => {
      if (v.yardStatus === 'PAKKA') counts.PAKKA++;
      if (v.yardStatus === 'KACHHA') counts.KACHHA++;
      if (v.yardStatus === 'RELEASED') counts.RELEASED++;
      if (v.shiftStatus && v.shiftStatus !== 'NONE') counts.SHIFTING++;
    });
    return counts;
  }, [activeVehicles]);

  // Current list based on mode
  const currentList = viewMode === 'ACTIVE' ? filteredActiveVehicles : filteredTrashVehicles;

  // Toggle selection
  const toggleSelect = (id: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllFilteredSelected = useMemo(() => {
    if (currentList.length === 0) return false;
    return currentList.every((v) => selectedIds.has(v.id));
  }, [currentList, selectedIds]);

  const toggleSelectAllFiltered = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentList.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentList.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedIds(new Set());
  };

  // Move to Trash (Soft Delete) Action
  const handleSoftDelete = async () => {
    try {
      setActionLoading(true);
      let res;
      if (deleteMode === 'all') {
        res = await softDeleteVehicles({ deleteAll: true });
      } else {
        res = await softDeleteVehicles({ vehicleIds: Array.from(selectedIds) });
      }

      if (res?.success) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setModalType(null);
        Alert.alert(
          'Moved to Trash',
          res.message || 'Selected vehicles moved to Trash. You can restore them anytime within 48 hours.'
        );
        loadData();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to move vehicles to trash');
      }
    } catch (err: any) {
      console.error('[Soft Delete Error]', err);
      Alert.alert('Action Failed', err?.message || 'Could not move vehicles to trash.');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Action
  const handleRestore = async (singleId?: string) => {
    try {
      setActionLoading(true);
      const idsToRestore = singleId ? [singleId] : Array.from(selectedIds);
      const res = await restoreVehicles({ vehicleIds: idsToRestore });

      if (res?.success) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setModalType(null);
        Alert.alert('Restored Successfully', res.message || 'Vehicle restored back to active yard.');
        loadData();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to restore vehicles');
      }
    } catch (err: any) {
      console.error('[Restore Error]', err);
      Alert.alert('Restore Failed', err?.message || 'Could not restore vehicles.');
    } finally {
      setActionLoading(false);
    }
  };

  // Permanent Delete Action (From Trash)
  const handlePermanentDelete = async () => {
    try {
      setActionLoading(true);
      let res;
      if (deleteMode === 'all') {
        res = await bulkDeleteVehicles({ vehicleIds: trashVehicles.map((v) => v.id) });
      } else {
        res = await bulkDeleteVehicles({ vehicleIds: Array.from(selectedIds) });
      }

      if (res?.success) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setModalType(null);
        Alert.alert(
          'Permanently Deleted',
          res.message || 'Vehicles have been permanently removed from the database.'
        );
        loadData();
      } else {
        throw new Error(res?.error || res?.message || 'Failed to permanently delete vehicles');
      }
    } catch (err: any) {
      console.error('[Permanent Delete Error]', err);
      Alert.alert('Permanent Delete Failed', err?.message || 'Could not permanently delete vehicles.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAKKA':
        return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
      case 'KACHHA':
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
      case 'RELEASED':
        return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const totalCountToActOn = deleteMode === 'all'
    ? (viewMode === 'ACTIVE' ? activeVehicles.length : trashVehicles.length)
    : selectedIds.size;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Vehicle Data Management</Text>
            <View style={styles.dangerHeaderBadge}>
              <Text style={styles.dangerHeaderBadgeText}>ADMIN</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            {viewMode === 'ACTIVE' ? 'Delete vehicles with 48h safety window' : 'Restore deleted vehicles within 48 hours'}
          </Text>
        </View>

        {selectedIds.size > 0 && (
          <View style={[styles.selectedPill, viewMode === 'TRASH' && { backgroundColor: '#059669' }]}>
            <Text style={styles.selectedPillText}>{selectedIds.size} Selected</Text>
          </View>
        )}
      </View>

      {/* Main Mode Switcher (Segmented Tabs) */}
      <View style={styles.modeSwitcherContainer}>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'ACTIVE' && styles.modeTabActive]}
          onPress={() => handleSwitchMode('ACTIVE')}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={viewMode === 'ACTIVE' ? '#DC2626' : '#64748B'} />
          <Text style={[styles.modeTabText, viewMode === 'ACTIVE' && styles.modeTabTextActive]}>
            Active Yard ({activeVehicles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'TRASH' && styles.modeTabActiveGreen]}
          onPress={() => handleSwitchMode('TRASH')}
          activeOpacity={0.7}
        >
          <RotateCcw size={16} color={viewMode === 'TRASH' ? '#059669' : '#64748B'} />
          <Text style={[styles.modeTabText, viewMode === 'TRASH' && styles.modeTabTextActiveGreen]}>
            Recycle Bin 48h ({trashVehicles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner for Active Mode */}
      {viewMode === 'ACTIVE' && (
        <View style={styles.infoBanner}>
          <Info size={16} color="#4338CA" />
          <Text style={styles.infoBannerText}>
            Deleted vehicles remain in <Text style={styles.boldText}>Recycle Bin for 48 hours</Text> and can be restored anytime.
          </Text>
        </View>
      )}

      {/* Info Banner for Trash Mode */}
      {viewMode === 'TRASH' && (
        <View style={[styles.infoBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <Clock size={16} color="#047857" />
          <Text style={[styles.infoBannerText, { color: '#065F46' }]}>
            Vehicles will be permanently erased after 48 hours. Tap <Text style={styles.boldText}>Restore</Text> to bring back.
          </Text>
        </View>
      )}

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              viewMode === 'ACTIVE'
                ? 'Search vehicle no, bank, chassis, model...'
                : 'Search deleted vehicles in recycle bin...'
            }
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              activeOpacity={0.7}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Status Filter Tabs (Only in ACTIVE mode) */}
      {viewMode === 'ACTIVE' && (
        <View style={styles.tabsContainer}>
          {(['ALL', 'PAKKA', 'KACHHA', 'RELEASED', 'SHIFTING'] as CategoryFilter[]).map((tab) => {
            const isActive = selectedCategory === tab;
            const count = categoryCounts[tab];
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => {
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setSelectedCategory(tab);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selection Control Bar */}
      <View style={styles.selectionBar}>
        <TouchableOpacity
          style={styles.selectAllToggle}
          onPress={toggleSelectAllFiltered}
          activeOpacity={0.7}
        >
          {isAllFilteredSelected ? (
            <CheckSquare size={20} color={viewMode === 'ACTIVE' ? '#DC2626' : '#059669'} />
          ) : (
            <Square size={20} color="#64748B" />
          )}
          <Text style={styles.selectAllText}>
            {isAllFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
          </Text>
          <Text style={styles.filteredCountText}>
            ({currentList.length})
          </Text>
        </TouchableOpacity>

        <View style={styles.selectionRightActions}>
          {selectedIds.size > 0 ? (
            <TouchableOpacity onPress={clearSelection} activeOpacity={0.7}>
              <Text style={[styles.clearText, viewMode === 'TRASH' && { color: '#059669' }]}>
                Clear ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.selectionHintText}>
              Tap card to select
            </Text>
          )}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading vehicle records...</Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 95 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#DC2626']}
              tintColor="#DC2626"
            />
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            const statusStyle = getStatusColor(item.yardStatus);

            if (viewMode === 'TRASH') {
              // Recycle Bin Card View
              return (
                <TouchableOpacity
                  style={[
                    styles.vehicleCard,
                    styles.trashCard,
                    isSelected && styles.vehicleCardSelectedGreen,
                  ]}
                  onPress={() => toggleSelect(item.id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.checkboxContainer,
                      isSelected && styles.checkboxContainerSelectedGreen,
                    ]}
                  >
                    {isSelected ? (
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <View style={styles.uncheckedDot} />
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.vehicleNumber}>{item.vehicleNumber}</Text>
                      
                      <View style={styles.timerBadge}>
                        <Clock size={12} color="#DC2626" />
                        <Text style={styles.timerBadgeText}>
                          {item.timeRemainingFormatted || '48h left'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDetailsGrid}>
                      <View style={styles.detailItem}>
                        <Building2 size={13} color="#64748B" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {item.bankName || 'Direct'}
                        </Text>
                      </View>

                      <View style={styles.detailItem}>
                        <Calendar size={13} color="#64748B" />
                        <Text style={styles.detailText}>
                          Deleted: {formatDate(item.deletedAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick restore button */}
                  <TouchableOpacity
                    style={styles.quickRestoreBtn}
                    onPress={() => handleRestore(item.id)}
                    activeOpacity={0.7}
                  >
                    <RotateCcw size={15} color="#059669" />
                    <Text style={styles.quickRestoreBtnText}>Restore</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }

            // Active Yard Card View
            return (
              <TouchableOpacity
                style={[
                  styles.vehicleCard,
                  isSelected && styles.vehicleCardSelected,
                ]}
                onPress={() => toggleSelect(item.id)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.checkboxContainer,
                    isSelected && styles.checkboxContainerSelected,
                  ]}
                >
                  {isSelected ? (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <View style={styles.uncheckedDot} />
                  )}
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.vehicleNumber}>{item.vehicleNumber}</Text>
                    
                    <View style={styles.badgesRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusStyle.bg,
                            borderColor: statusStyle.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: statusStyle.text },
                          ]}
                        >
                          {item.yardStatus}
                        </Text>
                      </View>

                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {item.vehicleType || 'TW'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardDetailsGrid}>
                    <View style={styles.detailItem}>
                      <Building2 size={13} color="#64748B" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {item.bankName || 'Direct'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Calendar size={13} color="#64748B" />
                      <Text style={styles.detailText}>
                        {formatDate(item.entryDate)}
                      </Text>
                    </View>

                    {item.yardLocation && (
                      <View style={styles.detailItem}>
                        <MapPin size={13} color="#64748B" />
                        <Text style={styles.detailText}>
                          Zone {item.yardLocation.zone}-{item.yardLocation.slot}
                        </Text>
                      </View>
                    )}

                    {item.model && (
                      <View style={styles.detailItem}>
                        <Layers size={13} color="#64748B" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {item.brand ? `${item.brand} ${item.model}` : item.model}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                {viewMode === 'ACTIVE' ? (
                  <CheckCircle2 size={36} color="#059669" />
                ) : (
                  <RotateCcw size={36} color="#94A3B8" />
                )}
              </View>
              <Text style={styles.emptyTitle}>
                {viewMode === 'ACTIVE' ? 'No Vehicles Found' : 'Recycle Bin is Empty'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {viewMode === 'ACTIVE'
                  ? 'No active vehicles match your search or yard is clean.'
                  : 'No vehicles have been moved to trash in the last 48 hours.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Sticky Action Bar */}
      <View
        style={[
          styles.bottomActionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomCountText}>
            <Text style={[styles.bottomCountBold, viewMode === 'TRASH' && { color: '#059669' }]}>
              {selectedIds.size}
            </Text>{' '}
            of {currentList.length} selected
          </Text>
          <Text style={styles.bottomSubText}>
            {viewMode === 'ACTIVE'
              ? 'Move to 48h Trash'
              : 'Restore or Permanent Delete'}
          </Text>
        </View>

        {viewMode === 'ACTIVE' ? (
          <View style={styles.bottomButtonsRow}>
            {activeVehicles.length > 0 && selectedIds.size === 0 && (
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={() => {
                  setDeleteMode('all');
                  setModalType('SOFT_DELETE');
                }}
                activeOpacity={0.8}
              >
                <ShieldAlert size={16} color="#DC2626" />
                <Text style={styles.clearAllBtnText}>Clear All to Trash</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.deleteActionBtn,
                selectedIds.size === 0 && styles.deleteActionBtnDisabled,
              ]}
              onPress={() => {
                setDeleteMode('selected');
                setModalType('SOFT_DELETE');
              }}
              disabled={selectedIds.size === 0}
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#FFFFFF" />
              <Text style={styles.deleteActionBtnText}>
                Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bottomButtonsRow}>
            {/* Trash Actions */}
            <TouchableOpacity
              style={[
                styles.restoreActionBtn,
                selectedIds.size === 0 && styles.restoreActionBtnDisabled,
              ]}
              onPress={() => {
                setDeleteMode('selected');
                setModalType('RESTORE');
              }}
              disabled={selectedIds.size === 0}
              activeOpacity={0.8}
            >
              <RotateCcw size={16} color="#FFFFFF" />
              <Text style={styles.restoreActionBtnText}>
                Restore {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.permanentDeleteBtn,
                selectedIds.size === 0 && styles.permanentDeleteBtnDisabled,
              ]}
              onPress={() => {
                setDeleteMode('selected');
                setModalType('PERMANENT_DELETE');
              }}
              disabled={selectedIds.size === 0}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Confirmation Modals */}
      <Modal
        visible={modalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionLoading && setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Soft Delete Modal */}
            {modalType === 'SOFT_DELETE' && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.warningIconBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Trash2 size={28} color="#D97706" />
                  </View>
                  <Text style={styles.modalTitle}>
                    {deleteMode === 'all'
                      ? 'Move All Vehicles to Trash?'
                      : `Move ${totalCountToActOn} Vehicle(s) to Trash?`}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Vehicles will be hidden from the active yard. You can restore them anytime within{' '}
                    <Text style={styles.boldText}>48 hours</Text> from the Recycle Bin tab.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => setModalType(null)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmDeleteModalBtn, { backgroundColor: '#D97706' }]}
                    onPress={handleSoftDelete}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Trash2 size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteModalBtnText}>Move to Trash</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Restore Modal */}
            {modalType === 'RESTORE' && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.warningIconBadge, { backgroundColor: '#ECFDF5' }]}>
                    <RotateCcw size={28} color="#059669" />
                  </View>
                  <Text style={styles.modalTitle}>
                    Restore {totalCountToActOn} Vehicle(s)?
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Selected vehicles will be restored back to your active yard list with all photos, billing, and records intact.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => setModalType(null)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmDeleteModalBtn, { backgroundColor: '#059669' }]}
                    onPress={() => handleRestore()}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <RotateCcw size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteModalBtnText}>Yes, Restore</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Permanent Delete Modal */}
            {modalType === 'PERMANENT_DELETE' && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.warningIconBadge}>
                    <AlertTriangle size={28} color="#DC2626" />
                  </View>
                  <Text style={styles.modalTitle}>Permanently Erase Immediately?</Text>
                  <Text style={styles.modalSubtitle}>
                    This will bypass the 48-hour recovery window and <Text style={styles.boldRed}>permanently delete</Text> all {totalCountToActOn} vehicle(s) immediately.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => setModalType(null)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmDeleteModalBtn}
                    onPress={handlePermanentDelete}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Trash2 size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteModalBtnText}>Erase Forever</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dangerHeaderBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dangerHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  selectedPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  selectedPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modeSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabActiveGreen: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  modeTabTextActiveGreen: {
    color: '#059669',
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#3730A3',
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
  },
  boldRed: {
    fontWeight: '800',
    color: '#DC2626',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tabBadgeActive: {
    backgroundColor: '#334155',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#F8FAFC',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectAllToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  filteredCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  selectionRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  selectionHintText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  trashCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  vehicleCardSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  vehicleCardSelectedGreen: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxContainerSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkboxContainerSelectedGreen: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  uncheckedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  cardInfo: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vehicleNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
    gap: 4,
  },
  timerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  cardDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  quickRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  quickRestoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bottomInfo: {
    flex: 1,
  },
  bottomCountText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  bottomCountBold: {
    fontWeight: '800',
    color: '#DC2626',
  },
  bottomSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  clearAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  deleteActionBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  deleteActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restoreActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  restoreActionBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  restoreActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  permanentDeleteBtn: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  permanentDeleteBtnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmDeleteModalBtn: {
    flex: 1.6,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmDeleteModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
