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
  MapPin,
  Phone,
  Mail,
  Settings,
  Trash2,
  Clock,
  UserCheck,
  Truck,
} from 'lucide-react-native';
import { Bank, VEHICLE_TYPES, TYPE_SHORT_LABELS } from '../types';

export interface BankCardProps {
  bank: Bank;
  onEdit?: (bank: Bank) => void;
  onDelete?: (bank: Bank) => void;
  canManage?: boolean;
}

export default function BankCard({
  bank,
  onEdit,
  onDelete,
  canManage = true,
}: BankCardProps) {
  const isShift = bank.isShiftBank || bank.bankCategory === 'SHIFT_BANK';

  const handleCall = (phone: string) => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleEmail = (email: string) => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, isShift ? styles.shiftIconWrap : styles.directIconWrap]}>
          {isShift ? (
            <Truck size={17} color="#16A34A" strokeWidth={2.4} />
          ) : (
            <Building2 size={17} color="#0062FF" strokeWidth={2.4} />
          )}
        </View>

        <View style={styles.titleArea}>
          <View style={styles.titleRow}>
            <Text style={styles.bankName} numberOfLines={1}>
              {bank.name}
            </Text>
            <View style={[styles.typeBadge, isShift ? styles.shiftBadge : styles.directBadge]}>
              <Text style={isShift ? styles.shiftBadgeText : styles.directBadgeText}>
                {isShift ? 'Shift Bank' : 'Direct Bank'}
              </Text>
            </View>
          </View>

          {/* Badges: Waiver days & Payer */}
          <View style={styles.tagsRow}>
            {bank.parkingWaiverDays !== undefined && (
              <View style={styles.waiverTag}>
                <Clock size={11} color="#64748B" strokeWidth={2} />
                <Text style={styles.waiverText}>
                  {bank.parkingWaiverDays > 0
                    ? `${bank.parkingWaiverDays}d Free Waiver`
                    : 'No Waiver'}
                </Text>
              </View>
            )}

            <View style={[styles.payerTag, bank.parkingPayer === 'BANK' ? styles.bankPayerTag : styles.customerPayerTag]}>
              <UserCheck size={11} color={bank.parkingPayer === 'BANK' ? '#047857' : '#0062FF'} strokeWidth={2} />
              <Text style={bank.parkingPayer === 'BANK' ? styles.bankPayerText : styles.customerPayerText}>
                {bank.parkingPayer === 'BANK' ? 'Bank Pays' : 'Customer Pays'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {canManage && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onEdit?.(bank)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Edit Bank"
            >
              <Settings size={16} color="#475569" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => onDelete?.(bank)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete Bank"
            >
              <Trash2 size={16} color="#E11D48" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Address if present */}
      {!!bank.branchAddress && (
        <View style={styles.addressRow}>
          <MapPin size={13} color="#64748B" strokeWidth={2} style={{ marginTop: 1 }} />
          <Text style={styles.addressText} numberOfLines={2}>
            {bank.branchAddress}
          </Text>
        </View>
      )}

      {/* Contact Quick Buttons */}
      {(bank.customerCarePhone || bank.customerCareEmail) && (
        <View style={styles.contactRow}>
          {!!bank.customerCarePhone && (
            <TouchableOpacity
              style={styles.contactPill}
              onPress={() => handleCall(bank.customerCarePhone!)}
              activeOpacity={0.7}
            >
              <Phone size={12} color="#059669" strokeWidth={2.2} />
              <Text style={styles.phoneText}>{bank.customerCarePhone}</Text>
            </TouchableOpacity>
          )}

          {!!bank.customerCareEmail && (
            <TouchableOpacity
              style={styles.contactPill}
              onPress={() => handleEmail(bank.customerCareEmail!)}
              activeOpacity={0.7}
            >
              <Mail size={12} color="#2563EB" strokeWidth={2.2} />
              <Text style={styles.emailText} numberOfLines={1}>
                {bank.customerCareEmail}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3-Phase Parking Rates Grid */}
      <View style={styles.ratesSection}>
        <View style={styles.ratesSectionHeader}>
          <Text style={styles.ratesSectionTitle}>3-Phase Parking Rates (₹/day)</Text>
          <View style={styles.ratesLegendRow}>
            <View style={styles.legendDotKachha} />
            <Text style={styles.legendText}>Kachha</Text>
            <View style={styles.legendDotPakka} />
            <Text style={styles.legendText}>Pakka</Text>
            <View style={styles.legendDotRO} />
            <Text style={styles.legendText}>After RO</Text>
          </View>
        </View>

        <View style={styles.ratesGrid}>
          {VEHICLE_TYPES.map(type => {
            const match = bank.parkingRates?.find(r => r.vehicleType === type);
            const kachha = match?.kachhaRate ?? match?.dailyRate ?? '-';
            const pakka = match?.pakkaRate ?? match?.dailyRate ?? '-';
            const ro = match?.releaseOrderRate ?? match?.dailyRate ?? '-';

            return (
              <View key={type} style={styles.rateBox}>
                <Text style={styles.rateTypeLabel}>{TYPE_SHORT_LABELS[type]}</Text>
                <View style={styles.rateValuesColumn}>
                  <View style={styles.rateMiniRow}>
                    <Text style={styles.kachhaVal}>₹{kachha}</Text>
                  </View>
                  <View style={styles.rateMiniRow}>
                    <Text style={styles.pakkaVal}>₹{pakka}</Text>
                  </View>
                  <View style={styles.rateMiniRow}>
                    <Text style={styles.roVal}>₹{ro}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  directIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  shiftIconWrap: {
    backgroundColor: '#F0FDF4',
  },
  titleArea: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  bankName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  directBadge: {
    backgroundColor: '#EFF6FF',
  },
  directBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },
  shiftBadge: {
    backgroundColor: '#DCFCE7',
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  waiverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  waiverText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  payerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customerPayerTag: {
    backgroundColor: '#EFF6FF',
  },
  customerPayerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },
  bankPayerTag: {
    backgroundColor: '#ECFDF5',
  },
  bankPayerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  phoneText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  emailText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2563EB',
    maxWidth: 180,
  },
  ratesSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ratesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  ratesLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDotKachha: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  legendDotPakka: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  legendDotRO: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0062FF',
  },
  legendText: {
    fontSize: 9.5,
    color: '#64748B',
    marginRight: 4,
  },
  ratesGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  rateBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  rateTypeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  rateValuesColumn: {
    width: '100%',
    gap: 2,
    alignItems: 'center',
  },
  rateMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kachhaVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  pakkaVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  roVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0062FF',
  },
});
