import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Home,
  FileText,
  Plus,
  ShieldCheck,
  Car,
} from 'lucide-react-native';

export type AdminDashboardTabKey = 'home' | 'draft' | 'add' | 'release' | 'vehicles';

export interface AdminDashboardTabBadges {
  draft?: number;
  release?: number;
  vehicles?: number;
}

export interface AdminDashboardBottomNavBarProps {
  activeTab: AdminDashboardTabKey;
  onTabPress?: (tab: AdminDashboardTabKey) => void;
  badges?: AdminDashboardTabBadges;
}

interface TabConfig {
  key: AdminDashboardTabKey;
  label?: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  isCenter?: boolean;
}

const TABS: TabConfig[] = [
  {
    key: 'home',
    label: 'Home',
    Icon: Home,
  },
  {
    key: 'draft',
    label: 'Draft',
    Icon: FileText,
  },
  {
    key: 'add',
    Icon: Plus,
    isCenter: true,
  },
  {
    key: 'release',
    label: 'Release',
    Icon: ShieldCheck,
  },
  {
    key: 'vehicles',
    label: 'Vehicles',
    Icon: Car,
  },
];

// Aligned with app brand blue (see login screen / logo)
const ACTIVE_COLOR = '#0062FF';
const ACTIVE_BG = 'rgba(0, 98, 255, 0.10)';
const INACTIVE_COLOR = '#64748B';

function TabItem({
  tab,
  isActive,
  badgeCount,
  onPress,
}: {
  tab: TabConfig;
  isActive: boolean;
  badgeCount?: number;
  onPress: () => void;
}) {
  const { Icon, label } = tab;
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  const pillScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const pillOpacity = progress;
  const labelColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE_COLOR, ACTIVE_COLOR],
  });

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => { });
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.iconBox}>
        <Animated.View
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
              transform: [{ scale: pillScale }],
            },
          ]}
        />
        <Icon
          size={22}
          color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
        {!!badgeCount && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Animated.Text style={[styles.tabLabel, { color: labelColor }]}>
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

function CenterFab({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.15] });

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
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }
    onPress();
  };

  return (
    <View style={styles.centerContainer}>
      <View style={styles.centerAura}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={styles.centerButton}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel="Add new"
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Text style={styles.centerLabel}>Add</Text>
    </View>
  );
}

export default function AdminDashboardBottomNavBar({
  activeTab,
  onTabPress,
  badges,
}: AdminDashboardBottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  return (
    <View style={[styles.navWrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navBar}>
        {TABS.map((tab) => {
          if (tab.isCenter) {
            return (
              <CenterFab key={tab.key} onPress={() => onTabPress?.(tab.key)} />
            );
          }

          return (
            <TabItem
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              badgeCount={badges?.[tab.key as keyof AdminDashboardTabBadges]}
              onPress={() => onTabPress?.(tab.key)}
            />
          );
        })}
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
  activePill: {
    position: 'absolute',
    width: 40,
    height: 30,
    borderRadius: 14,
    backgroundColor: ACTIVE_BG,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
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
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0062FF',
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  centerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0062FF',
    marginTop: 2,
  },
});