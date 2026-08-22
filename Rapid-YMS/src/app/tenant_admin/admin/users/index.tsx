import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Users, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { apiRequest } from '@/services/api';
import { YardUser } from './types';
import UsersHeader from './header';
import UsersBottomBar from './bottomBar';
import UserCard from './components/UserCard';

export default function UserManagementScreen() {
  const router = useRouter();

  // State - 100% Live Backend Data
  const [users, setUsers] = useState<YardUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch Live Users from API
  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiRequest('/api/users');
      const userList = response?.data || (Array.isArray(response) ? response : []);
      if (Array.isArray(userList)) {
        setUsers(userList);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.warn('[Fetch Live Users Error]', err);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, [fetchUsers]);

  // Handle Card Press -> Navigate to User Details Page
  const handleUserPress = (user: YardUser) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(`/tenant_admin/admin/users/details/${user.id}` as any);
  };

  // Handle Add User Press -> Navigate to Separate Register Page
  const handleNavigateToAddUser = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push('/tenant_admin/admin/users/add' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header: Back (Left) • Users (Middle) • 3-dot (Right) */}
      <UsersHeader
        title="Users"
        onBackPress={() => router.back()}
        onMenuPress={handleNavigateToAddUser}
      />

      {/* Body: Live Clean List of Users */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Fetching yard staff...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#7C3AED']}
              tintColor="#7C3AED"
            />
          }
        >
          {users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Users size={36} color="#94A3B8" strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>No Staff Registered Yet</Text>
              <Text style={styles.emptyDesc}>
                Tap the button below to register sub-admins, managers, supervisors, executives, or gate guards.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={handleNavigateToAddUser}
                activeOpacity={0.8}
              >
                <UserPlus size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.emptyAddBtnText}>Add First User</Text>
              </TouchableOpacity>
            </View>
          ) : (
            users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onPress={handleUserPress}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Sticky Bottom Bar with Add User Button */}
      <UsersBottomBar
        mode="action"
        addLabel="Add New User"
        onAddPress={handleNavigateToAddUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110, // Space for bottom bar
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
