import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Search,
  X,
  Building2,
  Car,
  User,
  Hash,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  PlusCircle,
  Sparkles,
  ShieldCheck,
} from 'lucide-react-native';

import { lookupRapidRepoVehicle } from '@/services/api';

type SearchMode = 'REG' | 'CHASSIS' | 'LOAN';

interface RapidRepoVehicleData {
  registrationNumber?: string | null;
  customerName?: string | null;
  bankName?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  loanNumber?: string | null;
}

export default function VehicleSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const inputRef = useRef<TextInput>(null);

  const [searchMode, setSearchMode] = useState<SearchMode>('REG');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [vehicleData, setVehicleData] = useState<RapidRepoVehicleData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const handleSearch = async () => {
    const cleanQuery = query.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanQuery) {
      Alert.alert('Validation Error', 'Please enter a valid search query.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setErrorMessage(null);
    setVehicleData(null);

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const params: any = {};
      if (searchMode === 'REG') params.regNumber = cleanQuery;
      else if (searchMode === 'CHASSIS') params.chassisNumber = cleanQuery;
      else if (searchMode === 'LOAN') params.loanNumber = cleanQuery;

      const res = await lookupRapidRepoVehicle(params);

      if (res?.success && res?.data) {
        setVehicleData(res.data);
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else {
        setErrorMessage(res?.message || 'Vehicle not found in Rapid Repo database.');
      }
    } catch (err: any) {
      console.warn('[Rapid Repo Search Error]', err);
      const msg = err?.message || 'Failed to search vehicle. Please check network connection.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSearched(false);
    setVehicleData(null);
    setErrorMessage(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCopyText = (text?: string | null, label?: string) => {
    if (!text) return;
    Clipboard.setString(text);
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Alert.alert('Copied', `${label || 'Text'} copied to clipboard.`);
  };

  const handleCreateYardEntry = () => {
    if (!vehicleData) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    // Pass data directly to Add Vehicle Check-in screen
    router.push({
      pathname: '/tenant_admin/admin/vehicles/add',
      params: {
        prefillVehicleNumber: vehicleData.registrationNumber || '',
        prefillCustomerName: vehicleData.customerName || '',
        prefillBankName: vehicleData.bankName || '',
        prefillBrand: vehicleData.vehicleMake || '',
        prefillModel: vehicleData.vehicleModel || '',
        prefillChassisNumber: vehicleData.chassisNumber || '',
        prefillEngineNumber: vehicleData.engineNumber || '',
        prefillLoanNumber: vehicleData.loanNumber || '',
      },
    } as any);
  };

  const getPlaceholder = () => {
    if (searchMode === 'REG') return 'e.g. RJ14AB1234 or DL1CA9999';
    if (searchMode === 'CHASSIS') return 'e.g. MA3EKB21S00...';
    return 'e.g. AGR12345678';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Header Bar */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.headerCenterBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Vehicle Search
            </Text>
            <View style={styles.liveBadge}>
              <Sparkles size={11} color="#0062FF" />
              <Text style={styles.liveBadgeText}>Rapid Repo Live</Text>
            </View>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Search Mode Tabs */}
        <View style={styles.modeTabsContainer}>
          <TouchableOpacity
            style={[styles.modeTab, searchMode === 'REG' && styles.modeTabActive]}
            onPress={() => {
              setSearchMode('REG');
              setQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, searchMode === 'REG' && styles.modeTabTextActive]}>
              Reg. Number
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, searchMode === 'CHASSIS' && styles.modeTabActive]}
            onPress={() => {
              setSearchMode('CHASSIS');
              setQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, searchMode === 'CHASSIS' && styles.modeTabTextActive]}>
              Chassis No.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, searchMode === 'LOAN' && styles.modeTabActive]}
            onPress={() => {
              setSearchMode('LOAN');
              setQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, searchMode === 'LOAN' && styles.modeTabTextActive]}>
              Loan / Agreement
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. Search Input Card */}
        <View style={styles.searchCard}>
          <View style={styles.searchInputRow}>
            <Search size={18} color="#0062FF" strokeWidth={2.2} />
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={getPlaceholder()}
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <X size={16} color="#64748B" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.searchButton, (!query.trim() || loading) && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Search size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.searchButtonText}>Search Vehicle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 4. Results Section */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0062FF" />
            <Text style={styles.loadingStatusText}>Fetching vehicle details from Rapid Repo...</Text>
          </View>
        ) : vehicleData ? (
          <View style={styles.resultContainer}>
            {/* Number Plate Card */}
            <View style={styles.numberPlateCard}>
              <View style={styles.plateIndBanner}>
                <Text style={styles.plateIndText}>IND</Text>
              </View>
              <Text style={styles.plateRegText}>
                {vehicleData.registrationNumber || query || 'NO REG NUMBER'}
              </Text>
            </View>

            {/* Status Verified Banner */}
            <View style={styles.verifiedBanner}>
              <ShieldCheck size={16} color="#059669" strokeWidth={2.4} />
              <Text style={styles.verifiedBannerText}>
                Record Verified in Rapid Repo Database
              </Text>
            </View>

            {/* Vehicle Details Card */}
            <View style={styles.detailsCard}>
              {/* Row 1: Customer Name */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <User size={16} color="#0062FF" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Customer Name</Text>
                  <Text style={styles.detailValue}>
                    {vehicleData.customerName || 'N/A'}
                  </Text>
                </View>
                {vehicleData.customerName && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(vehicleData.customerName, 'Customer Name')}
                    style={styles.copyBtn}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowDivider} />

              {/* Row 2: Bank / Financier */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Building2 size={16} color="#059669" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Bank / Financier</Text>
                  <Text style={[styles.detailValue, { color: '#059669' }]}>
                    {vehicleData.bankName || 'N/A'}
                  </Text>
                </View>
                {vehicleData.bankName && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(vehicleData.bankName, 'Bank Name')}
                    style={styles.copyBtn}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowDivider} />

              {/* Row 3: Make & Model */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#FFFBEB' }]}>
                  <Car size={16} color="#D97706" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Make & Model</Text>
                  <Text style={styles.detailValue}>
                    {[vehicleData.vehicleMake, vehicleData.vehicleModel].filter(Boolean).join(' ') || 'N/A'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Row 4: Chassis Number */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Hash size={16} color="#7C3AED" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Chassis Number</Text>
                  <Text style={styles.detailValue}>
                    {vehicleData.chassisNumber || 'N/A'}
                  </Text>
                </View>
                {vehicleData.chassisNumber && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(vehicleData.chassisNumber, 'Chassis Number')}
                    style={styles.copyBtn}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowDivider} />

              {/* Row 5: Engine Number */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <Hash size={16} color="#9333EA" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Engine Number</Text>
                  <Text style={styles.detailValue}>
                    {vehicleData.engineNumber || 'N/A'}
                  </Text>
                </View>
                {vehicleData.engineNumber && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(vehicleData.engineNumber, 'Engine Number')}
                    style={styles.copyBtn}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowDivider} />

              {/* Row 6: Loan / Agreement Number */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <FileText size={16} color="#0062FF" strokeWidth={2.2} />
                </View>
                <View style={styles.detailTextBox}>
                  <Text style={styles.detailLabel}>Loan / Agreement Number</Text>
                  <Text style={styles.detailValue}>
                    {vehicleData.loanNumber || 'N/A'}
                  </Text>
                </View>
                {vehicleData.loanNumber && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(vehicleData.loanNumber, 'Loan Number')}
                    style={styles.copyBtn}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 1-Click Action: Create Yard Check-In */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCreateYardEntry}
              activeOpacity={0.85}
            >
              <PlusCircle size={18} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.actionBtnText}>
                Create Yard Entry (Check-In)
              </Text>
            </TouchableOpacity>
          </View>
        ) : searched && errorMessage ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconCircle}>
              <AlertCircle size={32} color="#DC2626" strokeWidth={1.8} />
            </View>
            <Text style={styles.errorTitle}>Vehicle Not Found</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          </View>
        ) : (
          <View style={styles.initialStateBox}>
            <View style={styles.initialIconCircle}>
              <Car size={36} color="#94A3B8" strokeWidth={1.6} />
            </View>
            <Text style={styles.initialTitle}>Search Rapid Repo Database</Text>
            <Text style={styles.initialSub}>
              Enter Registration number, Chassis number, or Loan agreement number to instantly look up live vehicle info.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header Bar
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerCenterBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    gap: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },

  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Mode Tabs
  modeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#0062FF',
    fontWeight: '700',
  },

  // Search Card
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 12,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    fontWeight: '700',
    paddingVertical: 0,
    letterSpacing: 0.5,
  },
  clearBtn: {
    padding: 4,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0062FF',
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  searchButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Results
  resultContainer: {
    gap: 12,
  },
  numberPlateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  plateIndBanner: {
    backgroundColor: '#003399',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  plateIndText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  plateRegText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 2,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    justifyContent: 'center',
  },
  verifiedBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextBox: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  copyBtn: {
    padding: 6,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // States
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingStatusText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  initialStateBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 8,
  },
  initialIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  initialTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  initialSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 8,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
