import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Bell, User, Building2, ChevronDown } from 'lucide-react-native';

export interface AdminDashboardHeaderProps {
  yardName?: string;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onYardBadgePress?: () => void;
  hasUnreadNotification?: boolean;
  unreadCount?: number;
  userInitial?: string;
}

function PressableIcon({
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  onPress?: () => void;
  accessibilityLabel: string;
  style?: any;
  children: React.ReactNode;
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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function NotificationBadge({ count }: { count?: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const hasBadge = !!count && count > 0;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: hasBadge ? 1 : 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  }, [hasBadge]);

  if (!hasBadge) return null;

  const isDot = count === undefined;

  return (
    <Animated.View
      style={[
        count && count > 0 ? styles.countBadge : styles.badgeDot,
        { transform: [{ scale }] },
      ]}
    >
      {count && count > 0 ? (
        <Text style={styles.countBadgeText} numberOfLines={1}>
          {count > 99 ? '99+' : count}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export default function AdminDashboardHeader({
  yardName = 'Rapid Logistics Yard',
  onMenuPress,
  onNotificationPress,
  onProfilePress,
  onYardBadgePress,
  hasUnreadNotification = false,
  unreadCount,
  userInitial,
}: AdminDashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  const showBadge = hasUnreadNotification || (!!unreadCount && unreadCount > 0);
  const notificationLabel = showBadge
    ? `Notifications, ${unreadCount ? `${unreadCount} unread` : 'unread'}`
    : 'Notifications';

  return (
    <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
      <View style={styles.headerBar}>
        {/* Left Side: 3-line hamburger menu */}
        <PressableIcon
          style={styles.iconButton}
          onPress={onMenuPress}
          accessibilityLabel="Open side navigation menu"
        >
          <Menu size={22} color="#0F172A" strokeWidth={2.2} />
        </PressableIcon>

        {/* Center: Yard Name Badge */}
        <View style={styles.centerContainer}>
          <TouchableOpacity
            style={styles.yardBadge}
            onPress={onYardBadgePress}
            activeOpacity={onYardBadgePress ? 0.7 : 1}
            disabled={!onYardBadgePress}
            accessibilityRole={onYardBadgePress ? 'button' : 'text'}
            accessibilityLabel={`Current yard: ${yardName}`}
          >
            <Building2 size={14} color="#0062FF" strokeWidth={2.2} style={styles.yardIcon} />
            <Text style={styles.yardNameText} numberOfLines={1}>
              {yardName}
            </Text>
            {onYardBadgePress && (
              <ChevronDown size={14} color="#64748B" strokeWidth={2.2} style={styles.chevronIcon} />
            )}
          </TouchableOpacity>
        </View>

        {/* Right Side: Bell Icon + Profile Icon */}
        <View style={styles.rightContainer}>
          <PressableIcon
            style={styles.iconButton}
            onPress={onNotificationPress}
            accessibilityLabel={notificationLabel}
          >
            <Bell size={21} color="#0F172A" strokeWidth={2} />
            <NotificationBadge count={showBadge ? (unreadCount ?? undefined) : undefined} />
            {showBadge && unreadCount === undefined && (
              <View style={styles.badgeDot} />
            )}
          </PressableIcon>

          <PressableIcon
            style={styles.profileButton}
            onPress={onProfilePress}
            accessibilityLabel="Profile"
          >
            <View style={styles.avatarCircle}>
              {userInitial ? (
                <Text style={styles.avatarText}>{userInitial.toUpperCase()}</Text>
              ) : (
                <User size={18} color="#FFFFFF" strokeWidth={2.2} />
              )}
            </View>
          </PressableIcon>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  yardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxWidth: '96%',
  },
  yardIcon: {
    marginRight: 6,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  yardNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EFF6FF',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});