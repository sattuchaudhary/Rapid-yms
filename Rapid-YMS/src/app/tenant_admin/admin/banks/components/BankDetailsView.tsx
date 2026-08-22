import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Building2,
  Landmark,
  ArrowRightLeft,
  MapPin,
  Phone,
  Mail,
  Clock,
  UserCheck,
  Edit3,
  Trash2,
  Plus,
  Building,
  ChevronRight,
} from 'lucide-react-native';
import { Bank, VEHICLE_TYPES, TYPE_LABELS, TYPE_SHORT_LABELS } from '../types';

export interface BankDetailsViewProps {
  bank: Bank;
  subBanks?: Bank[];
  onEdit?: (bank: Bank) => void;
  onDelete?: (bank: Bank) => void;
  onAddSubBank?: (bank: Bank) => void;
  canManage?: boolean;
}

// 3-Phase Tariff columns config
const RATE_PHASES = [
  { key: 'kachhaRate', label: 'Kachha', short: 'Kachha', color: '#B45309', dot: '#F59E0B' },
  { key: 'pakkaRate', label: 'Pakka', short: 'Pakka', color: '#1D4ED8', dot: '#2563EB' },
  { key: 'releaseOrderRate', label: 'After RO', short: 'After RO', color: '#15803D', dot: '#22C55E' },
] as const;

export default function BankDetailsView({
  bank,
  subBanks = [],
  onEdit,
  onDelete,
  onAddSubBank,
  canManage = true,
}: BankDetailsViewProps) {
  const isShift = bank.isShiftBank || bank.bankCategory === 'SHIFT_BANK';
  const isThirdParty = bank.isThirdParty || bank.bankCategory === 'THIRD_PARTY_BANK';

  const handleCall = (phone: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleEmail = (email: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  const getCategoryInfo = () => {
    if (isThirdParty) {
      return {
        label: '3rd Party Pannel Bank',
        bg: '#FFFBEB',
        border: '#FDE68A',
        color: '#D97706',
        Icon: Landmark,
      };
    }
    if (isShift) {
      return {
        label: 'Shift (Not Panneled)',
        bg: '#F0FDF4',
        border: '#BBF7D0',
        color: '#16A34A',
        Icon: ArrowRightLeft,
      };
    }
    return {
      label: 'Direct Pannel Bank',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      color: '#2563EB',
      Icon: Building2,
    };
  };

  const catInfo = getCategoryInfo();
  const CategoryIcon = catInfo.Icon;

  return (
    <View style={styles.container}>
      {/* 1. HERO BANK PROFILE CARD */}
      <View style={styles.heroCard}>
        <View style={[styles.heroAccent, { backgroundColor: catInfo.color }]} />

        <View style={styles.heroBody}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: catInfo.bg, borderColor: catInfo.border }]}>
              <CategoryIcon size={24} color={catInfo.color} strokeWidth={2.2} />
            </View>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroBankName} numberOfLines={2}>
                {bank.name}
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={[styles.categoryDot, { backgroundColor: catInfo.color }]} />
                <Text style={[styles.heroCategoryText, { color: catInfo.color }]}>
                  {catInfo.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Branch Address */}
          {!!bank.branchAddress && (
            <View style={styles.addressRow}>
              <MapPin size={14} color="#94A3B8" strokeWidth={2.2} style={{ marginTop: 1 }} />
              <Text style={styles.addressText} numberOfLines={2}>
                {bank.branchAddress}
              </Text>
            </View>
          )}

          {/* Contact Details */}
          {(bank.customerCarePhone || bank.customerCareEmail) && (
            <View style={styles.contactRow}>
              {!!bank.customerCarePhone && (
                <TouchableOpacity
                  style={styles.contactChip}
                  onPress={() => handleCall(bank.customerCarePhone!)}
                  activeOpacity={0.7}
                >
                  <Phone size={13} color="#059669" strokeWidth={2.4} />
                  <Text style={styles.contactChipText}>{bank.customerCarePhone}</Text>
                </TouchableOpacity>
              )}
              {!!bank.customerCareEmail && (
                <TouchableOpacity
                  style={[styles.contactChip, styles.contactChipFlex]}
                  onPress={() => handleEmail(bank.customerCareEmail!)}
                  activeOpacity={0.7}
                >
                  <Mail size={13} color="#2563EB" strokeWidth={2.4} />
                  <Text style={[styles.contactChipText, { color: '#2563EB' }]} numberOfLines={1}>
                    {bank.customerCareEmail}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Policy & Rules Strip */}
          <View style={styles.policyStrip}>
            <View style={styles.policyItem}>
              <Clock size={13} color="#94A3B8" strokeWidth={2.4} />
              <Text style={styles.policyItemLabel}>Free Waiver</Text>
              <Text style={styles.policyItemValue}>
                {bank.parkingWaiverDays && bank.parkingWaiverDays > 0
                  ? `${bank.parkingWaiverDays} Days`
                  : 'None (0d)'}
              </Text>
            </View>
            <View style={styles.policyDivider} />
            <View style={styles.policyItem}>
              <UserCheck size={13} color="#94A3B8" strokeWidth={2.4} />
              <Text style={styles.policyItemLabel}>Charges Payer</Text>
              <Text
                style={[
                  styles.policyItemValue,
                  { color: bank.parkingPayer === 'BANK' ? '#047857' : '#2563EB' },
                ]}
              >
                {bank.parkingPayer === 'BANK' ? 'Bank Pays' : 'Customer Pays'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. 3-PHASE TARIFF RATE TABLE */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>3-Phase Parking Rates</Text>
          <Text style={styles.sectionSubtitle}>Daily Tariff (₹/day)</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableCornerLabel}>Vehicle</Text>
            {RATE_PHASES.map(phase => (
              <View key={phase.key} style={styles.tableHeaderCell}>
                <View style={[styles.legendDot, { backgroundColor: phase.dot }]} />
                <Text style={styles.tableHeaderText}>{phase.short}</Text>
              </View>
            ))}
          </View>

          {VEHICLE_TYPES.map((type, idx) => {
            const match = bank.parkingRates?.find(r => {
              const vt = (r.vehicleType || '').toUpperCase();
              if (type === 'TW') return vt === 'TW' || vt === 'TWO_WHEELER' || vt === '2W';
              if (type === 'THREE_W') return vt === 'THREE_W' || vt === 'THREE_WHEELER' || vt === '3W';
              if (type === 'FW') return vt === 'FW' || vt === 'FOUR_WHEELER' || vt === '4W';
              if (type === 'CV') return vt === 'CV' || vt === 'COMMERCIAL' || vt === 'COMMERCIAL_VEHICLE';
              return vt === type;
            });

            return (
              <View
                key={type}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
              >
                <View style={styles.tableRowLabel}>
                  <Text style={styles.tableRowTitle} numberOfLines={1}>
                    {TYPE_SHORT_LABELS[type]}
                  </Text>
                  <Text style={styles.tableRowSubtitle} numberOfLines={1}>
                    {TYPE_LABELS[type]}
                  </Text>
                </View>
                {RATE_PHASES.map(phase => {
                  let value = match ? (match as any)?.[phase.key] ?? match?.dailyRate : undefined;

                  // Fallback to bank-level flat rate if vehicle-specific rate row is absent or null
                  if (value === undefined || value === null) {
                    if (phase.key === 'kachhaRate') {
                      value = bank.kachhaParkingRate;
                    } else if (phase.key === 'pakkaRate') {
                      value = bank.pakkaParkingRate;
                    } else if (phase.key === 'releaseOrderRate') {
                      value = bank.releaseOrderParkingRate;
                    }
                  }

                  const hasValue = value !== undefined && value !== null && value !== '';
                  return (
                    <View key={phase.key} style={styles.tableValueCell}>
                      <Text style={[styles.tableValueText, { color: phase.color }]}>
                        {hasValue ? `₹${value}` : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </View>

      {/* 3. SUB-BANKS SECTION (FOR 3RD PARTY NETWORKS) */}
      {isThirdParty && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connected Sub-Banks</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{subBanks.length}</Text>
            </View>
          </View>

          {subBanks.length > 0 ? (
            <View style={styles.subBanksList}>
              {subBanks.map((sub, index) => (
                <View key={sub.id || index} style={styles.subBankItem}>
                  <View style={styles.subBankIcon}>
                    <Building size={16} color="#475569" strokeWidth={2.2} />
                  </View>
                  <View style={styles.subBankContent}>
                    <Text style={styles.subBankName} numberOfLines={1}>
                      {sub.name}
                    </Text>
                    {!!sub.branchAddress && (
                      <Text style={styles.subBankAddress} numberOfLines={1}>
                        {sub.branchAddress}
                      </Text>
                    )}
                    {!!sub.customerCarePhone && (
                      <TouchableOpacity
                        onPress={() => handleCall(sub.customerCarePhone!)}
                        style={styles.subBankPhoneRow}
                        hitSlop={{ top: 4, bottom: 4 }}
                      >
                        <Phone size={11} color="#059669" />
                        <Text style={styles.subBankPhoneText}>{sub.customerCarePhone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {canManage ? (
                    <View style={styles.subBankActions}>
                      <TouchableOpacity
                        style={styles.subActionBtn}
                        onPress={() => onEdit?.(sub)}
                        activeOpacity={0.7}
                      >
                        <Edit3 size={14} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subActionBtn, styles.subDeleteBtn]}
                        onPress={() => onDelete?.(sub)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={14} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <ChevronRight size={16} color="#CBD5E1" />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptySubState}>
              <Text style={styles.emptySubText}>
                No sub-banks registered under this network yet.
              </Text>
            </View>
          )}

          {canManage && (
            <TouchableOpacity
              style={styles.addSubBtn}
              onPress={() => onAddSubBank?.(bank)}
              activeOpacity={0.8}
            >
              <Plus size={15} color="#D97706" strokeWidth={2.6} />
              <Text style={styles.addSubBtnText}>Add Sub-Bank</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 4. MANAGEMENT ACTIONS */}
      {canManage && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editMainButton}
            onPress={() => onEdit?.(bank)}
            activeOpacity={0.85}
          >
            <Edit3 size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.editMainButtonText}>Edit Bank & Rates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteMainButton}
            onPress={() => onDelete?.(bank)}
            activeOpacity={0.85}
          >
            <Trash2 size={17} color="#E11D48" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 24,
  },

  // 1. Hero
  heroCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  heroAccent: {
    width: 4,
  },
  heroBody: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroBankName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroCategoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactChipFlex: {
    flex: 1,
    minWidth: 140,
  },
  contactChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  policyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
  },
  policyItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  policyDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  policyItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  policyItemValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Section shell — reused by rate table + sub-banks
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
  },

  // 2. Rate table
  table: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCornerLabel: {
    flex: 1.3,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableHeaderCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tableHeaderText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFC',
  },
  tableRowLabel: {
    flex: 1.3,
  },
  tableRowTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableRowSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  tableValueCell: {
    flex: 1,
    alignItems: 'center',
  },
  tableValueText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // 3. Sub-banks
  subBanksList: {
    gap: 8,
    marginBottom: 4,
  },
  subBankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  subBankIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBankContent: {
    flex: 1,
  },
  subBankName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  subBankAddress: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  subBankPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  subBankPhoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  subBankActions: {
    flexDirection: 'row',
    gap: 6,
  },
  subActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subDeleteBtn: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  emptySubState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  addSubBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#D97706',
  },

  // 4. Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editMainButton: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  editMainButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteMainButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});