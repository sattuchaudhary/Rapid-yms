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
  User,
  FileText,
} from 'lucide-react-native';

export type BillingBottomBarTabKey = 'dashboard' | 'custom' | 'add' | 'vehicles' | 'profile';

export interface BillingBottomBarProps {
  activeTab?: BillingBottomBarTabKey;
  onCustomTabPress?: () => void;
  customTabLabel?: string;
  customTabIcon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  onProfilePress?: () => void;
  badges?: {
    vehicles?: number;
    custom?: number;
  };
}

const ACTIVE_COLOR = '#0062FF';
const INACTIVE_COLOR = '#64748B';

function CenterFab({ onPress }: { onPress: () => void }) {
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
    onPress();
  };

  return (
    <View style={styles.centerContainer}>
      <View style={styles.centerAura}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={styles.centerButton}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel="New Vehicle Entry"
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={styles.centerLabel}>Add Entry</Text>
    </View>
  );
}

export default function BillingBottomBar({
  activeTab,
  onCustomTabPress,
  customTabLabel,
  customTabIcon: CustomIcon,
  onProfilePress,
  badges,
}: BillingBottomBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  const handleNav = (route: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(route as any);
  };

  const handleAddVehicle = () => {
    handleNav('/tenant_admin/admin/vehicles/add');
  };

  const handleProfile = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    if (onProfilePress) {
      onProfilePress();
    } else {
      Alert.alert('Admin Profile', 'Profile and account details');
    }
  };

  return (
    <View style={[styles.navWrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navBar}>
        {/* 1. Left: Dashboard */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNav('/tenant_admin/admin/dashboard')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Dashboard"
        >
          <View style={styles.iconBox}>
            <LayoutDashboard
              size={21}
              color={activeTab === 'dashboard' ? ACTIVE_COLOR : INACTIVE_COLOR}
              strokeWidth={1.9}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'dashboard' && { color: ACTIVE_COLOR, fontWeight: '700' },
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        {/* 2. Left-Center: Custom/Future Slot (e.g. Invoices / Draft / Reports) */}
        {CustomIcon ? (
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.selectionAsync().catch(() => {});
              }
              onCustomTabPress?.();
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={customTabLabel || 'Option'}
          >
            <View style={styles.iconBox}>
              <CustomIcon
                size={21}
                color={activeTab === 'custom' ? ACTIVE_COLOR : INACTIVE_COLOR}
                strokeWidth={1.9}
              />
              {!!badges?.custom && badges.custom > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {badges.custom > 99 ? '99+' : badges.custom}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'custom' && { color: ACTIVE_COLOR, fontWeight: '700' },
              ]}
            >
              {customTabLabel || 'Option'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.selectionAsync().catch(() => {});
              }
              onCustomTabPress ? onCustomTabPress() : Alert.alert('Option', 'New option slot');
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel="Invoices"
          >
            <View style={styles.iconBox}>
              <FileText
                size={21}
                color={activeTab === 'custom' ? ACTIVE_COLOR : INACTIVE_COLOR}
                strokeWidth={1.9}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'custom' && { color: ACTIVE_COLOR, fontWeight: '700' },
              ]}
            >
              Invoices
            </Text>
          </TouchableOpacity>
        )}

        {/* 3. Center: + Floating Icon for New Vehicle Entry */}
        <CenterFab onPress={handleAddVehicle} />

        {/* 4. Between + and Profile: Vehicles (Vehicle List) */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNav('/tenant_admin/admin/vehicles')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Vehicles"
        >
          <View style={styles.iconBox}>
            <Car
              size={21}
              color={activeTab === 'vehicles' ? ACTIVE_COLOR : INACTIVE_COLOR}
              strokeWidth={1.9}
            />
            {!!badges?.vehicles && badges.vehicles > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {badges.vehicles > 99 ? '99+' : badges.vehicles}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'vehicles' && { color: ACTIVE_COLOR, fontWeight: '700' },
            ]}
          >
            Vehicles
          </Text>
        </TouchableOpacity>

        {/* 5. Right: Profile */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={handleProfile}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel="Profile"
        >
          <View style={styles.iconBox}>
            <User
              size={21}
              color={activeTab === 'profile' ? ACTIVE_COLOR : INACTIVE_COLOR}
              strokeWidth={1.9}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'profile' && { color: ACTIVE_COLOR, fontWeight: '700' },
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
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
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
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
  centerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ACTIVE_COLOR,
    marginTop: 2,
  },
});
