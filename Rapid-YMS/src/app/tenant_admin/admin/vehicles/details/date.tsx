import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import {
  Calendar,
  Clock,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  Truck,
  ArrowRight,
  Hourglass,
  Timer,
  FileText,
  Sparkles,
} from 'lucide-react-native';

export interface VehicleDateTimelineProps {
  vehicle: any;
}

interface TimelineEvent {
  id: string;
  title: string;
  stageNumber: number;
  date?: string | Date | null;
  statusLabel: string;
  statusType: 'completed' | 'active' | 'pending';
  icon: any;
  description: string;
}

export default function VehicleDateTimeline({ vehicle }: VehicleDateTimelineProps) {
  if (!vehicle) return null;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return null;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return null;

    const fullDateStr = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const timeStr = dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return { fullDateStr, timeStr, raw: dateObj };
  };

  // Calculate Days in Yard
  const daysInYard = useMemo(() => {
    const entry = vehicle.entryDate || vehicle.createdAt;
    if (!entry) return 0;
    const entryTime = new Date(entry).getTime();
    if (isNaN(entryTime)) return 0;

    const endTime =
      vehicle.yardStatus === 'RELEASED' && vehicle.release?.releasedAt
        ? new Date(vehicle.release.releasedAt).getTime()
        : Date.now();

    const diffDays = Math.max(0, Math.floor((endTime - entryTime) / (1000 * 60 * 60 * 24)));
    return diffDays;
  }, [vehicle]);

  const entryFormatted = formatDate(vehicle.entryDate || vehicle.createdAt);
  const kachhaFormatted = formatDate(vehicle.kachhaStartDate || vehicle.entryDate);
  const repoKitFormatted = formatDate(vehicle.repoKitDate);
  const pakkaFormatted = formatDate(vehicle.pakkaDate);
  const releaseOrderFormatted = formatDate(vehicle.releaseOrderDate);
  const isReleased = vehicle.yardStatus === 'RELEASED';
  const releasedFormatted = formatDate(vehicle.release?.releasedAt || (isReleased ? vehicle.updatedAt : null));

  const events: TimelineEvent[] = useMemo(() => {
    return [
      {
        id: 'entry',
        stageNumber: 1,
        title: 'Yard Gate Entry',
        date: vehicle.entryDate || vehicle.createdAt,
        statusLabel: 'LOGGED',
        statusType: 'completed',
        icon: Calendar,
        description: 'Vehicle arrived at yard and security gate log created',
      },
      {
        id: 'kachha',
        stageNumber: 2,
        title: 'Kachha Holding Phase',
        date: vehicle.kachhaStartDate || vehicle.entryDate,
        statusLabel: 'ACTIVE',
        statusType: 'completed',
        icon: Clock,
        description: 'Initial intake phase & condition inspection started',
      },
      {
        id: 'repoKit',
        stageNumber: 3,
        title: 'Repo Kit Documentation',
        date: vehicle.repoKitDate,
        statusLabel: repoKitFormatted ? 'VERIFIED' : 'PENDING',
        statusType: repoKitFormatted ? 'completed' : vehicle.yardStatus === 'KACHHA' ? 'active' : 'pending',
        icon: FileText,
        description: repoKitFormatted
          ? 'NOC, inventory sheets & repo kit paperwork registered'
          : 'Pending repo kit documentation submission from bank',
      },
      {
        id: 'pakka',
        stageNumber: 4,
        title: 'Pakka Yard Conversion',
        date: vehicle.pakkaDate,
        statusLabel: pakkaFormatted ? 'CONVERTED' : 'PENDING',
        statusType: pakkaFormatted ? 'completed' : vehicle.yardStatus === 'KACHHA' ? 'pending' : 'active',
        icon: ShieldCheck,
        description: pakkaFormatted
          ? 'Vehicle confirmed in regular Pakka Yard inventory'
          : 'Awaiting completion of all mandatory intake documents',
      },
      {
        id: 'releaseOrder',
        stageNumber: 5,
        title: 'Bank Release Order',
        date: vehicle.releaseOrderDate,
        statusLabel: releaseOrderFormatted ? 'ISSUED' : 'NOT ISSUED',
        statusType: releaseOrderFormatted ? 'completed' : isReleased ? 'completed' : 'pending',
        icon: FileCheck,
        description: releaseOrderFormatted
          ? 'Release authorization order sanctioned by financer'
          : 'Release authorization pending bank confirmation',
      },
      {
        id: 'released',
        stageNumber: 6,
        title: 'Final Vehicle Release',
        date: vehicle.release?.releasedAt || (isReleased ? vehicle.updatedAt : null),
        statusLabel: isReleased ? 'HANDED OVER' : 'IN YARD',
        statusType: isReleased ? 'completed' : 'pending',
        icon: CheckCircle2,
        description: isReleased
          ? 'Handover completed, gate pass generated and vehicle exited yard'
          : 'Vehicle is currently safe and stationed inside yard premises',
      },
    ];
  }, [vehicle, repoKitFormatted, pakkaFormatted, releaseOrderFormatted, isReleased]);

  const completedCount = events.filter((e) => e.statusType === 'completed').length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
      {/* 1. Sleek Dashboard Metric Banner */}
      <View style={styles.metricsCard}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>YARD STATUS</Text>
          <View style={[
            styles.statusPill,
            vehicle.yardStatus === 'PAKKA' ? styles.statusPillPakka :
            vehicle.yardStatus === 'RELEASED' ? styles.statusPillReleased :
            styles.statusPillKachha
          ]}>
            <Text style={[
              styles.statusPillText,
              vehicle.yardStatus === 'PAKKA' ? styles.statusPillTextPakka :
              vehicle.yardStatus === 'RELEASED' ? styles.statusPillTextReleased :
              styles.statusPillTextKachha
            ]}>
              {vehicle.yardStatus || 'KACHHA'}
            </Text>
          </View>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>DAYS IN YARD</Text>
          <View style={styles.daysBadge}>
            <Timer size={13} color="#0062FF" strokeWidth={2.5} />
            <Text style={styles.daysNumberText}>{daysInYard} Days</Text>
          </View>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>PROGRESS</Text>
          <Text style={styles.progressValueText}>{completedCount} / 6 Stages</Text>
        </View>
      </View>

      {/* 2. Key Date Summary Grid (Quick Glance) */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCardHeader}>
          <Calendar size={14} color="#0062FF" strokeWidth={2.4} />
          <Text style={styles.summaryCardTitle}>Key Milestones Summary</Text>
        </View>

        <View style={styles.summaryGrid}>
          {/* Entry */}
          <View style={styles.summaryGridCol}>
            <Text style={styles.summaryColLabel}>Entry Date</Text>
            <Text style={styles.summaryColValue}>
              {entryFormatted ? entryFormatted.fullDateStr : 'Not recorded'}
            </Text>
            {entryFormatted && <Text style={styles.summaryColTime}>{entryFormatted.timeStr}</Text>}
          </View>

          {/* Pakka */}
          <View style={styles.summaryGridCol}>
            <Text style={styles.summaryColLabel}>Pakka Date</Text>
            <Text style={[styles.summaryColValue, !pakkaFormatted && styles.summaryPendingText]}>
              {pakkaFormatted ? pakkaFormatted.fullDateStr : 'Pending'}
            </Text>
            {pakkaFormatted && <Text style={styles.summaryColTime}>{pakkaFormatted.timeStr}</Text>}
          </View>

          {/* Release */}
          <View style={styles.summaryGridCol}>
            <Text style={styles.summaryColLabel}>Release Date</Text>
            <Text style={[styles.summaryColValue, !releasedFormatted && styles.summaryPendingText]}>
              {releasedFormatted ? releasedFormatted.fullDateStr : 'In Yard'}
            </Text>
            {releasedFormatted && <Text style={styles.summaryColTime}>{releasedFormatted.timeStr}</Text>}
          </View>
        </View>
      </View>

      {/* 3. High-End Vertical Timeline */}
      <View style={styles.timelineCard}>
        <View style={styles.timelineCardHeader}>
          <Hourglass size={14} color="#0062FF" strokeWidth={2.4} />
          <Text style={styles.timelineCardTitle}>Lifecycle Event Timeline</Text>
        </View>

        <View style={styles.timelineWrapper}>
          {events.map((event, idx) => {
            const formatted = formatDate(event.date);
            const isLast = idx === events.length - 1;
            const isCompleted = event.statusType === 'completed';
            const Icon = event.icon;

            return (
              <View key={event.id} style={styles.timelineRow}>
                {/* Left Column: Stage Node & Spine */}
                <View style={styles.spineCol}>
                  <View style={[
                    styles.spineNode,
                    isCompleted ? styles.spineNodeCompleted : styles.spineNodePending
                  ]}>
                    <Icon
                      size={13}
                      color={isCompleted ? '#FFFFFF' : '#94A3B8'}
                      strokeWidth={2.5}
                    />
                  </View>
                  {!isLast && (
                    <View style={[
                      styles.spineLine,
                      isCompleted && events[idx + 1]?.statusType === 'completed'
                        ? styles.spineLineCompleted
                        : styles.spineLinePending
                    ]} />
                  )}
                </View>

                {/* Right Column: Clean Event Card */}
                <View style={[
                  styles.eventCard,
                  !isCompleted && styles.eventCardPending
                ]}>
                  {/* Event Top Bar */}
                  <View style={styles.eventHeaderRow}>
                    <View style={styles.eventTitleGroup}>
                      <Text style={styles.stageNumberBadge}>Stage {event.stageNumber}</Text>
                      <Text style={styles.eventTitleText}>{event.title}</Text>
                    </View>

                    <View style={[
                      styles.eventStatusBadge,
                      isCompleted ? styles.eventStatusBadgeDone : styles.eventStatusBadgePending
                    ]}>
                      <Text style={[
                        styles.eventStatusBadgeText,
                        isCompleted ? styles.eventStatusBadgeTextDone : styles.eventStatusBadgeTextPending
                      ]}>
                        {event.statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Time Pills */}
                  {formatted ? (
                    <View style={styles.datePillsRow}>
                      <View style={styles.datePill}>
                        <Calendar size={11.5} color="#0062FF" strokeWidth={2.2} />
                        <Text style={styles.datePillText}>{formatted.fullDateStr}</Text>
                      </View>
                      <View style={styles.timePill}>
                        <Clock size={11.5} color="#64748B" strokeWidth={2} />
                        <Text style={styles.timePillText}>{formatted.timeStr}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.pendingDatePill}>
                      <Clock size={11.5} color="#94A3B8" strokeWidth={2} />
                      <Text style={styles.pendingDatePillText}>Milestone not reached yet</Text>
                    </View>
                  )}

                  {/* Event Subtitle / Description */}
                  <Text style={styles.eventDescText}>{event.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },

  // 1. Top Metrics Banner
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#F1F5F9',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillKachha: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusPillPakka: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusPillReleased: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusPillTextKachha: {
    color: '#D97706',
  },
  statusPillTextPakka: {
    color: '#0062FF',
  },
  statusPillTextReleased: {
    color: '#059669',
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  daysNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0062FF',
  },
  progressValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // 2. Summary Grid Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  summaryCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryGridCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  summaryColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  summaryColValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryColTime: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },
  summaryPendingText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    fontWeight: '600',
  },

  // 3. Timeline Card
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  timelineCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineWrapper: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  spineCol: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  spineNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  spineNodeCompleted: {
    backgroundColor: '#0062FF',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  spineNodePending: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  spineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  spineLineCompleted: {
    backgroundColor: '#0062FF',
  },
  spineLinePending: {
    backgroundColor: '#E2E8F0',
  },

  eventCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  eventCardPending: {
    backgroundColor: '#FAFAFA',
    borderColor: '#F1F5F9',
    opacity: 0.75,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  eventTitleGroup: {
    flex: 1,
  },
  stageNumberBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0062FF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  eventTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  eventStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  eventStatusBadgeDone: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  eventStatusBadgePending: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  eventStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  eventStatusBadgeTextDone: {
    color: '#0062FF',
  },
  eventStatusBadgeTextPending: {
    color: '#94A3B8',
  },

  datePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  datePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0062FF',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  pendingDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pendingDatePillText: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#94A3B8',
  },

  eventDescText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
});
