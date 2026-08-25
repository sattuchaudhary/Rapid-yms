import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MoreVertical } from 'lucide-react-native';

export interface ReleaseHeaderProps {
  vehicleNumber?: string;
  subtitle?: string;
  onBackPress: () => void;
  onMenuPress?: () => void;
}

export default function ReleaseHeader({
  vehicleNumber,
  subtitle,
  onBackPress,
  onMenuPress,
}: ReleaseHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'ios' ? 44 : 10);

  return (
    <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
      <View style={styles.headerBar}>
        {/* Left: Back Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onBackPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Middle: Vehicle Number & Subtitle */}
        <View style={styles.headerTitleBox}>
          <Text style={styles.vehicleNumberTitle} numberOfLines={1}>
            {vehicleNumber ? vehicleNumber.toUpperCase() : 'VEHICLE RELEASE'}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: Optional Menu or Spacer */}
        {onMenuPress ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onMenuPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Options"
          >
            <MoreVertical size={20} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacerBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 20,
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  spacerBtn: {
    width: 36,
    height: 36,
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  vehicleNumberTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
});
