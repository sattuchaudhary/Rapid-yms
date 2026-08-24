import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import {
  Receipt,
  Calculator,
  Calendar,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  ShieldAlert,
  Percent,
} from 'lucide-react-native';

export interface ParkingChargeProps {
  vehicle: any;
}

function formatDate(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

  // 1. Resolve Key Milestone Dates
  const rawEntry = vehicle.kachhaStartDate || vehicle.entryDate || vehicle.createdAt;
  const entryDate = rawEntry ? new Date(rawEntry) : new Date();

  const rawPakka = vehicle.pakkaDate || vehicle.repoKitDate;
  const pakkaDate = rawPakka ? new Date(rawPakka) : null;

  const rawRO = vehicle.releaseOrderDate;
  const roDate = rawRO ? new Date(rawRO) : null;

  const rawRelease = vehicle.actualReleaseDate || vehicle.release?.releasedAt;
  const isReleased = vehicle.yardStatus === 'RELEASED' || !!rawRelease;
  const releaseDate = rawRelease ? new Date(rawRelease) : new Date();

  // 2. Lookup Rates from Vehicle Bank / Rate Master
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

  // 3. Multi-Phase Calculations
  // Total Days in Yard
  const totalDays = Math.max(1, getDaysDifference(entryDate, releaseDate));

  // --- PHASE 1: KACHHA STAY (Pre-Pakka Hold) ---
  const hasMovedToPakka = !!pakkaDate;
  const kachhaEndDate = pakkaDate || roDate || releaseDate;
  const kachhaDays = getDaysDifference(entryDate, kachhaEndDate);

  // If vehicle moved to Pakka, bank ignores pre-pakka stay -> Unbilled Kachha Loss
  // Rate used for calculating the loss is Pakka Rate (or fallback to Kachha Rate)
  const kachhaValuationRate = pakkaRate > 0 ? pakkaRate : (kachhaRate > 0 ? kachhaRate : 0);
  const kachhaLossAmount = hasMovedToPakka ? kachhaDays * kachhaValuationRate : 0;
  const kachhaDirectBillAmount = !hasMovedToPakka ? kachhaDays * (kachhaRate > 0 ? kachhaRate : pakkaRate) : 0;

  // --- PHASE 2: PAKKA STAY (Bank Recognized In-Yard Period) ---
  const pakkaEndDate = roDate || releaseDate;
  const pakkaDays = hasMovedToPakka ? getDaysDifference(pakkaDate, pakkaEndDate) : 0;
  const pakkaAmount = pakkaDays * pakkaRate;

  // --- PHASE 3: RELEASE ORDER (RO to Gate-Out / Handover) ---
  const hasRO = !!roDate;
  const roGrossDays = hasRO ? getDaysDifference(roDate, releaseDate) : 0;
  const waiverDaysApplied = Math.min(waiverDaysConfig, roGrossDays);
  const roChargeableDays = Math.max(0, roGrossDays - waiverDaysApplied);

  const roGrossAmount = roGrossDays * roRate;
  const waiverLossAmount = waiverDaysApplied * roRate;
  const roNetAmount = roChargeableDays * roRate;

  // --- P&L & Revenue Aggregation ---
  const totalRealizedRevenue = hasMovedToPakka
    ? (pakkaAmount + roNetAmount)
    : kachhaDirectBillAmount;

  const totalYardLoss = kachhaLossAmount; // Pre-pakka hold cost absorbed
  const totalConcessions = waiverLossAmount;

  // Billing ledger values (from vehicle billing or computed)
  const discountAmount = vehicle.billing?.discountAmount || 0;
  const netPayable = Math.max(0, vehicle.billing?.finalAmount ?? (totalRealizedRevenue - discountAmount));
  const paidAmount = vehicle.billing?.paidAmount || (isReleased ? netPayable : 0);
  const dueAmount = Math.max(0, netPayable - paidAmount);

  const paymentStatus =
    vehicle.billing?.paymentStatus ||
    (isReleased ? 'PAID' : dueAmount === 0 ? 'PAID' : 'PENDING');

  const getPaymentStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'PAID' };
      case 'PARTIAL':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', label: 'PARTIAL' };
      default:
        return { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3', label: 'PENDING' };
    }
  };

  const statusBadge = getPaymentStatusBadge(paymentStatus);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Executive P&L Snapshot Card */}
      <View style={styles.pnlCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleBadgeGroup}>
            <Receipt size={16} color="#0062FF" strokeWidth={2.2} />
            <Text style={styles.cardMainTitle}>Commercial P&L Snapshot</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
          </View>
        </View>

        {/* Realized Billed Amount Banner */}
        <View style={styles.revenueBanner}>
          <View>
            <Text style={styles.revenueBannerLabel}>Realized Billable Revenue</Text>
            <Text style={styles.revenueBannerValue}>₹{netPayable.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.daysPill}>
            <Clock size={12} color="#0062FF" />
            <Text style={styles.daysPillText}>{totalDays} Days Yard Stay</Text>
          </View>
        </View>

        {/* Profit / Loss KPI Tiles */}
        <View style={styles.kpiGrid}>
          {/* Realized Revenue */}
          <View style={[styles.kpiTile, styles.kpiGreen]}>
            <View style={styles.kpiIconLabel}>
              <TrendingUp size={13} color="#059669" strokeWidth={2.5} />
              <Text style={[styles.kpiLabel, { color: '#047857' }]}>Revenue</Text>
            </View>
            <Text style={[styles.kpiAmount, { color: '#065F46' }]}>
              +₹{totalRealizedRevenue.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.kpiSubText}>
              {hasMovedToPakka ? `${pakkaDays + roChargeableDays} Billed Days` : `${kachhaDays} Kachha Days`}
            </Text>
          </View>

          {/* Kachha Loss (Pre-Pakka) */}
          <View style={[styles.kpiTile, styles.kpiRed]}>
            <View style={styles.kpiIconLabel}>
              <TrendingDown size={13} color="#DC2626" strokeWidth={2.5} />
              <Text style={[styles.kpiLabel, { color: '#B91C1C' }]}>Kachha Loss</Text>
            </View>
            <Text style={[styles.kpiAmount, { color: '#991B1B' }]}>
              {kachhaLossAmount > 0 ? `-₹${kachhaLossAmount.toLocaleString('en-IN')}` : '₹0'}
            </Text>
            <Text style={styles.kpiSubText}>
              {kachhaLossAmount > 0 ? `${kachhaDays} Unbilled Days` : 'No Kachha Loss'}
            </Text>
          </View>

          {/* Waiver / Concession */}
          <View style={[styles.kpiTile, styles.kpiAmber]}>
            <View style={styles.kpiIconLabel}>
              <Percent size={13} color="#D97706" strokeWidth={2.5} />
              <Text style={[styles.kpiLabel, { color: '#B45309' }]}>Waiver</Text>
            </View>
            <Text style={[styles.kpiAmount, { color: '#92400E' }]}>
              {waiverLossAmount > 0 ? `-₹${waiverLossAmount.toLocaleString('en-IN')}` : '₹0'}
            </Text>
            <Text style={styles.kpiSubText}>
              {waiverDaysApplied > 0 ? `${waiverDaysApplied} Days Free` : '0 Days'}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Lifecycle Phase-by-Phase Breakdown */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calculator size={15} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Lifecycle Phase-by-Phase Breakdown</Text>
        </View>

        <View style={styles.phasesContainer}>
          {/* PHASE 1: KACHHA STAY */}
          <View style={[styles.phaseBlock, hasMovedToPakka ? styles.phaseBlockLoss : styles.phaseBlockNormal]}>
            <View style={styles.phaseHeaderRow}>
              <View style={styles.phaseTitleGroup}>
                <View style={[styles.phaseIndexPill, { backgroundColor: hasMovedToPakka ? '#FEE2E2' : '#EFF6FF' }]}>
                  <Text style={[styles.phaseIndexText, { color: hasMovedToPakka ? '#DC2626' : '#0062FF' }]}>
                    PHASE 1
                  </Text>
                </View>
                <Text style={styles.phaseName}>Kachha Entry & Pre-Pakka Hold</Text>
              </View>
              {hasMovedToPakka ? (
                <View style={styles.tagLoss}>
                  <Text style={styles.tagLossText}>UNBILLED LOSS</Text>
                </View>
              ) : (
                <View style={styles.tagBilled}>
                  <Text style={styles.tagBilledText}>BILLED</Text>
                </View>
              )}
            </View>

            {/* Date Span */}
            <View style={styles.dateSpanRow}>
              <Calendar size={12} color="#64748B" />
              <Text style={styles.dateSpanText}>
                {formatDate(entryDate)} <ArrowRight size={10} color="#94A3B8" /> {formatDate(kachhaEndDate)}
              </Text>
              <Text style={styles.daysCountText}>({kachhaDays} Days)</Text>
            </View>

            <View style={styles.phaseCalculationRow}>
              <Text style={styles.calculationFormula}>
                {kachhaDays} Days × ₹{kachhaValuationRate}/day
              </Text>
              <Text style={[styles.phaseFinalAmount, { color: hasMovedToPakka ? '#DC2626' : '#059669' }]}>
                {hasMovedToPakka ? `-₹${kachhaLossAmount.toLocaleString('en-IN')}` : `+₹${kachhaDirectBillAmount.toLocaleString('en-IN')}`}
              </Text>
            </View>

            {hasMovedToPakka && (
              <View style={styles.lossNoticeBox}>
                <ShieldAlert size={12} color="#B91C1C" />
                <Text style={styles.lossNoticeText}>
                  Bank repo start date is {formatDate(pakkaDate)}. Pre-pakka stay ({kachhaDays} days) is unrecoverable yard loss.
                </Text>
              </View>
            )}
          </View>

          {/* PHASE 2: PAKKA PERIOD */}
          {hasMovedToPakka && (
            <View style={[styles.phaseBlock, styles.phaseBlockNormal]}>
              <View style={styles.phaseHeaderRow}>
                <View style={styles.phaseTitleGroup}>
                  <View style={[styles.phaseIndexPill, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.phaseIndexText, { color: '#059669' }]}>PHASE 2</Text>
                  </View>
                  <Text style={styles.phaseName}>Pakka In-Yard Period</Text>
                </View>
                <View style={styles.tagBilled}>
                  <Text style={styles.tagBilledText}>BANK CHARGEABLE</Text>
                </View>
              </View>

              <View style={styles.dateSpanRow}>
                <Calendar size={12} color="#64748B" />
                <Text style={styles.dateSpanText}>
                  {formatDate(pakkaDate)} <ArrowRight size={10} color="#94A3B8" /> {formatDate(pakkaEndDate)}
                </Text>
                <Text style={styles.daysCountText}>({pakkaDays} Days)</Text>
              </View>

              <View style={styles.phaseCalculationRow}>
                <Text style={styles.calculationFormula}>
                  {pakkaDays} Days × ₹{pakkaRate}/day
                </Text>
                <Text style={[styles.phaseFinalAmount, { color: '#059669' }]}>
                  +₹{pakkaAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}

          {/* PHASE 3: RELEASE ORDER (RO) PERIOD */}
          {hasRO && (
            <View style={[styles.phaseBlock, styles.phaseBlockNormal]}>
              <View style={styles.phaseHeaderRow}>
                <View style={styles.phaseTitleGroup}>
                  <View style={[styles.phaseIndexPill, { backgroundColor: '#F5F3FF' }]}>
                    <Text style={[styles.phaseIndexText, { color: '#7C3AED' }]}>PHASE 3</Text>
                  </View>
                  <Text style={styles.phaseName}>RO to Handover / Release</Text>
                </View>
                <View style={styles.tagBilled}>
                  <Text style={styles.tagBilledText}>CUSTOMER / BUYER</Text>
                </View>
              </View>

              <View style={styles.dateSpanRow}>
                <Calendar size={12} color="#64748B" />
                <Text style={styles.dateSpanText}>
                  {formatDate(roDate)} <ArrowRight size={10} color="#94A3B8" /> {formatDate(releaseDate)}
                </Text>
                <Text style={styles.daysCountText}>({roGrossDays} Days)</Text>
              </View>

              <View style={styles.roSubLedger}>
                <View style={styles.roSubRow}>
                  <Text style={styles.roSubLabel}>Gross RO Stay ({roGrossDays} Days × ₹{roRate})</Text>
                  <Text style={styles.roSubValue}>₹{roGrossAmount.toLocaleString('en-IN')}</Text>
                </View>

                {waiverDaysApplied > 0 && (
                  <View style={styles.roSubRow}>
                    <Text style={[styles.roSubLabel, { color: '#D97706' }]}>
                      Bank Free Waiver ({waiverDaysApplied} Days)
                    </Text>
                    <Text style={[styles.roSubValue, { color: '#D97706' }]}>
                      -₹{waiverLossAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}

                <View style={styles.roDivider} />

                <View style={styles.phaseCalculationRow}>
                  <Text style={styles.calculationFormula}>
                    Net RO ({roChargeableDays} Chargeable Days)
                  </Text>
                  <Text style={[styles.phaseFinalAmount, { color: '#059669' }]}>
                    +₹{roNetAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 3. Settlement & Payment Breakdown */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <CreditCard size={15} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Settlement & Account Ledger</Text>
        </View>

        <View style={styles.ledgerContent}>
          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Total Realized Revenue</Text>
            <Text style={styles.ledgerValueBold}>₹{totalRealizedRevenue.toLocaleString('en-IN')}</Text>
          </View>

          {discountAmount > 0 && (
            <>
              <View style={styles.ledgerDivider} />
              <View style={styles.ledgerRow}>
                <Text style={[styles.ledgerLabel, { color: '#059669' }]}>Discount Concession</Text>
                <Text style={[styles.ledgerValue, { color: '#059669' }]}>
                  -₹{discountAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.netTotalLabel}>Net Receivable Amount</Text>
            <Text style={styles.netTotalValue}>₹{netPayable.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Amount Collected / Paid</Text>
            <Text style={[styles.ledgerValueBold, { color: '#059669' }]}>
              ₹{paidAmount.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Outstanding Balance</Text>
            <Text style={[styles.ledgerValueBold, { color: dueAmount > 0 ? '#DC2626' : '#059669' }]}>
              ₹{dueAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 40,
    gap: 12,
  },
  pnlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMainTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  revenueBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  revenueBannerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  revenueBannerValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  daysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  daysPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiTile: {
    flex: 1,
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
  },
  kpiGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  kpiRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  kpiAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  kpiIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiAmount: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 1,
  },
  kpiSubText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  phasesContainer: {
    padding: 10,
    gap: 10,
  },
  phaseBlock: {
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
  },
  phaseBlockNormal: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E2E8F0',
  },
  phaseBlockLoss: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECDD3',
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  phaseTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseIndexPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  phaseIndexText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  phaseName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tagLoss: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagLossText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  tagBilled: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBilledText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  dateSpanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  dateSpanText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  daysCountText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
  },
  phaseCalculationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calculationFormula: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  phaseFinalAmount: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  lossNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    padding: 7,
    marginTop: 8,
  },
  lossNoticeText: {
    fontSize: 10,
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
  },
  roSubLedger: {
    marginTop: 4,
    gap: 4,
  },
  roSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roSubLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  roSubValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  roDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
  },
  ledgerContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  ledgerLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  ledgerValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  ledgerValueBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  netTotalLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  netTotalValue: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0062FF',
  },
});
