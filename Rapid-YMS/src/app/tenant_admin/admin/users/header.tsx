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
import * as Haptics from 'expo-haptics';

export interface UsersHeaderProps {
  title?: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
}

export default function UsersHeader({
  title = 'Users',
  onBackPress,
  onMenuPress,
}: UsersHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onBackPress?.();
  };

  const handleMenu = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onMenuPress?.();
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
      <View style={styles.headerBar}>
        {/* Left: Back Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Middle: Title */}
        <View style={styles.centerContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right: 3-Dot Menu Options Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleMenu}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="User Options"
        >
          <MoreVertical size={21} color="#0F172A" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
