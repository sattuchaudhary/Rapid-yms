import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ClipboardList,
  Printer,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const handleNavigate = (path: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push(path as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>GENERAL CONFIGURATION</Text>

        {/* Settings Group 1 */}
        <View style={styles.groupContainer}>
          {/* 1. Inventory Customization Option */}
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() => handleNavigate('/tenant_admin/admin/settings/inventory-customization')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <ClipboardList size={20} color="#4F46E5" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Inventory Customization</Text>
              <Text style={styles.rowSubtitle}>
                Customize new vehicle inward checklist & fields
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* 2. Print Setup Option */}
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() => handleNavigate('/tenant_admin/admin/settings/inventory-customization')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Printer size={20} color="#16A34A" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Print & Gate Pass Layout</Text>
              <Text style={styles.rowSubtitle}>
                Configure gate receipt headers & print options
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 24, color: '#DC2626' }]}>DATA MANAGEMENT & DANGER ZONE</Text>

        {/* Settings Group 2 - Data & Vehicle Clean */}
        <View style={[styles.groupContainer, { borderColor: '#FEE2E2' }]}>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() => handleNavigate('/tenant_admin/admin/settings/delete-vehicles')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Trash2 size={20} color="#EF4444" />
            </View>
            <View style={styles.rowTextContainer}>
              <View style={styles.titleWithBadge}>
                <Text style={[styles.rowTitle, { color: '#B91C1C' }]}>Clear / Delete Vehicles</Text>
                <View style={styles.dangerBadge}>
                  <Text style={styles.dangerBadgeText}>ADMIN ONLY</Text>
                </View>
              </View>
              <Text style={styles.rowSubtitle}>
                Select & permanently delete vehicles or clear yard data
              </Text>
            </View>
            <ChevronRight size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  groupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 70,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dangerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
});
