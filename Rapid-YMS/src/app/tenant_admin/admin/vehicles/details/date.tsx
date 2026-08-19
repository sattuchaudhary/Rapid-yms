import React from 'react';
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
} from 'lucide-react-native';

export interface VehicleDateTimelineProps {
  vehicle: any;
}

interface TimelineEvent {
  id: string;
  title: string;
  date?: string | Date | null;
  statusText: string;
  statusType: 'blue' | 'amber' | 'green' | 'purple' | 'gray';
  icon: any;
  subtext: string;
  isCompleted: boolean;
}

export default function VehicleDateTimeline({ vehicle }: VehicleDateTimelineProps) {
  if (!vehicle) return null;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return null;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return null;

    const dateStr = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const timeStr = dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return { dateStr, timeStr };
  };

  const entryFormatted = formatDate(vehicle.entryDate || vehicle.createdAt);
  const kachhaFormatted = formatDate(vehicle.kachhaStartDate || vehicle.entryDate);
  const pakkaFormatted = formatDate(vehicle.pakkaDate);
  const repoKitFormatted = formatDate(vehicle.repoKitDate);
  const releaseOrderFormatted = formatDate(vehicle.releaseOrderDate);
  const isReleased = vehicle.yardStatus === 'RELEASED';
  const releasedFormatted = formatDate(vehicle.release?.releasedAt || (isReleased ? vehicle.updatedAt : null));

  const events: TimelineEvent[] = [
    {
      id: 'entry',
      title: 'Gate Entry Date',
      date: vehicle.entryDate || vehicle.createdAt,
      statusText: 'GATE IN',
      statusType: 'blue',
      icon: Calendar,
      subtext: 'Vehicle entered yard gate and logged by staff',
      isCompleted: !!entryFormatted,
    },
    {
      id: 'kachha',
      title: 'Kachha Phase Date',
      date: vehicle.kachhaStartDate || vehicle.entryDate,
      statusText: 'KACHHA',
      statusType: 'amber',
      icon: Clock,
      subtext: 'Temporary holding period started',
      isCompleted: !!kachhaFormatted,
    },
    {
      id: 'repoKit',
      title: 'Repo Kit Date',
      date: vehicle.repoKitDate,
      statusText: vehicle.repoKitDate ? 'KIT LOGGED' : 'PENDING',
      statusType: vehicle.repoKitDate ? 'blue' : 'gray',
      icon: FileCheck,
      subtext: 'NOC & repo kit documents processed',
      isCompleted: !!repoKitFormatted,
    },
    {
      id: 'pakka',
      title: 'Pakka Conversion Date',
      date: vehicle.pakkaDate,
      statusText: vehicle.pakkaDate ? 'PAKKA CONFIRMED' : 'AWAITING',
      statusType: vehicle.pakkaDate ? 'blue' : 'gray',
      icon: ShieldCheck,
      subtext: 'Vehicle converted to Pakka inventory',
      isCompleted: !!pakkaFormatted,
    },
    {
      id: 'releaseOrder',
      title: 'Release Order Date',
      date: vehicle.releaseOrderDate,
      statusText: vehicle.releaseOrderDate ? 'ORDER ISSUED' : 'NOT ISSUED',
      statusType: vehicle.releaseOrderDate ? 'purple' : 'gray',
      icon: FileCheck,
      subtext: 'Release authorization letter received from bank',
      isCompleted: !!releaseOrderFormatted,
    },
    {
      id: 'released',
      title: 'Final Release Date',
      date: vehicle.release?.releasedAt || (isReleased ? vehicle.updatedAt : null),
      statusText: isReleased ? 'RELEASED' : 'IN YARD',
      statusType: isReleased ? 'green' : 'gray',
      icon: CheckCircle2,
      subtext: isReleased ? 'Vehicle handed over and exited yard' : 'Vehicle is currently stationed in yard',
      isCompleted: isReleased,
    },
  ];

  const getStatusColor = (type: TimelineEvent['statusType']) => {
    switch (type) {
      case 'blue':
        return { bg: '#EFF6FF', text: '#0062FF', border: '#BFDBFE' };
      case 'amber':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      case 'green':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'purple':
        return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Clean Top Status Bar */}
      <View style={styles.topStatusCard}>
        <View style={styles.topStatusCol}>
          <Text style={styles.topStatusLabel}>Current Yard Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: getStatusColor(
                    vehicle.yardStatus === 'PAKKA'
                      ? 'blue'
                      : vehicle.yardStatus === 'RELEASED'
                      ? 'green'
                      : vehicle.yardStatus === 'SHIFTING'
                      ? 'purple'
                      : 'amber'
                  ).bg,
                  borderColor: getStatusColor(
                    vehicle.yardStatus === 'PAKKA'
                      ? 'blue'
                      : vehicle.yardStatus === 'RELEASED'
                      ? 'green'
                      : vehicle.yardStatus === 'SHIFTING'
                      ? 'purple'
                      : 'amber'
                  ).border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: getStatusColor(
                      vehicle.yardStatus === 'PAKKA'
                        ? 'blue'
                        : vehicle.yardStatus === 'RELEASED'
                        ? 'green'
                        : vehicle.yardStatus === 'SHIFTING'
                        ? 'purple'
                        : 'amber'
                    ).text,
                  },
                ]}
              >
                {vehicle.yardStatus || 'KACHHA'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.topDivider} />

        <View style={styles.topStatusCol}>
          <Text style={styles.topStatusLabel}>Entry Date</Text>
          <Text style={styles.topDateValue}>{entryFormatted?.dateStr || 'N/A'}</Text>
        </View>
      </View>

      {/* 2. Timeline Card */}
      <View style={styles.timelineSectionCard}>
        <Text style={styles.sectionHeading}>Important Dates & Timeline</Text>

        <View style={styles.timelineList}>
          {events.map((event, index) => {
            const formatted = formatDate(event.date);
            const isLast = index === events.length - 1;
            const Icon = event.icon;
            const statusStyle = getStatusColor(event.statusType);

            return (
              <View key={event.id} style={styles.timelineRow}>
                {/* Left Indicator Column */}
                <View style={styles.indicatorCol}>
                  <View
                    style={[
                      styles.nodeDot,
                      event.isCompleted ? styles.nodeDotActive : styles.nodeDotPending,
                    ]}
                  >
                    <Icon
                      size={13}
                      color={event.isCompleted ? '#FFFFFF' : '#94A3B8'}
                      strokeWidth={2.4}
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.connectorLine,
                        event.isCompleted && events[index + 1]?.isCompleted
                          ? styles.connectorLineActive
                          : styles.connectorLinePending,
                      ]}
                    />
                  )}
                </View>

                {/* Right Details Card */}
                <View style={[styles.eventBox, !event.isCompleted && styles.eventBoxPending]}>
                  <View style={styles.eventTopRow}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <View
                      style={[
                        styles.eventBadge,
                        {
                          backgroundColor: statusStyle.bg,
                          borderColor: statusStyle.border,
                        },
                      ]}
                    >
                      <Text style={[styles.eventBadgeText, { color: statusStyle.text }]}>
                        {event.statusText}
                      </Text>
                    </View>
                  </View>

                  {formatted ? (
                    <View style={styles.dateChipRow}>
                      <View style={styles.cleanDateBadge}>
                        <Calendar size={11} color="#0062FF" />
                        <Text style={styles.cleanDateText}>{formatted.dateStr}</Text>
                      </View>
                      <View style={styles.cleanTimeBadge}>
                        <Clock size={11} color="#64748B" />
                        <Text style={styles.cleanTimeText}>{formatted.timeStr}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.pendingDateText}>Date not recorded yet</Text>
                  )}

                  <Text style={styles.eventSubtext}>{event.subtext}</Text>
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
  container: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  topStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topStatusCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  topStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  topDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },
  topDateValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 8,
  },
  nodeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  nodeDotActive: {
    backgroundColor: '#0062FF',
  },
  nodeDotPending: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    marginVertical: 3,
  },
  connectorLineActive: {
    backgroundColor: '#BFDBFE',
  },
  connectorLinePending: {
    backgroundColor: '#F1F5F9',
  },
  eventBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  eventBoxPending: {
    backgroundColor: '#FAFAFA',
    opacity: 0.8,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dateChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  cleanDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    gap: 4,
  },
  cleanDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  cleanTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  cleanTimeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  pendingDateText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94A3B8',
    marginVertical: 2,
  },
  eventSubtext: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
});
