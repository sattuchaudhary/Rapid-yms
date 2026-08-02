import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getAllDrafts, deleteDraft, DraftRecord } from '@/services/sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Clock,
  Car,
  Key,
  RefreshCw,
  Plus,
} from 'lucide-react-native';

export default function DraftsScreen() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'CHECK_IN' | 'CHECK_OUT' | 'KACHHA_TO_PAKKA'>('ALL');

  const loadDrafts = useCallback(() => {
    try {
      const list = getAllDrafts();
      setDrafts(list);
    } catch (err: any) {
      console.error('[DraftsScreen] Failed to load drafts:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const handleDelete = (draft: DraftRecord) => {
    Alert.alert(
      'Delete Draft',
      `Are you sure you want to delete draft "${draft.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDraft(draft.id);
            loadDrafts();
          },
        },
      ]
    );
  };

  const handleResume = (draft: DraftRecord) => {
    if (draft.type === 'CHECK_IN') {
      router.push({ pathname: '/admin/check-in', params: { draftId: draft.id } });
    } else if (draft.type === 'CHECK_OUT') {
      router.push({ pathname: '/admin/check-out', params: { draftId: draft.id } });
    } else if (draft.type === 'KACHHA_TO_PAKKA') {
      try {
        const payload = JSON.parse(draft.data);
        const vehicleId = payload.id || payload.vehicleId;
        router.push({ pathname: '/admin/kachha-to-pakka', params: { id: vehicleId, draftId: draft.id } });
      } catch {
        router.push({ pathname: '/admin/kachha-to-pakka', params: { draftId: draft.id } });
      }
    }
  };

  const filteredDrafts = drafts.filter(d => filterType === 'ALL' || d.type === filterType);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getDraftBadgeColor = (type: string) => {
    switch (type) {
      case 'CHECK_IN': return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE', label: '📥 Vehicle Check-In' };
      case 'CHECK_OUT': return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: '🔑 Vehicle Release' };
      case 'KACHHA_TO_PAKKA': return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', label: '🔄 Kachha to Pakka' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0', label: type };
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Pending Drafts ({drafts.length})</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'CHECK_IN', 'CHECK_OUT', 'KACHHA_TO_PAKKA'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, filterType === t && styles.filterChipActive]}
            onPress={() => setFilterType(t)}
            activeOpacity={0.75}
          >
            <ThemedText style={[styles.filterChipText, filterType === t && styles.filterChipTextActive]}>
              {t === 'ALL' ? `All (${drafts.length})` :
               t === 'CHECK_IN' ? 'Check-In' :
               t === 'CHECK_OUT' ? 'Release' : 'Kachha→Pakka'}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />}
      >
        {filteredDrafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBg}>
              <FileText size={32} color="#94A3B8" />
            </View>
            <ThemedText style={styles.emptyTitle}>No Pending Drafts</ThemedText>
            <ThemedText style={styles.emptySub}>
              {filterType === 'ALL'
                ? 'Any form left incomplete or backed out will automatically save here as a draft.'
                : `No pending drafts found for this category.`}
            </ThemedText>
          </View>
        ) : (
          filteredDrafts.map((draft) => {
            const badge = getDraftBadgeColor(draft.type);
            return (
              <View key={draft.id} style={styles.draftCard}>
                <View style={styles.draftHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <ThemedText style={[styles.typeBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </ThemedText>
                  </View>
                  <View style={styles.timeTag}>
                    <Clock size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.timeTagText}>{formatTimeAgo(draft.updatedAt)}</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.draftTitle}>{draft.title || 'Untitled Draft'}</ThemedText>
                {draft.subtitle ? (
                  <ThemedText style={styles.draftSubtitle}>{draft.subtitle}</ThemedText>
                ) : null}

                <View style={styles.draftActionsRow}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(draft)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resumeBtn}
                    onPress={() => handleResume(draft)}
                    activeOpacity={0.8}
                  >
                    <ChevronRight size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.resumeBtnText}>Resume Draft</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  draftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTagText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  draftSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  draftActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 40,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
