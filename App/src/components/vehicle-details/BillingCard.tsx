import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DollarSign, Clock, Calendar } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { ParkingCalculation } from './types';

interface BillingCardProps {
  dailyRate: number;
  totalDays: number;
  totalCharges: number;
  parkingCalculation?: ParkingCalculation | null;
}

export function BillingCard({
  dailyRate,
  totalDays,
  totalCharges,
  parkingCalculation,
}: BillingCardProps) {
  return (
    <View style={styles.card}>
      {/* Prominent Outstanding Hero Box */}
      <View style={styles.dueHeroBox}>
        <ThemedText style={styles.dueHeroLabel}>CURRENT OUTSTANDING DUE</ThemedText>
        <ThemedText style={styles.dueHeroAmount}>
          ₹{totalCharges.toLocaleString('en-IN')}
        </ThemedText>
        <View style={styles.ratePillRow}>
          <View style={styles.ratePill}>
            <DollarSign size={12} color="#16A34A" />
            <ThemedText style={styles.ratePillText}>₹{dailyRate}/day</ThemedText>
          </View>

          <View style={styles.ratePill}>
            <Clock size={12} color="#4F46E5" />
            <ThemedText style={styles.ratePillText}>{totalDays} Days Stayed</ThemedText>
          </View>
        </View>
      </View>

      {/* Phase Timeline Breakdown */}
      {parkingCalculation?.phaseBreakdown ? (
        <View style={styles.timelineSection}>
          <ThemedText style={styles.timelineTitle}>Billing Timeline & Phases</ThemedText>

          <View style={styles.timelineContainer}>
            {/* Kachha Phase */}
            <View style={styles.phaseRow}>
              <View style={styles.phaseDotAmber} />
              <View style={styles.phaseContent}>
                <ThemedText style={styles.phaseName}>Kachha Phase (Audit / Pending)</ThemedText>
                <ThemedText style={styles.phaseSub}>
                  {parkingCalculation.phaseBreakdown.kachhaDays || 0} Days • ₹
                  {parkingCalculation.phaseBreakdown.kachhaCharge || 0}
                </ThemedText>
              </View>
            </View>

            <View style={styles.phaseConnector} />

            {/* Pakka Phase */}
            <View style={styles.phaseRow}>
              <View style={styles.phaseDotGreen} />
              <View style={styles.phaseContent}>
                <ThemedText style={styles.phaseName}>Pakka Phase (Active Billing)</ThemedText>
                <ThemedText style={styles.phaseSub}>
                  {parkingCalculation.phaseBreakdown.pakkaDays || 0} Days • ₹
                  {parkingCalculation.phaseBreakdown.pakkaCharge || 0}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.simpleBillingSummary}>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Base Daily Parking Rate</ThemedText>
            <ThemedText style={styles.summaryVal}>₹{dailyRate} / day</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={styles.summaryLabel}>Total Parking Duration</ThemedText>
            <ThemedText style={styles.summaryVal}>{totalDays} Days</ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  dueHeroBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  dueHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  dueHeroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#15803D',
    marginVertical: 4,
  },
  ratePillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  ratePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  timelineSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phaseDotAmber: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
  },
  phaseDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  phaseConnector: {
    width: 2,
    height: 14,
    backgroundColor: '#CBD5E1',
    marginLeft: 5,
    marginVertical: 2,
  },
  phaseContent: {
    flex: 1,
  },
  phaseName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  phaseSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  simpleBillingSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});
