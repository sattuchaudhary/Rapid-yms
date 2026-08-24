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
} from 'lucide-react-native';

export interface ParkingChargeProps {
  vehicle: any;
}

export default function ParkingCharge({ vehicle }: ParkingChargeProps) {
  if (!vehicle) return null;

  // Calculate live stay days
  const entryDate = vehicle.entryDate ? new Date(vehicle.entryDate) : (vehicle.createdAt ? new Date(vehicle.createdAt) : new Date());
  const releaseDate = vehicle.release?.releasedAt ? new Date(vehicle.release.releasedAt) : new Date();
  
  const diffTime = Math.max(0, releaseDate.getTime() - entryDate.getTime());
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Lookup rate from vehicle's bank parking rates or bank model
  const vehicleType = vehicle.vehicleType;
  const bankRate = vehicle.bank?.parkingRates?.find?.((r: any) => r.vehicleType === vehicleType);

  const dailyRate =
    (bankRate?.kachhaRate && Number(bankRate.kachhaRate) > 0 && vehicle.yardStatus === 'KACHHA')
      ? Number(bankRate.kachhaRate)
      : (bankRate?.pakkaRate && Number(bankRate.pakkaRate) > 0 && vehicle.yardStatus === 'PAKKA')
      ? Number(bankRate.pakkaRate)
      : (bankRate?.dailyRate && Number(bankRate.dailyRate) > 0)
      ? Number(bankRate.dailyRate)
      : (vehicle.bank?.kachhaParkingRate && Number(vehicle.bank.kachhaParkingRate) > 0 && vehicle.yardStatus === 'KACHHA')
      ? Number(vehicle.bank.kachhaParkingRate)
      : (vehicle.bank?.pakkaParkingRate && Number(vehicle.bank.pakkaParkingRate) > 0 && vehicle.yardStatus === 'PAKKA')
      ? Number(vehicle.bank.pakkaParkingRate)
      : (vehicle.bank?.releaseOrderParkingRate && Number(vehicle.bank.releaseOrderParkingRate) > 0)
      ? Number(vehicle.bank.releaseOrderParkingRate)
      : 0;

  // Gross & Net Calculations
  const grossAmount = vehicle.billing?.grossAmount || (totalDays * dailyRate);
  const discountAmount = vehicle.billing?.discountAmount || 0;
  const waiverDays = vehicle.billing?.waiverDays || 0;
  const waiverAmount = waiverDays * dailyRate;
  const netPayable = Math.max(0, vehicle.billing?.finalAmount ?? (grossAmount - discountAmount - waiverAmount));
  const paidAmount = vehicle.billing?.paidAmount || 0;
  const dueAmount = Math.max(0, netPayable - paidAmount);

  const paymentStatus = vehicle.billing?.paymentStatus || (vehicle.yardStatus === 'RELEASED' ? 'PAID' : dueAmount === 0 ? 'PAID' : 'PENDING');

  const getPaymentStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'PAID' };
      case 'PARTIAL':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', label: 'PARTIAL' };
      default:
        return { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3', label: 'UNPAID' };
    }
  };

  const statusBadge = getPaymentStatusBadge(paymentStatus);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Main Amount Summary Banner */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Total Parking Charges</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
          </View>
        </View>

        <Text style={styles.totalAmountText}>₹{netPayable.toLocaleString('en-IN')}</Text>

        <View style={styles.divider} />

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Days in Yard</Text>
            <Text style={styles.metricValue}>{totalDays} Days</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Daily Rate</Text>
            <Text style={styles.metricValue}>₹{dailyRate}/day</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Due Balance</Text>
            <Text style={[styles.metricValue, { color: dueAmount > 0 ? '#E11D48' : '#059669' }]}>
              ₹{dueAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Calculation Breakdown */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calculator size={16} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Calculation Breakdown</Text>
        </View>

        <View style={styles.cardContent}>
          {/* Formula Note */}
          <View style={styles.formulaBanner}>
            <Text style={styles.formulaText}>
              {totalDays} Days × ₹{dailyRate}/day = ₹{grossAmount.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Base Rate ({vehicleType})</Text>
            <Text style={styles.ledgerValue}>₹{dailyRate} / day</Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Duration</Text>
            <Text style={styles.ledgerValue}>{totalDays} Days</Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Gross Amount</Text>
            <Text style={styles.ledgerValueBold}>₹{grossAmount.toLocaleString('en-IN')}</Text>
          </View>

          {waiverDays > 0 && (
            <>
              <View style={styles.ledgerDivider} />
              <View style={styles.ledgerRow}>
                <Text style={[styles.ledgerLabel, { color: '#059669' }]}>
                  Waiver ({waiverDays} days)
                </Text>
                <Text style={[styles.ledgerValue, { color: '#059669' }]}>
                  - ₹{waiverAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}

          {discountAmount > 0 && (
            <>
              <View style={styles.ledgerDivider} />
              <View style={styles.ledgerRow}>
                <Text style={[styles.ledgerLabel, { color: '#059669' }]}>Discount</Text>
                <Text style={[styles.ledgerValue, { color: '#059669' }]}>
                  - ₹{discountAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}

          <View style={[styles.ledgerDivider, { backgroundColor: '#CBD5E1' }]} />

          <View style={styles.ledgerRow}>
            <Text style={styles.netTotalLabel}>Net Amount</Text>
            <Text style={styles.netTotalValue}>₹{netPayable.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* 3. Settlement Info */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <CreditCard size={16} color="#0062FF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Settlement Details</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Amount Paid</Text>
            <Text style={[styles.ledgerValueBold, { color: '#059669' }]}>
              ₹{paidAmount.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Payer Entity</Text>
            <Text style={styles.ledgerValue}>
              {vehicle.billing?.payer || (vehicle.yardStatus === 'RELEASED' ? 'Customer / Bank' : 'Borrower / Customer')}
            </Text>
          </View>

          <View style={styles.ledgerDivider} />

          <View style={styles.ledgerRow}>
            <Text style={styles.ledgerLabel}>Payment Mode</Text>
            <Text style={styles.ledgerValue}>{vehicle.billing?.paymentMode || 'Cash / Online'}</Text>
          </View>
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
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
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
  totalAmountText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#F1F5F9',
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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  formulaBanner: {
    backgroundColor: '#EFF6FF',
    padding: 9,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  formulaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  ledgerLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  ledgerValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  ledgerValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  netTotalLabel: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  netTotalValue: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0062FF',
  },
});
