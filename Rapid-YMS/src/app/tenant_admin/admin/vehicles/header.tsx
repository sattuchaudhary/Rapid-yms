import React, { useState, useRef } from 'react';
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
} from 'lucide-react-native';

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
}: VehiclesHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VehicleFilterState>(initialFilter);
  const [isSearching, setIsSearching] = useState(isHeaderSearchActive);
  const inputRef = useRef<TextInput>(null);

  // Temporary modal selection state before applying
  const [tempPreset, setTempPreset] = useState<TimeFilterPreset>(initialFilter.preset);
  const [tempMonth, setTempMonth] = useState<number>(new Date().getMonth() + 1);
  const [tempYear, setTempYear] = useState<number>(currentYear);

  const handleOpenFilter = () => {
    setTempPreset(activeFilter.preset);
    if (activeFilter.month) setTempMonth(activeFilter.month);
    if (activeFilter.year) setTempYear(activeFilter.year);
    setFilterModalVisible(true);
  };

  const handleApplyFilter = () => {
    let label = 'All Time';
    if (tempPreset === 'all_time') {
      label = 'All Time (Day 1 - Today)';
    } else if (tempPreset === 'today') {
      label = 'Today';
    } else if (tempPreset === 'this_month') {
      label = 'This Month';
    } else if (tempPreset === 'last_month') {
      label = 'Last Month';
    } else if (tempPreset === 'custom_month_year') {
      label = `${MONTHS[tempMonth - 1]} ${tempYear}`;
    }

    const newFilter: VehicleFilterState = {
      preset: tempPreset,
      month: tempPreset === 'custom_month_year' ? tempMonth : undefined,
      year: tempPreset === 'custom_month_year' ? tempYear : undefined,
      label,
    };

    setActiveFilter(newFilter);
    setFilterModalVisible(false);
    if (onFilterChange) {
      onFilterChange(newFilter);
    }
  };

  const handleResetFilter = () => {
    const defaultFilter: VehicleFilterState = {
      preset: 'all_time',
      label: 'All Time (Day 1 - Today)',
    };
    setTempPreset('all_time');
    setActiveFilter(defaultFilter);
    setFilterModalVisible(false);
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

  const isFiltered = activeFilter.preset !== 'all_time';

  return (
    <>
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        {/* Expanded Search Header Bar (Option 2) */}
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

            <TouchableOpacity
              style={[styles.iconButton, isFiltered && styles.iconButtonFiltered]}
              onPress={handleOpenFilter}
              activeOpacity={0.7}
              accessibilityLabel="Filter by date and time"
            >
              <Filter
                size={19}
                color={isFiltered ? '#0062FF' : '#0F172A'}
                strokeWidth={2.2}
              />
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

            {/* Center: Vehicle List Title */}
            <View style={styles.centerTitleBox}>
              <Text style={styles.titleText} numberOfLines={1}>
                {title}
              </Text>
              {isFiltered && (
                <View style={styles.activeFilterChip}>
                  <Calendar size={10} color="#0062FF" />
                  <Text style={styles.activeFilterText} numberOfLines={1}>
                    {activeFilter.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Right: Search Icon + Date Filter Icon */}
            <View style={styles.rightActionsRow}>
              {/* Option 2 Header Search Trigger */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleStartSearch}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open header search"
              >
                <Search size={20} color="#0F172A" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Date Filter Button */}
              <TouchableOpacity
                style={[styles.iconButton, isFiltered && styles.iconButtonFiltered]}
                onPress={handleOpenFilter}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Filter by date and time"
              >
                <Filter
                  size={20}
                  color={isFiltered ? '#0062FF' : '#0F172A'}
                  strokeWidth={2.2}
                />
                {isFiltered && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Filter Bottom Sheet Modal */}
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
                      <Calendar size={18} color="#0062FF" strokeWidth={2.2} />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Time Filter</Text>
                      <Text style={styles.modalSub}>Select date range to view vehicle records</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setFilterModalVisible(false)}
                  >
                    <X size={18} color="#64748B" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Quick Range Options */}
                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                  <Text style={styles.groupHeading}>Quick Presets</Text>

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
                </ScrollView>

                {/* Modal Action Buttons */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={handleResetFilter}
                    activeOpacity={0.75}
                  >
                    <RotateCcw size={16} color="#64748B" />
                    <Text style={styles.resetBtnText}>Reset</Text>
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconButtonFiltered: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0062FF',
  },
  centerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  activeFilterText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Search Input in Header Bar
  searchBarContainer: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingVertical: 14,
  },
  groupHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  presetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetTitleActive: {
    color: '#0062FF',
  },
  presetSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Custom Month / Year Box
  customPickerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  pickerSubHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  chipItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
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
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChipActive: {
    backgroundColor: '#0062FF',
    borderColor: '#0062FF',
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Modal Actions
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0062FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
