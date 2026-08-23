import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  Download,
  Calendar,
  Layers,
  Check,
  X,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  ChevronDown,
  Car,
  ShieldCheck,
  Clock3,
  LogOut,
  RefreshCcw,
  CalendarDays,
  CalendarRange,
} from 'lucide-react-native';
import { getVehicles } from '@/services/api';
import { VehicleCategoryKey } from './VehicleCategoryTabs';

export type ExportDatePreset =
  | 'all_time'
  | 'today'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'custom_range';

export interface ExportVehiclesModalProps {
  visible: boolean;
  onClose: () => void;
  defaultCategory?: VehicleCategoryKey;
}

const CATEGORIES: {
  key: VehicleCategoryKey;
  label: string;
  badgeBg: string;
  badgeColor: string;
}[] = [
  {
    key: 'ALL',
    label: 'All Vehicles',
    badgeBg: '#EFF6FF',
    badgeColor: '#0062FF',
  },
  {
    key: 'PAKKA',
    label: 'Pakka Stock',
    badgeBg: '#F0FDF4',
    badgeColor: '#16A34A',
  },
  {
    key: 'KACHHA',
    label: 'Kachha Stock',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
  },
  {
    key: 'RELEASED',
    label: 'Released',
    badgeBg: '#F1F5F9',
    badgeColor: '#475569',
  },
  {
    key: 'SHIFTING',
    label: 'For Shift',
    badgeBg: '#F3E8FF',
    badgeColor: '#9333EA',
  },
];

const DATE_PRESETS: {
  key: ExportDatePreset;
  label: string;
  badgeBg: string;
}[] = [
  {
    key: 'all_time',
    label: 'All Time',
    badgeBg: '#EFF6FF',
  },
  {
    key: 'today',
    label: 'Today',
    badgeBg: '#F0FDF4',
  },
  {
    key: 'this_month',
    label: 'This Month',
    badgeBg: '#EFF6FF',
  },
  {
    key: 'last_month',
    label: 'Last Month',
    badgeBg: '#F8FAFC',
  },
  {
    key: 'last_3_months',
    label: 'Last 3 Months',
    badgeBg: '#FEF3C7',
  },
  {
    key: 'last_6_months',
    label: 'Last 6 Months',
    badgeBg: '#FEF3C7',
  },
  {
    key: 'custom_range',
    label: 'Custom Range (From - To)',
    badgeBg: '#F0FDF4',
  },
];

export default function ExportVehiclesModal({
  visible,
  onClose,
}: ExportVehiclesModalProps) {
  const insets = useSafeAreaInsets();

  // No option selected by default
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategoryKey | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ExportDatePreset | null>(null);

  // Dropdown pickers open state
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Custom range dates
  const [customFromDate, setCustomFromDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [customToDate, setCustomToDate] = useState<Date>(new Date());
  const [activePicker, setActivePicker] = useState<'from' | 'to' | null>(null);

  const [exporting, setExporting] = useState(false);

  // Reset selections each time modal opens so nothing is pre-selected
  useEffect(() => {
    if (visible) {
      setSelectedCategory(null);
      setSelectedPreset(null);
      setCustomFromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      setCustomToDate(new Date());
      setActivePicker(null);
      setCategoryPickerOpen(false);
      setDatePickerOpen(false);
    }
  }, [visible]);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    if (activePicker === 'from') {
      setCustomFromDate(selectedDate);
      if (selectedDate > customToDate) {
        setCustomToDate(selectedDate);
      }
    } else if (activePicker === 'to') {
      setCustomToDate(selectedDate);
      if (selectedDate < customFromDate) {
        setCustomFromDate(selectedDate);
      }
    }
  };

  const calculateDateRange = () => {
    const now = new Date();
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;

    if (selectedPreset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      startDate = todayStart.toISOString();
      endDate = todayEnd.toISOString();
    } else if (selectedPreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (selectedPreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (selectedPreset === 'last_3_months') {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString();
      endDate = now.toISOString();
    } else if (selectedPreset === 'last_6_months') {
      const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString();
      endDate = now.toISOString();
    } else if (selectedPreset === 'custom_range') {
      const start = new Date(customFromDate.getFullYear(), customFromDate.getMonth(), customFromDate.getDate(), 0, 0, 0);
      const end = new Date(customToDate.getFullYear(), customToDate.getMonth(), customToDate.getDate(), 23, 59, 59);
      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    return { startDate, endDate };
  };

  const escapeCSV = (field: any) => {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  };

  const isFormValid = selectedCategory !== null && selectedPreset !== null;

  const handleExport = async () => {
    if (!selectedCategory) {
      Alert.alert('Selection Required', 'Category select karein.');
      return;
    }
    if (!selectedPreset) {
      Alert.alert('Selection Required', 'Date Range select karein.');
      return;
    }

    try {
      setExporting(true);
      const { startDate, endDate } = calculateDateRange();

      const yardStatus =
        selectedCategory === 'ALL' || selectedCategory === 'SHIFTING'
          ? undefined
          : selectedCategory;
      const shifting = selectedCategory === 'SHIFTING' ? true : undefined;

      // Fetch full records matching criteria
      const res = await getVehicles({
        startDate,
        endDate,
        yardStatus,
        shifting,
        limit: 5000,
        page: 1,
      });

      const records: any[] = res?.data || res?.vehicles || (Array.isArray(res) ? res : []);

      if (records.length === 0) {
        Alert.alert('No Records Found', 'Is selection me koi vehicle record nahi mila.');
        setExporting(false);
        return;
      }

      const headers = [
        'Vehicle Number',
        'Vehicle Type',
        'Yard Status',
        'Bank Name',
        'Repo Agency',
        'Customer Name',
        'Customer Phone',
        'Chassis Number',
        'Engine Number',
        'Entry Date',
        'Release Date',
        'Location in Yard',
      ];

      const rows = records.map((v) => [
        escapeCSV(v.vehicleNumber?.toUpperCase() || ''),
        escapeCSV(v.vehicleType || ''),
        escapeCSV(v.yardStatus || ''),
        escapeCSV(v.bankName || ''),
        escapeCSV(v.repoAgency || ''),
        escapeCSV(v.customerName || ''),
        escapeCSV(v.customerPhone || ''),
        escapeCSV(v.chassisNumber || ''),
        escapeCSV(v.engineNumber || ''),
        escapeCSV(v.entryDate ? new Date(v.entryDate).toLocaleString('en-IN') : 'N/A'),
        escapeCSV(v.actualReleaseDate ? new Date(v.actualReleaseDate).toLocaleString('en-IN') : 'N/A'),
        escapeCSV(v.yardLocation?.code || v.yardLocation?.name || 'Unassigned'),
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const dateTag =
        selectedPreset === 'custom_range'
          ? `${customFromDate.toISOString().slice(0, 10)}_to_${customToDate.toISOString().slice(0, 10)}`
          : selectedPreset;
      const fileName = `RapidYMS_${selectedCategory}_${dateTag}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
        onClose();
        return;
      }

      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${selectedCategory} (${records.length} records)`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export Complete', `${records.length} records exported to ${fileName}`);
      }

      onClose();
    } catch (err: any) {
      console.warn('[Export Error]', err);
      Alert.alert('Export Failed', err.message || 'Records export nahi ho paye.');
    } finally {
      setExporting(false);
    }
  };

  const formatDateLabel = (d: Date) => {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const selectedCategoryObj = CATEGORIES.find((c) => c.key === selectedCategory);
  const selectedPresetObj = DATE_PRESETS.find((p) => p.key === selectedPreset);

  let dateSummaryLabel = '';
  if (selectedPreset === 'custom_range') {
    dateSummaryLabel = `${formatDateLabel(customFromDate)} → ${formatDateLabel(customToDate)}`;
  } else if (selectedPresetObj) {
    dateSummaryLabel = selectedPresetObj.label;
  }

  const getCategoryIcon = (key: VehicleCategoryKey) => {
    if (key === 'ALL') return <Car size={16} color="#0062FF" strokeWidth={2.2} />;
    if (key === 'PAKKA') return <ShieldCheck size={16} color="#16A34A" strokeWidth={2.2} />;
    if (key === 'KACHHA') return <Clock3 size={16} color="#D97706" strokeWidth={2.2} />;
    if (key === 'RELEASED') return <LogOut size={16} color="#475569" strokeWidth={2.2} />;
    if (key === 'SHIFTING') return <RefreshCcw size={16} color="#9333EA" strokeWidth={2.2} />;
    return <Layers size={16} color="#0062FF" strokeWidth={2.2} />;
  };

  const getDatePresetIcon = (key: ExportDatePreset) => {
    if (key === 'today') return <Clock size={16} color="#16A34A" strokeWidth={2.2} />;
    if (key === 'this_month' || key === 'last_month') return <CalendarDays size={16} color="#0062FF" strokeWidth={2.2} />;
    if (key === 'custom_range') return <CalendarRange size={16} color="#0062FF" strokeWidth={2.2} />;
    return <Calendar size={16} color="#64748B" strokeWidth={2.2} />;
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
                {/* Grab Handle */}
                <View style={styles.handle} />

                {/* Header (Clean single line title, no subtext) */}
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                      <FileSpreadsheet size={19} color="#16A34A" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.title}>Export Vehicle Data</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <X size={17} color="#64748B" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
                  {/* 1. Category Dropdown */}
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTrigger,
                      selectedCategory && styles.dropdownTriggerSelected,
                    ]}
                    onPress={() => setCategoryPickerOpen(true)}
                    activeOpacity={0.75}
                  >
                    {selectedCategoryObj ? (
                      <View style={styles.selectedContent}>
                        <View style={[styles.iconBadge, { backgroundColor: selectedCategoryObj.badgeBg }]}>
                          {getCategoryIcon(selectedCategoryObj.key)}
                        </View>
                        <Text style={styles.selectedLabel}>{selectedCategoryObj.label}</Text>
                      </View>
                    ) : (
                      <View style={styles.placeholderContent}>
                        <Layers size={16} color="#94A3B8" />
                        <Text style={styles.dropdownPlaceholderText}>Select Category</Text>
                      </View>
                    )}

                    <View style={styles.chevronBox}>
                      <ChevronDown size={17} color="#64748B" strokeWidth={2.2} />
                    </View>
                  </TouchableOpacity>

                  {/* 2. Date Range Dropdown */}
                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Date Range</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTrigger,
                      selectedPreset && styles.dropdownTriggerSelected,
                    ]}
                    onPress={() => setDatePickerOpen(true)}
                    activeOpacity={0.75}
                  >
                    {selectedPresetObj ? (
                      <View style={styles.selectedContent}>
                        <View style={[styles.iconBadge, { backgroundColor: selectedPresetObj.badgeBg }]}>
                          {getDatePresetIcon(selectedPresetObj.key)}
                        </View>
                        <Text style={styles.selectedLabel}>
                          {selectedPreset === 'custom_range'
                            ? `${formatDateLabel(customFromDate)} to ${formatDateLabel(customToDate)}`
                            : selectedPresetObj.label}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.placeholderContent}>
                        <Calendar size={16} color="#94A3B8" />
                        <Text style={styles.dropdownPlaceholderText}>Select Date Range</Text>
                      </View>
                    )}

                    <View style={styles.chevronBox}>
                      <ChevronDown size={17} color="#64748B" strokeWidth={2.2} />
                    </View>
                  </TouchableOpacity>

                  {/* 3. Custom Date Range Pickers (Only if Custom Range selected) */}
                  {selectedPreset === 'custom_range' && (
                    <View style={styles.customDateCard}>
                      <View style={styles.dateInputsRow}>
                        {/* From Date */}
                        <TouchableOpacity
                          style={[styles.dateInputBox, activePicker === 'from' && styles.dateInputBoxActive]}
                          onPress={() => setActivePicker('from')}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.dateInputLabel}>From</Text>
                          <View style={styles.dateInputContent}>
                            <Calendar size={13} color="#0062FF" strokeWidth={2.2} />
                            <Text style={styles.dateInputValue}>{formatDateLabel(customFromDate)}</Text>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.arrowBetween}>
                          <ArrowRight size={14} color="#94A3B8" />
                        </View>

                        {/* To Date */}
                        <TouchableOpacity
                          style={[styles.dateInputBox, activePicker === 'to' && styles.dateInputBoxActive]}
                          onPress={() => setActivePicker('to')}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.dateInputLabel}>To</Text>
                          <View style={styles.dateInputContent}>
                            <Calendar size={13} color="#0062FF" strokeWidth={2.2} />
                            <Text style={styles.dateInputValue}>{formatDateLabel(customToDate)}</Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Active Picker */}
                      {activePicker && (
                        <View style={styles.pickerWrapper}>
                          <DateTimePicker
                            value={activePicker === 'from' ? customFromDate : customToDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                          />
                          {Platform.OS === 'ios' && (
                            <TouchableOpacity
                              style={styles.donePickerBtn}
                              onPress={() => setActivePicker(null)}
                            >
                              <Text style={styles.donePickerText}>Done</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Clean Selection Badge if selected */}
                  {isFormValid && (
                    <View style={styles.summaryBar}>
                      <Text style={styles.summaryText}>
                        Export: <Text style={styles.summaryBold}>{selectedCategoryObj?.label}</Text> • <Text style={styles.summaryBold}>{dateSummaryLabel}</Text>
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Footer Buttons */}
                <View style={styles.footerRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={onClose}
                    disabled={exporting}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.exportBtn,
                      (!isFormValid || exporting) && styles.exportBtnDisabled,
                    ]}
                    onPress={handleExport}
                    disabled={!isFormValid || exporting}
                    activeOpacity={0.85}
                  >
                    {exporting ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.exportBtnText}>Preparing...</Text>
                      </>
                    ) : (
                      <>
                        <Download size={17} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.exportBtnText}>Download CSV</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Category Dropdown Selection Modal */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCategoryPickerOpen(false)}>
          <View style={styles.dropdownModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownModalCard}>
                <View style={styles.dropdownModalHeader}>
                  <Text style={styles.dropdownModalTitle}>Select Category</Text>
                  <TouchableOpacity
                    style={styles.dropdownModalClose}
                    onPress={() => setCategoryPickerOpen(false)}
                  >
                    <X size={16} color="#64748B" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.optionsList}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedCategory(cat.key);
                          setCategoryPickerOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.iconBadge, { backgroundColor: cat.badgeBg }]}>
                          {getCategoryIcon(cat.key)}
                        </View>
                        <Text
                          style={[
                            styles.optionTitle,
                            isSelected && styles.optionTitleSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <Check size={13} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Date Range Dropdown Selection Modal */}
      <Modal
        visible={datePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDatePickerOpen(false)}>
          <View style={styles.dropdownModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownModalCard}>
                <View style={styles.dropdownModalHeader}>
                  <Text style={styles.dropdownModalTitle}>Select Date Range</Text>
                  <TouchableOpacity
                    style={styles.dropdownModalClose}
                    onPress={() => setDatePickerOpen(false)}
                  >
                    <X size={16} color="#64748B" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.optionsList}>
                  {DATE_PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedPreset(preset.key);
                          setDatePickerOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.iconBadge, { backgroundColor: preset.badgeBg }]}>
                          {getDatePresetIcon(preset.key)}
                        </View>
                        <Text
                          style={[
                            styles.optionTitle,
                            isSelected && styles.optionTitleSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <Check size={13} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Dropdown Triggers
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownTriggerSelected: {
    borderColor: '#0062FF',
    backgroundColor: '#F8FAFC',
  },
  selectedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownPlaceholderText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  selectedLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  chevronBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Custom Date Range Card
  customDateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 10,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dateInputBoxActive: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF6FF',
  },
  dateInputLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  dateInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateInputValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  arrowBetween: {
    paddingHorizontal: 8,
  },
  pickerWrapper: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  donePickerBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#0062FF',
    borderRadius: 6,
    marginTop: 6,
  },
  donePickerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Minimal Ready Badge
  summaryBar: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 11.5,
    color: '#1E293B',
  },
  summaryBold: {
    fontWeight: '700',
    color: '#0062FF',
  },

  // Actions
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  exportBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  exportBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  exportBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Dropdown Picker Modal
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dropdownModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 16,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownModalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownModalClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 6,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0062FF',
  },
  optionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionTitleSelected: {
    color: '#0062FF',
    fontWeight: '800',
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
