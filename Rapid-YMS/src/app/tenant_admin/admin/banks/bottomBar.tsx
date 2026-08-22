import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  Car,
  Plus,
  FileText,
  Search,
} from 'lucide-react-native';

export interface BanksBottomBarProps {
  mode?: 'navbar' | 'action';
  onAddPress?: () => void;
  onReportPress?: () => void;
  onSearchPress?: () => void;
  canAdd?: boolean;
  addLabel?: string;
}

const ACTIVE_COLOR = '#0062FF';
const INACTIVE_COLOR = '#64748B';

function CenterFab({
  onPress,
  disabled,
  label = 'Add Bank',
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
            <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={styles.centerLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function BanksBottomBar({
  mode = 'navbar',
  onAddPress,
  onReportPress,
  onSearchPress,
  canAdd = true,
  addLabel = 'Add Bank',
}: BanksBottomBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  const handleNav = (route: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(route as any);
  };

  // 1. Single Action Button Mode (Inside category / bank detail pages)
  if (mode === 'action') {
    if (!canAdd) return null;
    return (
      <View style={[styles.actionWrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            onAddPress?.();
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.actionButtonText}>{addLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Full Navbar Mode (Main 3-Category screen)
  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.container}>
        {/* 1. Dashboard Tab */}
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

        {/* 2. Vehicles Tab */}
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

        {/* 3. Center FAB (+) for Adding Bank */}
        <CenterFab onPress={onAddPress} disabled={!canAdd} label={addLabel} />

        {/* 4. Report Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.selectionAsync().catch(() => {});
            }
            if (onReportPress) {
              onReportPress();
            } else {
              Alert.alert('Reports', 'Bank Reports & summary will be displayed here.');
            }
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

        {/* 5. Search Tab */}
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
  // Full Navbar styles
  wrapper: {
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
  container: {
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
    backgroundColor: 'rgba(0, 98, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTIVE_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
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
    color: ACTIVE_COLOR,
    marginTop: 2,
  },

  // Single Action Bar styles
  actionWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  actionButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#0062FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
