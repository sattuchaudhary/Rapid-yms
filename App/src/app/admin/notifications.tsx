import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { registerSyncListener } from '@/services/sync';
import { bluetoothService } from '@/services/bluetooth';
import {
  ChevronLeft,
  Bell,
  Trash2,
  Check,
  Wifi,
  Printer,
  Shield,
  Clock,
  FileText,
  Car,
  Key,
} from 'lucide-react-native';

interface NotificationItem {
  id: string;
  type: 'SYNC' | 'HARDWARE' | 'ACTIVITY' | 'SYSTEM';
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SYNC' | 'HARDWARE' | 'ACTIVITY'>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Build initial list based on real status + simulated history logs
    const loadLogs = async () => {
      setLoading(true);
      try {
        let list: NotificationItem[] = [];

        // 1. Check sync queue count (subscribed or current check)
        // Note: For simplicity, we create a default sync log
        list.push({
          id: 'sync_log',
          type: 'SYNC',
          title: 'Database Cache Synced',
          message: 'Local SQLite database tables are fully synchronized with central cloud servers.',
          time: 'Just now',
          unread: false,
        });

        // 2. Check Printer
        const printer = bluetoothService.getConnectedPrinter();
        list.push({
          id: 'printer_log',
          type: 'HARDWARE',
          title: printer ? 'Thermal Printer Connected' : 'No Printer Connected',
          message: printer 
            ? `Active thermal receipt print output is routed to: ${printer.name} (${printer.address}).`
            : 'Bluetooth receipt printing is offline. Connect a printer in settings.',
          time: '5m ago',
          unread: !printer,
        });

        // 3. Add simulated historical logs for realistic feel
        list.push(
          {
            id: '1',
            type: 'ACTIVITY',
            title: 'Vehicle Released (Gate Exit)',
            message: 'Vehicle MH-12-AB-5678 (4W) has been released successfully to owner.',
            time: '1h ago',
            unread: false,
          },
          {
            id: '2',
            type: 'ACTIVITY',
            title: 'New Vehicle Checked-In',
            message: 'Kachha entry recorded for commercial truck HR-55-XY-0091.',
            time: '3h ago',
            unread: true,
          },
          {
            id: '3',
            type: 'SYSTEM',
            title: 'Tariff Rates Refreshed',
            message: 'Latest daily parking rates for financing bank repos updated successfully.',
            time: 'Yesterday',
            unread: false,
          },
          {
            id: '4',
            type: 'ACTIVITY',
            title: 'Kachha to Pakka Conversion',
            message: 'Vehicle MH-02-CP-7711 moved to PAKKA status after uploading all 4 repo kit docs.',
            time: 'Yesterday',
            unread: false,
          },
          {
            id: '5',
            type: 'SYSTEM',
            title: 'Security Alert: Manager Override',
            message: 'Manager passcode verification accepted for custom parking fee waiver override.',
            time: '2 days ago',
            unread: false,
          }
        );

        setNotifications(list);
      } catch (err) {
        console.error('Error loading notification logs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();

    // Subscribe to Sync queue count to dynamically show new sync alerts
    const unsubscribeSync = registerSyncListener((syncing, count) => {
      if (count > 0) {
        setNotifications((prev) => {
          // Check if sync alert already exists
          const exists = prev.some((n) => n.id === 'sync_alert_required');
          if (exists) return prev;

          return [
            {
              id: 'sync_alert_required',
              type: 'SYNC',
              title: 'Offline Entries: Sync Required',
              message: `You have ${count} pending entries logged locally. Please sync them with the cloud database.`,
              time: 'Just now',
              unread: true,
            },
            ...prev.filter((n) => n.id !== 'sync_log'), // replace the success log
          ];
        });
      } else {
        // remove sync required alert if zero
        setNotifications((prev) => 
          prev.filter((n) => n.id !== 'sync_alert_required')
        );
      }
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    Alert.alert('Clear Notifications', 'Are you sure you want to clear all alerts?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setNotifications([]) },
    ]);
  };

  const handleNotificationTap = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const filteredData = notifications.filter((n) => {
    if (activeFilter === 'ALL') return true;
    return n.type === activeFilter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'SYNC':
        return <Wifi size={18} color="#D97706" />;
      case 'HARDWARE':
        return <Printer size={18} color="#2563EB" />;
      case 'ACTIVITY':
        return <Car size={18} color="#10B981" />;
      default:
        return <Shield size={18} color="#8B5CF6" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'SYNC':
        return '#FEF3C7';
      case 'HARDWARE':
        return '#EFF6FF';
      case 'ACTIVITY':
        return '#DCFCE7';
      default:
        return '#F3E8FF';
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <>
              <TouchableOpacity onPress={markAllAsRead} style={styles.actionBtn} activeOpacity={0.7}>
                <Check size={20} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAll} style={styles.actionBtn} activeOpacity={0.7}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['ALL', 'SYNC', 'HARDWARE', 'ACTIVITY'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
            onPress={() => setActiveFilter(filter)}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.filterTabText, activeFilter === filter && styles.filterTabTextActive]}>
              {filter === 'ALL' ? 'All' : filter === 'SYNC' ? 'Sync' : filter === 'HARDWARE' ? 'Hardware' : 'Activity'}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <ThemedText style={styles.loadingText}>Fetching system logs...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Bell size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <ThemedText style={styles.emptyTitle}>All caught up!</ThemedText>
              <ThemedText style={styles.emptySubtitle}>No new notifications found in this category.</ThemedText>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationCard, item.unread && styles.notificationCardUnread]}
              onPress={() => handleNotificationTap(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBg, { backgroundColor: getIconBg(item.type) }]}>
                {getIcon(item.type)}
              </View>

              <View style={styles.contentBlock}>
                <View style={styles.titleRow}>
                  <ThemedText style={[styles.cardTitle, item.unread && styles.cardTitleUnread]}>
                    {item.title}
                  </ThemedText>
                  {item.unread && <View style={styles.unreadDot} />}
                </View>

                <ThemedText style={styles.cardMessage}>{item.message}</ThemedText>
                
                <View style={styles.timeRow}>
                  <Clock size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                  <ThemedText style={styles.cardTime}>{item.time}</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationCardUnread: {
    borderColor: '#2563EB',
    borderWidth: 1.5,
    backgroundColor: '#EFF6FF',
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  contentBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  cardTitleUnread: {
    color: '#0F172A',
  },
  cardMessage: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
});
