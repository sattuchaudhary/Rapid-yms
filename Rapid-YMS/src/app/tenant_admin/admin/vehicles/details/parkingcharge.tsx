import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import {
  Calculator,
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react-native';

export interface ParkingChargeProps {
  vehicle: any;
}

function formatDate(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function getDaysDifference(start: Date | null, end: Date | null): number {
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function ParkingCharge({ vehicle }: ParkingChargeProps) {
  if (!vehicle) return null;

  // 1. Resolve Milestone Dates
  const rawEntry = vehicle.kachhaStartDate || vehicle.entryDate || vehicle.createdAt;
  const entryDate = rawEntry ? new Date(rawEntry) : new Date();

  const rawPakka = vehicle.pakkaDate || vehicle.repoKitDate;
  const pakkaDate = rawPakka ? new Date(rawPakka) : null;

  const rawRO = vehicle.releaseOrderDate;
  const roDate = rawRO ? new Date(rawRO) : null;

  const rawRelease = vehicle.actualReleaseDate || vehicle.release?.releasedAt;
  const isReleased = vehicle.yardStatus === 'RELEASED' || !!rawRelease;
  const releaseDate = rawRelease ? new Date(rawRelease) : new Date();

  // 2. Lookup Rates
  const vehicleType = vehicle.vehicleType || 'FW';
  const bankRate = vehicle.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vehicleType);

  const kachhaRate =
    (bankRate?.kachhaRate && Number(bankRate.kachhaRate) > 0)
      ? Number(bankRate.kachhaRate)
      : (vehicle.bank?.kachhaParkingRate && Number(vehicle.bank.kachhaParkingRate) > 0)
      ? Number(vehicle.bank.kachhaParkingRate)
      : (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0)
      ? Number(bankRate.dailyRate)
      : 0;

  const pakkaRate =
    (bankRate?.pakkaRate && Number(bankRate.pakkaRate) > 0)
      ? Number(bankRate.pakkaRate)
      : (vehicle.bank?.pakkaParkingRate && Number(vehicle.bank.pakkaParkingRate) > 0)
      ? Number(vehicle.bank.pakkaParkingRate)
      : (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0)
      ? Number(bankRate.dailyRate)
      : 0;

  const roRate =
    (bankRate?.releaseOrderRate && Number(bankRate.releaseOrderRate) > 0)
      ? Number(bankRate.releaseOrderRate)
      : (vehicle.bank?.releaseOrderParkingRate && Number(vehicle.bank.releaseOrderParkingRate) > 0)
      ? Number(vehicle.bank.releaseOrderParkingRate)
      : pakkaRate || (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0 ? Number(bankRate.dailyRate) : 0);

  const waiverDaysConfig = vehicle.bank?.parkingWaiverDays || 0;

  // 3. Phase Calculations
  const totalDays = Math.max(1, getDaysDifference(entryDate, releaseDate));

  // Phase 1: Kachha
  const hasMovedToPakka = !!pakkaDate;
  const kachhaEndDate = pakkaDate || roDate || releaseDate;
  const kachhaDays = getDaysDifference(entryDate, kachhaEndDate);
  const kachhaValuationRate = pakkaRate > 0 ? pakkaRate : (kachhaRate > 0 ? kachhaRate : 0);
  const kachhaLossAmount = hasMovedToPakka ? kachhaDays * kachhaValuationRate : 0;
  const kachhaDirectBill = !hasMovedToPakka ? kachhaDays * (kachhaRate > 0 ? kachhaRate : pakkaRate) : 0;

  // Phase 2: Pakka
  const pakkaEndDate = roDate || releaseDate;
  const pakkaDays = hasMovedToPakka ? getDaysDifference(pakkaDate, pakkaEndDate) : 0;
  const pakkaAmount = pakkaDays * pakkaRate;

  // Phase 3: Release Order (RO)
  const hasRO = !!roDate;
  const roGrossDays = hasRO ? getDaysDifference(roDate, releaseDate) : 0;
  const waiverDaysApplied = Math.min(waiverDaysConfig, roGrossDays);
  const roChargeableDays = Math.max(0, roGrossDays - waiverDaysApplied);
  const waiverLossAmount = waiverDaysApplied * roRate;
  const roNetAmount = roChargeableDays * roRate;

  // Totals
  const totalBillableAmount = hasMovedToPakka ? (pakkaAmount + roNetAmount) : kachhaDirectBill;
  const discountAmount = vehicle.billing?.discountAmount || 0;
  const netPayable = Math.max(0, vehicle.billing?.finalAmount ?? (totalBillableAmount - discountAmount));
  const paidAmount = vehicle.billing?.paidAmount || (isReleased ? netPayable : 0);
  const dueAmount = Math.max(0, netPayable - paidAmount);

  const paymentStatus = vehicle.billing?.paymentStatus || (isReleased ? 'PAID' : dueAmount === 0 ? 'PAID' : 'PENDING');

  const getStatusBadge = (st: string) => {
    switch (st.toUpperCase()) {
      case 'PAID':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'PAID' };
      case 'PARTIAL':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', label: 'PARTIAL' };
      default:
        return { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3', label: 'PENDING' };
    }
  };

  const badge = getStatusBadge(paymentStatus);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Header Total Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTitle}>PARKING SUMMARY</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalAmount}>₹{netPayable.toLocaleString('en-IN')}</Text>
          <View style={styles.pill}>
            <Clock size={11} color="#64748B" />
            <Text style={styles.pillText}>{totalDays} Days Total</Text>
          </View>
        </View>

        {/* Quick Loss vs Profit summary banner */}
        {hasMovedToPakka && kachhaLossAmount > 0 && (
          <View style={styles.lossAlertBar}>
            <TrendingDown size={13} color="#DC2626" />
            <Text style={styles.lossAlertText}>
              Kachha Loss: <Text style={styles.lossBold}>-₹{kachhaLossAmount.toLocaleString('en-IN')}</Text> ({kachhaDays} unbilled days before Pakka)
            </Text>
          </View>
        )}
      </View>

      {/* 2. Clean Phase-by-Phase Timeline Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconTitle}>
            <Calculator size={14} color="#0062FF" />
            <Text style={styles.cardTitle}>Phase Breakdown</Text>
          </View>
        </View>

        <View style={styles.phaseList}>
          {/* Phase 1: Kachha */}
          <View style={styles.phaseItem}>
            <View style={styles.phaseLeft}>
              <View style={[styles.phaseDot, { backgroundColor: hasMovedToPakka ? '#DC2626' : '#0062FF' }]} />
              <View>
                <Text style={styles.phaseTitle}>
                  1. Kachha Stay {hasMovedToPakka ? '(Unbilled Loss)' : '(Billed)'}
                </Text>
                <Text style={styles.phaseDates}>
                  {formatDate(entryDate)} → {formatDate(kachhaEndDate)} • {kachhaDays}d @ ₹{kachhaValuationRate}/d
                </Text>
              </View>
            </View>
            <Text style={[styles.phaseAmount, { color: hasMovedToPakka ? '#DC2626' : '#059669' }]}>
              {hasMovedToPakka ? `-₹${kachhaLossAmount.toLocaleString('en-IN')}` : `+₹${kachhaDirectBill.toLocaleString('en-IN')}`}
            </Text>
          </View>

          {/* Phase 2: Pakka */}
          {hasMovedToPakka && (
            <>
              <View style={styles.divider} />
              <View style={styles.phaseItem}>
                <View style={styles.phaseLeft}>
                  <View style={[styles.phaseDot, { backgroundColor: '#059669' }]} />
                  <View>
                    <Text style={styles.phaseTitle}>2. Pakka Stay (Bank Billed)</Text>
                    <Text style={styles.phaseDates}>
                      {formatDate(pakkaDate)} → {formatDate(pakkaEndDate)} • {pakkaDays}d @ ₹{pakkaRate}/d
                    </Text>
                  </View>
                </View>
                <Text style={[styles.phaseAmount, { color: '#059669' }]}>
                  +₹{pakkaAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}

          {/* Phase 3: Release Order */}
          {hasRO && (
            <>
              <View style={styles.divider} />
              <View style={styles.phaseItem}>
                <View style={styles.phaseLeft}>
                  <View style={[styles.phaseDot, { backgroundColor: '#7C3AED' }]} />
                  <View>
                    <Text style={styles.phaseTitle}>3. RO to Release</Text>
                    <Text style={styles.phaseDates}>
                      {formatDate(roDate)} → {formatDate(releaseDate)} • {roChargeableDays}d @ ₹{roRate}/d
                      {waiverDaysApplied > 0 ? ` (${waiverDaysApplied}d free)` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.phaseAmount, { color: '#059669' }]}>
                  +₹{roNetAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 3. Clean Settlement Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconTitle}>
            <CreditCard size={14} color="#0062FF" />
            <Text style={styles.cardTitle}>Settlement Details</Text>
          </View>
        </View>

        <View style={styles.ledgerList}>
          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Total Billed Revenue</Text>
            <Text style={styles.ledgerVal}>₹{totalBillableAmount.toLocaleString('en-IN')}</Text>
          </View>

          {discountAmount > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.ledgerRow}>
                <Text style={[styles.ledgerLabel, { color: '#059669' }]}>Discount</Text>
                <Text style={[styles.ledgerVal, { color: '#059669' }]}>-₹{discountAmount.toLocaleString('en-IN')}</Text>
              </View>
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabelBold}>Net Payable</Text>
            <Text style={styles.ledgerValBold}>₹{netPayable.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.divider} />
          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Amount Paid</Text>
            <Text style={[styles.ledgerVal, { color: '#059669' }]}>₹{paidAmount.toLocaleString('en-IN')}</Text>
          </View>

          {dueAmount > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.ledgerRow}>
                <Text style={[styles.ledgerLabel, { color: '#DC2626' }]}>Balance Due</Text>
                <Text style={[styles.ledgerValBold, { color: '#DC2626' }]}>₹{dueAmount.toLocaleString('en-IN')}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  iconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  lossAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  lossAlertText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '500',
    flex: 1,
  },
  lossBold: {
    fontWeight: '800',
    color: '#DC2626',
  },
  phaseList: {
    gap: 8,
  },
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  phaseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  phaseDates: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  phaseAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  ledgerList: {
    gap: 6,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  ledgerLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  ledgerVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  ledgerLabelBold: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  ledgerValBold: {
    fontSize: 14,
    color: '#0062FF',
    fontWeight: '900',
  },
});
