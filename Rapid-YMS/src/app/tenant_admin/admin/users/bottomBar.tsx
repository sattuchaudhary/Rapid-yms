import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  UserPlus,
  LayoutDashboard,
  Car,
  FileText,
  Search,
  Plus,
} from 'lucide-react-native';

export interface UsersBottomBarProps {
  mode?: 'action' | 'navbar';
  onAddPress?: () => void;
  onReportPress?: () => void;
  onSearchPress?: () => void;
  addLabel?: string;
  disabled?: boolean;
}

const PRIMARY_COLOR = '#7C3AED'; // Vibrant Violet Theme for Users
const INACTIVE_COLOR = '#64748B';

function CenterFab({
  onPress,
  disabled,
  label = 'Add User',
}: {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPress?.();
  };

  return (
    <View style={styles.centerContainer}>
      <View style={styles.centerAura}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[styles.centerButton, disabled && styles.centerButtonDisabled]}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.92}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={styles.centerLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function UsersBottomBar({
  mode = 'action',
  onAddPress,
  onReportPress,
  onSearchPress,
  addLabel = 'Add New User',
  disabled = false,
}: UsersBottomBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);

  const handleAdd = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onAddPress?.();
  };

  const handleNav = (route: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(route as any);
  };

  // Mode 1: Prominent Action Button Bar
  if (mode === 'action') {
    return (
      <View style={[styles.actionWrapper, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
          onPress={handleAdd}
          activeOpacity={0.88}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <View style={styles.iconCircleInBtn}>
            <UserPlus size={18} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <Text style={styles.actionButtonText}>{addLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Mode 2: Full Bottom Navigation Bar
  return (
    <View style={[styles.navbarWrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navbarContainer}>
        {/* Dashboard Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNav('/tenant_admin/admin/dashboard')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Dashboard"
        >
          <View style={styles.iconBox}>
            <LayoutDashboard size={21} color={INACTIVE_COLOR} strokeWidth={1.8} />
          </View>
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>

        {/* Vehicles Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNav('/tenant_admin/admin/vehicles')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Vehicles"
        >
          <View style={styles.iconBox}>
            <Car size={21} color={INACTIVE_COLOR} strokeWidth={1.8} />
          </View>
          <Text style={styles.tabLabel}>Vehicles</Text>
        </TouchableOpacity>

        {/* Center FAB: Add User */}
        <CenterFab onPress={onAddPress} disabled={disabled} label="Add User" />

        {/* Report Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.selectionAsync().catch(() => {});
            }
            onReportPress?.();
          }}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Report"
        >
          <View style={styles.iconBox}>
            <FileText size={21} color={INACTIVE_COLOR} strokeWidth={1.8} />
          </View>
          <Text style={styles.tabLabel}>Report</Text>
        </TouchableOpacity>

        {/* Search Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.selectionAsync().catch(() => {});
            }
            onSearchPress?.();
          }}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Search"
        >
          <View style={styles.iconBox}>
            <Search size={21} color={INACTIVE_COLOR} strokeWidth={1.8} />
          </View>
          <Text style={styles.tabLabel}>Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Action Bar Mode Styles
  actionWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  actionButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  actionButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  iconCircleInBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // Navbar Mode Styles
  navbarWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  navbarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 30,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE_COLOR,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  centerAura: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  centerButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  centerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginTop: 2,
  },
});
