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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '@/services/api';
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
  Square,
  CheckSquare,
  X,
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

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay === 1) return 'Yesterday';
      return `${diffDay} days ago`;
    } catch (err) {
      return 'Recently';
    }
  };

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        let list: NotificationItem[] = [];

        // 1. Fetch read/deleted notification IDs from AsyncStorage
        const readIdsStr = await AsyncStorage.getItem('read_notifications');
        const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];

        const deletedIdsStr = await AsyncStorage.getItem('deleted_notifications');
        const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];

        // 2. Add dynamic sync queue log
        list.push({
          id: 'sync_log',
          type: 'SYNC',
          title: 'Database Cache Synced',
          message: 'Local SQLite database tables are fully synchronized with central cloud servers.',
          time: 'Just now',
          unread: false,
        });

        // 3. Add dynamic Printer log
        const printer = bluetoothService.getConnectedPrinter();
        list.push({
          id: 'printer_log',
          type: 'HARDWARE',
          title: printer ? 'Thermal Printer Connected' : 'No Printer Connected',
          message: printer
            ? `Active thermal receipt print output is routed to: ${printer.name} (${printer.address}).`
            : 'Bluetooth receipt printing is offline. Connect a printer in settings.',
          time: '5m ago',
          unread: !printer && !readIds.includes('printer_log'),
        });

        // 4. Fetch live audit logs from backend report reports
        const res = await apiRequest('/api/notifications');
        if (res.success && Array.isArray(res.data)) {
          const apiLogs: NotificationItem[] = res.data.map((item: any) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            message: item.message,
            time: formatRelativeTime(item.time),
            unread: !readIds.includes(item.id),
          }));
          list = [...list, ...apiLogs];
        }

        // 5. Filter out deleted notifications
        const finalLogs = list.filter((n) => !deletedIds.includes(n.id));
        setNotifications(finalLogs);
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
            ...prev.filter((n) => n.id !== 'sync_log'),
          ];
        });
      } else {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== 'sync_alert_required')
        );
      }
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      const allIds = notifications.map((n) => n.id);
      const readIdsStr = await AsyncStorage.getItem('read_notifications');
      const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
      const newRead = Array.from(new Set([...readIds, ...allIds]));
      await AsyncStorage.setItem('read_notifications', JSON.stringify(newRead));
    } catch (e) {
      console.warn('Failed to save read notifications status:', e);
    }
  };

  const clearAll = () => {
    Alert.alert('Clear Notifications', 'Are you sure you want to clear all alerts?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const allIds = notifications.map((n) => n.id);
          setNotifications([]);
          try {
            const deletedIdsStr = await AsyncStorage.getItem('deleted_notifications');
            const deletedIds = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
            const newDeleted = Array.from(new Set([...deletedIds, ...allIds]));
            await AsyncStorage.setItem('deleted_notifications', JSON.stringify(newDeleted));
          } catch (e) {
            console.warn('Failed to save deleted notifications status:', e);
          }
        },
      },
    ]);
  };

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter((selectedId) => selectedId !== id);
      } else {
        next = [...prev, id];
      }
      if (next.length === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const handleLongPress = (id: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
      setSelectionMode(false);
    } else {
      const allFilteredIds = filteredData.map((n) => n.id);
      setSelectedIds(allFilteredIds);
      setSelectionMode(true);
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Delete Selected',
      `Are you sure you want to delete the ${selectedIds.length} selected alert(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
            const itemsToDelete = [...selectedIds];
            cancelSelection();
            try {
              const deletedIdsStr = await AsyncStorage.getItem('deleted_notifications');
              const deletedIds = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
              const newDeleted = Array.from(new Set([...deletedIds, ...itemsToDelete]));
              await AsyncStorage.setItem('deleted_notifications', JSON.stringify(newDeleted));
            } catch (e) {
              console.warn('Failed to save deleted notifications status:', e);
            }
          },
        },
      ]
    );
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.includes(n.id) ? { ...n, unread: false } : n))
    );
    const itemsToMarkRead = [...selectedIds];
    cancelSelection();
    try {
      const readIdsStr = await AsyncStorage.getItem('read_notifications');
      const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
      const newRead = Array.from(new Set([...readIds, ...itemsToMarkRead]));
      await AsyncStorage.setItem('read_notifications', JSON.stringify(newRead));
    } catch (e) {
      console.warn('Failed to save read notifications status:', e);
    }
  };

  const handleNotificationTap = async (id: string) => {
    if (selectionMode) {
      handleSelect(id);
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    try {
      const readIdsStr = await AsyncStorage.getItem('read_notifications');
      const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
      if (!readIds.includes(id)) {
        readIds.push(id);
        await AsyncStorage.setItem('read_notifications', JSON.stringify(readIds));
      }
    } catch (e) {
      console.warn('Failed to save read notification status:', e);
    }
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
        return <Printer size={18} color="#4F46E5" />;
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
        return '#EEF2FF';
      case 'ACTIVITY':
        return '#DCFCE7';
      default:
        return '#F3E8FF';
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, selectionMode && styles.headerBarSelection]}>
        {selectionMode ? (
          <TouchableOpacity onPress={cancelSelection} style={styles.iconButton} activeOpacity={0.7}>
            <X size={24} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#0F172A" />
          </TouchableOpacity>
        )}
        <ThemedText style={[styles.headerTitle, selectionMode && styles.headerTitleSelection]}>
          {selectionMode ? `${selectedIds.length} Selected` : 'Notifications'}
        </ThemedText>
        <View style={styles.headerActions}>
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.actionBtn} activeOpacity={0.7}>
                <ThemedText style={styles.selectAllText}>
                  {selectedIds.length === filteredData.length ? 'None' : 'All'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={markSelectedAsRead} style={styles.actionBtn} activeOpacity={0.7}>
                <Check size={20} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteSelected} style={styles.actionBtn} activeOpacity={0.7}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </>
          ) : (
            notifications.length > 0 && (
              <>
                <TouchableOpacity onPress={markAllAsRead} style={styles.actionBtn} activeOpacity={0.7}>
                  <Check size={20} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAll} style={styles.actionBtn} activeOpacity={0.7}>
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              </>
            )
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
          <ActivityIndicator size="large" color="#4F46E5" />
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
              style={[
                styles.notificationCard,
                item.unread && styles.notificationCardUnread,
                selectedIds.includes(item.id) && styles.notificationCardSelected
              ]}
              onPress={() => handleNotificationTap(item.id)}
              onLongPress={() => handleLongPress(item.id)}
              delayLongPress={250}
              activeOpacity={0.75}
            >
              {selectionMode && (
                <View style={styles.checkboxContainer}>
                  {selectedIds.includes(item.id) ? (
                    <CheckSquare size={20} color="#4F46E5" />
                  ) : (
                    <Square size={20} color="#94A3B8" />
                  )}
                </View>
              )}

              <View style={[styles.iconBg, { backgroundColor: getIconBg(item.type) }]}>
                {getIcon(item.type)}
              </View>

              <View style={styles.contentBlock}>
                <View style={styles.titleRow}>
                  <ThemedText style={[styles.cardTitle, item.unread && styles.cardTitleUnread]}>
                    {item.title}
                  </ThemedText>
                  {item.unread && !selectionMode && <View style={styles.unreadDot} />}
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
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
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
    borderColor: '#4F46E5',
    borderWidth: 1.5,
    backgroundColor: '#EEF2FF',
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
    backgroundColor: '#4F46E5',
  },
  headerBarSelection: {
    backgroundColor: '#EEF2FF',
    borderBottomColor: '#C7D2FE',
  },
  headerTitleSelection: {
    color: '#4F46E5',
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    marginHorizontal: 4,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  notificationCardSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
    borderWidth: 1.5,
  },
});
