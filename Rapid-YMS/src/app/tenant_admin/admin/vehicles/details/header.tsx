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

export interface VehicleDetailHeaderProps {
  vehicleNumber?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
}

export default function VehicleDetailHeader({
  vehicleNumber = 'VEHICLE DETAILS',
  onBackPress,
  onMenuPress,
}: VehicleDetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  return (
    <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
      <View style={styles.headerBar}>
        {/* Left: Back Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBackPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Center: Vehicle Number */}
        <View style={styles.centerContainer}>
          <Text style={styles.vehicleNumberText} numberOfLines={1}>
            {vehicleNumber ? vehicleNumber.toUpperCase() : 'VEHICLE DETAILS'}
          </Text>
        </View>

        {/* Right: 3-Dot Options Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MoreVertical size={21} color="#0F172A" strokeWidth={2.2} />
        </TouchableOpacity>
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
    paddingHorizontal: 12,
  },
  vehicleNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
