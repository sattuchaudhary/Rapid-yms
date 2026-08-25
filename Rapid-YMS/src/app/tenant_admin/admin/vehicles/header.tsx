import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Filter,
  Calendar,
  Check,
  X,
  RotateCcw,
  Search,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type TimeFilterPreset =
  | 'all_time'
  | 'today'
  | 'this_month'
  | 'last_month'
  | 'custom_month_year';

export interface VehicleFilterState {
  preset: TimeFilterPreset;
  month?: number; // 1-12
  year?: number; // e.g. 2022, 2024, 2026
  bankName?: string | null;
  label: string;
}

export interface VehiclesHeaderProps {
  title?: string;
  onBackPress?: () => void;
  onFilterChange?: (filter: VehicleFilterState) => void;
  initialFilter?: VehicleFilterState;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  isHeaderSearchActive?: boolean;
  onToggleHeaderSearch?: (active: boolean) => void;
  onRefreshPress?: () => void;
  onExportPress?: () => void;
  banksList?: any[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i);

export default function VehiclesHeader({
  title = 'Vehicle List',
  onBackPress,
  onFilterChange,
  initialFilter = { preset: 'all_time', label: 'All Time (Day 1 - Today)' },
  searchQuery = '',
  onSearchChange,
  isHeaderSearchActive = false,
  onToggleHeaderSearch,
  onRefreshPress,
  onExportPress,
  banksList = [],
}: VehiclesHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VehicleFilterState>(initialFilter);
  const [isSearching, setIsSearching] = useState(isHeaderSearchActive);
  const inputRef = useRef<TextInput>(null);

  // Temporary modal selection state before applying
  const [tempPreset, setTempPreset] = useState<TimeFilterPreset>(initialFilter.preset);
  const [tempMonth, setTempMonth] = useState<number>(new Date().getMonth() + 1);
  const [tempYear, setTempYear] = useState<number>(currentYear);
  const [tempBankName, setTempBankName] = useState<string | null>(initialFilter.bankName || null);

  // Bank Dropdown Expand & Search inside modal
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [bankSearchText, setBankSearchText] = useState('');

  const filteredBanks = useMemo(() => {
    if (!bankSearchText.trim()) return banksList;
    const q = bankSearchText.trim().toLowerCase();
    return banksList.filter((b) => {
      const name = (b.name || b.bankName || '').toLowerCase();
      return name.includes(q);
    });
  }, [banksList, bankSearchText]);

  const handleOpenFilter = () => {
    setOptionsMenuVisible(false);
    setTempPreset(activeFilter.preset);
    if (activeFilter.month) setTempMonth(activeFilter.month);
    if (activeFilter.year) setTempYear(activeFilter.year);
    setTempBankName(activeFilter.bankName || null);
    setBankDropdownOpen(false);
    setBankSearchText('');
    setTimeout(() => {
      setFilterModalVisible(true);
    }, 150);
  };

  const handleApplyFilter = () => {
    let dateLabel = 'All Time';
    if (tempPreset === 'all_time') {
      dateLabel = 'All Time';
    } else if (tempPreset === 'today') {
      dateLabel = 'Today';
    } else if (tempPreset === 'this_month') {
      dateLabel = 'This Month';
    } else if (tempPreset === 'last_month') {
      dateLabel = 'Last Month';
    } else if (tempPreset === 'custom_month_year') {
      dateLabel = `${MONTHS[tempMonth - 1]} ${tempYear}`;
    }

    let fullLabel = dateLabel;
    if (tempBankName) {
      fullLabel = tempPreset === 'all_time' ? tempBankName : `${tempBankName} • ${dateLabel}`;
    } else if (tempPreset === 'all_time') {
      fullLabel = 'All Time (Day 1 - Today)';
    }

    const newFilter: VehicleFilterState = {
      preset: tempPreset,
      month: tempPreset === 'custom_month_year' ? tempMonth : undefined,
      year: tempPreset === 'custom_month_year' ? tempYear : undefined,
      bankName: tempBankName || null,
      label: fullLabel,
    };

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }

    setActiveFilter(newFilter);
    setFilterModalVisible(false);
    if (onFilterChange) {
      onFilterChange(newFilter);
    }
  };

  const handleResetFilter = () => {
    const defaultFilter: VehicleFilterState = {
      preset: 'all_time',
      bankName: null,
      label: 'All Time (Day 1 - Today)',
    };
    setTempPreset('all_time');
    setTempBankName(null);
    setBankSearchText('');
    setBankDropdownOpen(false);
    setActiveFilter(defaultFilter);
    setFilterModalVisible(false);
    setOptionsMenuVisible(false);
    if (onFilterChange) {
      onFilterChange(defaultFilter);
    }
  };

  const handleStartSearch = () => {
    setIsSearching(true);
    onToggleHeaderSearch?.(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCloseSearch = () => {
    setIsSearching(false);
    onToggleHeaderSearch?.(false);
    onSearchChange?.('');
  };

  const isFiltered = activeFilter.preset !== 'all_time' || !!activeFilter.bankName;

  return (
    <>
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        {/* Expanded Search Header Bar */}
        {isSearching ? (
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleCloseSearch}
              activeOpacity={0.7}
              accessibilityLabel="Cancel search"
            >
              <ChevronLeft size={24} color="#0F172A" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.searchBarContainer}>
              <Search size={17} color="#64748B" strokeWidth={2.2} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search vehicle no, bank..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={onSearchChange}
                returnKeyType="search"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => onSearchChange?.('')}
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={15} color="#64748B" strokeWidth={2.4} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3-Dot Menu in Search Bar */}
            <TouchableOpacity
              style={[styles.iconButton, isFiltered && styles.iconButtonFiltered]}
              onPress={() => setOptionsMenuVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="More options"
            >
              <MoreVertical size={20} color="#0F172A" strokeWidth={2.2} />
              {isFiltered && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>
        ) : (
          /* Normal Header Bar */
          <View style={styles.headerBar}>
            {/* Left: Back Button */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onBackPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={24} color="#0F172A" strokeWidth={2.4} />
            </TouchableOpacity>

            {/* Center: Vehicle List Title + Active Filter Tag */}
            <View style={styles.centerTitleBox}>
              <Text style={styles.titleText} numberOfLines={1}>
                {title}
              </Text>
              {isFiltered && (
                <View style={styles.activeFilterChip}>
                  {activeFilter.bankName ? (
                    <Building2 size={10} color="#0062FF" />
                  ) : (
                    <Calendar size={10} color="#0062FF" />
                  )}
                  <Text style={styles.activeFilterText} numberOfLines={1}>
                    {activeFilter.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Right: Search Icon + 3-Dot More Menu */}
            <View style={styles.rightActionsRow}>
              {/* Header Search Trigger */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleStartSearch}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open header search"
              >
                <Search size={20} color="#0F172A" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 3-Dot Options Button */}
              <TouchableOpacity
                style={[styles.iconButton, isFiltered && styles.iconButtonFiltered]}
                onPress={() => setOptionsMenuVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More options and filters"
              >
                <MoreVertical size={20} color="#0F172A" strokeWidth={2.2} />
                {isFiltered && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 3-Dot Options Bottom Sheet Drawer */}
      <Modal
        visible={optionsMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOptionsMenuVisible(false)}>
          <View style={styles.optionsOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.optionsDrawer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
                {/* Grab Handle */}
                <View style={styles.drawerHandle} />

                {/* Drawer Header */}
                <View style={styles.optionsHeader}>
                  <View>
                    <Text style={styles.optionsTitle}>Quick Options</Text>
                    <Text style={styles.optionsSubtitle}>Filter & vehicle management tools</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.optionsCloseBtn}
                    onPress={() => setOptionsMenuVisible(false)}
                    activeOpacity={0.7}
                  >
                    <X size={17} color="#64748B" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                {/* Option 1: Filter (Bank & Time Filter) */}
                <TouchableOpacity
                  style={styles.optionRowItem}
                  onPress={handleOpenFilter}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Filter size={18} color="#0062FF" strokeWidth={2.2} />
                  </View>
                  <View style={styles.optionContentBox}>
                    <View style={styles.optionTitleLine}>
                      <Text style={styles.optionMainTitle}>Filter Records</Text>
                      {isFiltered && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText} numberOfLines={1}>
                            {activeFilter.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionSubTitle}>
                      Filter vehicles by bank, date range, or month
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                </TouchableOpacity>

                {/* Option 2: Reset Filter (Visible if filtered) */}
                {isFiltered && (
                  <TouchableOpacity
                    style={styles.optionRowItem}
                    onPress={handleResetFilter}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#FEF2F2' }]}>
                      <RotateCcw size={18} color="#EF4444" strokeWidth={2.2} />
                    </View>
                    <View style={styles.optionContentBox}>
                      <Text style={[styles.optionMainTitle, { color: '#EF4444' }]}>
                        Reset Filter
                      </Text>
                      <Text style={styles.optionSubTitle}>
                        Clear bank & date filters (All Time)
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                  </TouchableOpacity>
                )}

                {/* Option 3: Export Data */}
                {onExportPress && (
                  <TouchableOpacity
                    style={styles.optionRowItem}
                    onPress={() => {
                      setOptionsMenuVisible(false);
                      onExportPress();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#F0FDF4' }]}>
                      <Download size={18} color="#16A34A" strokeWidth={2.2} />
                    </View>
                    <View style={styles.optionContentBox}>
                      <Text style={styles.optionMainTitle}>Export Data</Text>
                      <Text style={styles.optionSubTitle}>
                        Download CSV stock report for current records
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                  </TouchableOpacity>
                )}

                {/* Option 4: Refresh List */}
                {onRefreshPress && (
                  <TouchableOpacity
                    style={styles.optionRowItem}
                    onPress={() => {
                      setOptionsMenuVisible(false);
                      onRefreshPress();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#F8FAFC' }]}>
                      <RefreshCw size={18} color="#475569" strokeWidth={2.2} />
                    </View>
                    <View style={styles.optionContentBox}>
                      <Text style={styles.optionMainTitle}>Refresh Records</Text>
                      <Text style={styles.optionSubTitle}>
                        Fetch latest vehicle updates from server
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Filter Bottom Sheet Modal with Searchable Bank Dropdown & Date Filter */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.modalHandle} />

                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <View style={styles.filterIconCircle}>
                      <Filter size={18} color="#0062FF" strokeWidth={2.2} />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Filter Vehicles</Text>
                      <Text style={styles.modalSub}>Select bank and date range</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setFilterModalVisible(false)}
                  >
                    <X size={18} color="#64748B" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Modal Scroll Content */}
                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                  {/* 1. BANK SELECTION DROPDOWN WITH SEARCH */}
                  <View style={styles.sectionBlock}>
                    <Text style={styles.groupHeading}>SELECT BANK</Text>

                    {/* Dropdown Box */}
                    <TouchableOpacity
                      style={[
                        styles.bankDropdownTrigger,
                        bankDropdownOpen && styles.bankDropdownTriggerOpen,
                      ]}
                      onPress={() => setBankDropdownOpen(!bankDropdownOpen)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.bankDropdownLeft}>
                        <Building2 size={16} color="#0062FF" />
                        <Text style={styles.bankDropdownText} numberOfLines={1}>
                          {tempBankName || 'All Banks (No Filter)'}
                        </Text>
                      </View>
                      {bankDropdownOpen ? (
                        <ChevronUp size={18} color="#64748B" />
                      ) : (
                        <ChevronDown size={18} color="#64748B" />
                      )}
                    </TouchableOpacity>

                    {/* Expandable Search & Bank List */}
                    {bankDropdownOpen && (
                      <View style={styles.bankDropdownContainer}>
                        {/* Search Input Box */}
                        <View style={styles.bankSearchBox}>
                          <Search size={15} color="#94A3B8" />
                          <TextInput
                            style={styles.bankSearchInput}
                            placeholder="Type to search bank (e.g. HDFC, SBI)..."
                            placeholderTextColor="#94A3B8"
                            value={bankSearchText}
                            onChangeText={setBankSearchText}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          {bankSearchText.length > 0 && (
                            <TouchableOpacity
                              onPress={() => setBankSearchText('')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <X size={14} color="#94A3B8" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Bank Items List */}
                        <ScrollView
                          style={styles.bankItemsScroll}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={true}
                        >
                          {/* Option 1: All Banks */}
                          <TouchableOpacity
                            style={[
                              styles.bankItemRow,
                              tempBankName === null && styles.bankItemRowActive,
                            ]}
                            onPress={() => {
                              setTempBankName(null);
                              setBankDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.bankItemText,
                                tempBankName === null && styles.bankItemTextActive,
                              ]}
                            >
                              All Banks (Show All)
                            </Text>
                            {tempBankName === null && (
                              <Check size={16} color="#0062FF" strokeWidth={2.5} />
                            )}
                          </TouchableOpacity>

                          {/* Filtered Banks */}
                          {filteredBanks.map((b) => {
                            const name = b.name || b.bankName || '';
                            if (!name) return null;
                            const isSelected = tempBankName === name;

                            return (
                              <TouchableOpacity
                                key={b.id || name}
                                style={[
                                  styles.bankItemRow,
                                  isSelected && styles.bankItemRowActive,
                                ]}
                                onPress={() => {
                                  setTempBankName(name);
                                  setBankDropdownOpen(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.bankItemText,
                                    isSelected && styles.bankItemTextActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {name}
                                </Text>
                                {isSelected && (
                                  <Check size={16} color="#0062FF" strokeWidth={2.5} />
                                )}
                              </TouchableOpacity>
                            );
                          })}

                          {filteredBanks.length === 0 && (
                            <View style={styles.noBankFoundBox}>
                              <Text style={styles.noBankFoundText}>
                                No bank matching "{bankSearchText}"
                              </Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* 2. DATE RANGE QUICK PRESETS */}
                  <View style={[styles.sectionBlock, { marginTop: 16 }]}>
                    <Text style={styles.groupHeading}>SELECT DATE RANGE</Text>

                    {/* Option 1: All Time */}
                    <TouchableOpacity
                      style={[
                        styles.presetItem,
                        tempPreset === 'all_time' && styles.presetItemActive,
                      ]}
                      onPress={() => setTempPreset('all_time')}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text style={[styles.presetTitle, tempPreset === 'all_time' && styles.presetTitleActive]}>
                          All Time Records
                        </Text>
                        <Text style={styles.presetSub}>From Day 1 to Today</Text>
                      </View>
                      {tempPreset === 'all_time' && (
                        <View style={styles.checkCircle}>
                          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Option 2: Today */}
                    <TouchableOpacity
                      style={[
                        styles.presetItem,
                        tempPreset === 'today' && styles.presetItemActive,
                      ]}
                      onPress={() => setTempPreset('today')}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text style={[styles.presetTitle, tempPreset === 'today' && styles.presetTitleActive]}>
                          Today
                        </Text>
                        <Text style={styles.presetSub}>Vehicles entered/present today</Text>
                      </View>
                      {tempPreset === 'today' && (
                        <View style={styles.checkCircle}>
                          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Option 3: This Month */}
                    <TouchableOpacity
                      style={[
                        styles.presetItem,
                        tempPreset === 'this_month' && styles.presetItemActive,
                      ]}
                      onPress={() => setTempPreset('this_month')}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text style={[styles.presetTitle, tempPreset === 'this_month' && styles.presetTitleActive]}>
                          Current Month
                        </Text>
                        <Text style={styles.presetSub}>{MONTHS[new Date().getMonth()]} {currentYear}</Text>
                      </View>
                      {tempPreset === 'this_month' && (
                        <View style={styles.checkCircle}>
                          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Option 4: Last Month */}
                    <TouchableOpacity
                      style={[
                        styles.presetItem,
                        tempPreset === 'last_month' && styles.presetItemActive,
                      ]}
                      onPress={() => setTempPreset('last_month')}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text style={[styles.presetTitle, tempPreset === 'last_month' && styles.presetTitleActive]}>
                          Last Month
                        </Text>
                        <Text style={styles.presetSub}>Previous calendar month</Text>
                      </View>
                      {tempPreset === 'last_month' && (
                        <View style={styles.checkCircle}>
                          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Option 5: Custom Month & Year Picker */}
                    <TouchableOpacity
                      style={[
                        styles.presetItem,
                        tempPreset === 'custom_month_year' && styles.presetItemActive,
                      ]}
                      onPress={() => setTempPreset('custom_month_year')}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text style={[styles.presetTitle, tempPreset === 'custom_month_year' && styles.presetTitleActive]}>
                          Specific Month & Year
                        </Text>
                        <Text style={styles.presetSub}>e.g. Jan 2022, Aug 2024, etc.</Text>
                      </View>
                      {tempPreset === 'custom_month_year' && (
                        <View style={styles.checkCircle}>
                          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Custom Month / Year Selector Grid */}
                    {tempPreset === 'custom_month_year' && (
                      <View style={styles.customPickerBox}>
                        {/* Year Selector Row */}
                        <Text style={styles.pickerSubHeading}>Select Year:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                          {YEARS.map((yr) => (
                            <TouchableOpacity
                              key={yr}
                              style={[styles.chipItem, tempYear === yr && styles.chipItemActive]}
                              onPress={() => setTempYear(yr)}
                            >
                              <Text style={[styles.chipText, tempYear === yr && styles.chipTextActive]}>
                                {yr}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Month Selector Grid */}
                        <Text style={[styles.pickerSubHeading, { marginTop: 12 }]}>Select Month:</Text>
                        <View style={styles.monthsGrid}>
                          {MONTHS.map((mName, idx) => {
                            const mNum = idx + 1;
                            const isMActive = tempMonth === mNum;
                            return (
                              <TouchableOpacity
                                key={mName}
                                style={[styles.monthChip, isMActive && styles.monthChipActive]}
                                onPress={() => setTempMonth(mNum)}
                              >
                                <Text style={[styles.monthChipText, isMActive && styles.monthChipTextActive]}>
                                  {mName.substring(0, 3)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                </ScrollView>

                {/* Modal Action Buttons */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={handleResetFilter}
                    activeOpacity={0.75}
                  >
                    <RotateCcw size={16} color="#64748B" />
                    <Text style={styles.resetBtnText}>Reset All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={handleApplyFilter}
                    activeOpacity={0.85}
                  >
                    <Check size={16} color="#FFFFFF" strokeWidth={2.6} />
                    <Text style={styles.applyBtnText}>Apply Filter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonFiltered: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0062FF',
  },
  centerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    gap: 4,
    maxWidth: '85%',
  },
  activeFilterText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginHorizontal: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },

  // 3-Dot Options Drawer
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  optionsDrawer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  optionsSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  optionsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContentBox: {
    flex: 1,
  },
  optionTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    maxWidth: 130,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },
  optionSubTitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1.5,
  },

  // Modal Backdrop & Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingVertical: 12,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Bank Dropdown Styles
  bankDropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  bankDropdownTriggerOpen: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF6FF',
  },
  bankDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bankDropdownText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  bankDropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  bankSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  bankSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  bankItemsScroll: {
    maxHeight: 170,
  },
  bankItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  bankItemRowActive: {
    backgroundColor: '#EFF6FF',
  },
  bankItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bankItemTextActive: {
    color: '#0062FF',
    fontWeight: '800',
  },
  noBankFoundBox: {
    padding: 14,
    alignItems: 'center',
  },
  noBankFoundText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Presets
  presetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 7,
  },
  presetItemActive: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF6FF',
  },
  presetTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetTitleActive: {
    color: '#0062FF',
  },
  presetSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Custom Picker Box
  customPickerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: 8,
  },
  pickerSubHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 6,
    paddingBottom: 4,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipItemActive: {
    backgroundColor: '#0062FF',
    borderColor: '#0062FF',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    width: '23%',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  monthChipActive: {
    backgroundColor: '#0062FF',
    borderColor: '#0062FF',
  },
  monthChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
  },

  // Actions
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0062FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  applyBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
