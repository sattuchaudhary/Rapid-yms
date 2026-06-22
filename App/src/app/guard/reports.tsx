import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { apiRequest } from '@/services/api';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Car,
  DoorOpen,
  Clock,
  Calendar,
  Package,
} from 'lucide-react-native';

interface ReportItem {
  id: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  title: string;
  description: string;
  apiEndpoint?: string;
  comingSoon?: boolean;
}

export default function ReportsScreen() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const reportItems: ReportItem[] = [
    {
      id: 'daily_summary',
      icon: <LayoutDashboard size={22} color="#2563EB" />,
      iconBgColor: '#EFF6FF',
      iconColor: '#2563EB',
      title: 'Daily Summary',
      description: 'Summary of today activities',
      apiEndpoint: '/api/reports/dashboard',
    },
    {
      id: 'vehicles_in_yard',
      icon: <Car size={22} color="#6366F1" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#6366F1',
      title: 'Vehicle In Yard Report',
      description: 'List of all vehicles in yard',
      apiEndpoint: '/api/vehicles?status=IN_YARD&limit=200',
    },
    {
      id: 'released_vehicles',
      icon: <DoorOpen size={22} color="#6366F1" />,
      iconBgColor: '#EEF2FF',
      iconColor: '#6366F1',
      title: 'Released Vehicles Report',
      description: 'List of released vehicles',
      apiEndpoint: '/api/vehicles?status=RELEASED&limit=200',
    },
    {
      id: 'pending_payment',
      icon: <Clock size={22} color="#F59E0B" />,
      iconBgColor: '#FFFBEB',
      iconColor: '#F59E0B',
      title: 'Pending Payment Report',
      description: 'Vehicles with pending charges',
      apiEndpoint: '/api/reports/pending-payments',
    },
    {
      id: 'date_range',
      icon: <Calendar size={22} color="#8B5CF6" />,
      iconBgColor: '#F5F3FF',
      iconColor: '#8B5CF6',
      title: 'Date Range Report',
      description: 'Custom date range report',
      comingSoon: false,
      apiEndpoint: '/api/reports/profit-loss',
    },
    {
      id: 'inventory',
      icon: <Package size={22} color="#8B5CF6" />,
      iconBgColor: '#F5F3FF',
      iconColor: '#8B5CF6',
      title: 'Inventory Report',
      description: 'Inventory details report',
      apiEndpoint: '/api/vehicles?limit=500',
    },
  ];

  const handleReportTap = async (item: ReportItem) => {
    if (item.comingSoon) {
      Alert.alert('Coming Soon', `${item.title} will be available in the next update.`);
      return;
    }
    if (!item.apiEndpoint) return;

    setLoadingId(item.id);
    try {
      const res = await apiRequest(item.apiEndpoint);
      if (res.success && res.data) {
        const data = res.data;

        let summary = '';
        if (item.id === 'daily_summary' && data.stats) {
          const s = data.stats;
          summary =
            `📊 ${item.title}\n\n` +
            `Total Vehicles: ${s.totalVehicles ?? 'N/A'}\n` +
            `In Yard: ${s.inYardVehicles ?? s.totalVehicles ?? 'N/A'}\n` +
            `Released Today: ${s.releasedVehicles?.today ?? 0}\n` +
            `Entries Today: ${s.newEntries?.today ?? 0}`;
        } else if (item.id === 'date_range' && data.totalSettledPakka !== undefined) {
          summary =
            `💰 ${item.title}\n\n` +
            `Total Revenue: ₹${(data.totalSettledPakka + data.kachhaRevenueRealized).toLocaleString('en-IN')}\n` +
            `Settled (Pakka): ₹${data.totalSettledPakka?.toLocaleString('en-IN') ?? 0}\n` +
            `Kachha Revenue: ₹${data.kachhaRevenueRealized?.toLocaleString('en-IN') ?? 0}\n` +
            `Reconciliation Loss: ₹${data.reconciliationLoss?.toLocaleString('en-IN') ?? 0}`;
        } else if (Array.isArray(data)) {
          summary =
            `📋 ${item.title}\n\n` +
            `Total Records: ${data.length}\n\n` +
            data.slice(0, 5).map((v: any, i: number) =>
              `${i + 1}. ${v.vehicleNumber ?? v.id ?? 'Unknown'}`
            ).join('\n') +
            (data.length > 5 ? `\n... and ${data.length - 5} more` : '');
        } else {
          summary = `${item.title}\n\nData fetched successfully. ${JSON.stringify(data).slice(0, 200)}`;
        }

        Alert.alert(item.title, summary);
      } else {
        Alert.alert(item.title, 'No data available for this report at this time.');
      }
    } catch (err: any) {
      Alert.alert(
        item.title,
        `Unable to load report data.\nReason: ${err?.message || 'Server unavailable'}\n\nPlease check your connection and try again.`
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Reports</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.reportsList}>
          {reportItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.reportRow,
                index < reportItems.length - 1 && styles.reportRowBorder,
              ]}
              onPress={() => handleReportTap(item)}
              activeOpacity={0.7}
              disabled={loadingId === item.id}
            >
              {/* Icon */}
              <View style={[styles.reportIconBg, { backgroundColor: item.iconBgColor }]}>
                {item.icon}
              </View>

              {/* Labels */}
              <View style={styles.reportTextBlock}>
                <ThemedText style={styles.reportTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.reportDescription}>{item.description}</ThemedText>
              </View>

              {/* Arrow / Loader */}
              {loadingId === item.id ? (
                <ActivityIndicator size="small" color="#94A3B8" />
              ) : (
                <ChevronRight size={18} color="#CBD5E1" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ThemedText style={styles.footerNote}>
          Tap any report to view a live summary. More export options coming soon.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reportsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  reportRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportIconBg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reportTextBlock: {
    flex: 1,
    gap: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  reportDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
  },
  footerNote: {
    fontSize: 11,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});
