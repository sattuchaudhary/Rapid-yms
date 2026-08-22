import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { ChevronRight, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { YardUser, ROLE_META } from '../types';

export interface UserCardProps {
  user: YardUser;
  onPress?: (user: YardUser) => void;
}

export default function UserCard({ user, onPress }: UserCardProps) {
  const roleInfo = ROLE_META[user.role] || ROLE_META.GUARD;
  const initials = user.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const handlePress = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress?.(user);
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handlePress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`User ${user.name}`}
    >
      {/* Profile Icon / Initials Avatar */}
      <View
        style={[
          styles.avatarCircle,
          { backgroundColor: roleInfo.avatarBg },
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            { color: roleInfo.avatarTextColor },
          ]}
        >
          {initials}
        </Text>
      </View>

      {/* User Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name}
        </Text>
      </View>

      {/* Right Chevron Arrow */}
      <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
});
