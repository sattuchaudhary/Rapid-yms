import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAuthToken, getUserInfo } from '@/services/api';
import { UserSession } from '@/types/roles';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await getAuthToken();
        const user = await getUserInfo();

        if (token && user) {
          const role = (user.role || '').toUpperCase();
          console.log(`[Index] User session found. Role: ${role}`);

          switch (role) {
            case 'SUPER_ADMIN':
              router.replace('/superadmin' as any);
              return;
            case 'TENANT_ADMIN':
            case 'ADMIN':
              router.replace('/tenant_admin/admin/dashboard' as any);
              return;
            case 'SUB_ADMIN':
              router.replace('/tenant_admin/sub_admin' as any);
              return;
            case 'MANAGER':
              router.replace('/tenant_admin/manager' as any);
              return;
            case 'SUPERVISOR':
              router.replace('/tenant_admin/supervisor' as any);
              return;
            case 'EXECUTIVE':
              router.replace('/tenant_admin/executive' as any);
              return;
            case 'GUARD':
            default:
              router.replace('/tenant_admin/guard' as any);
              return;
          }
        }
      } catch (err) {
        console.warn('[Index Bootstrap Error]', err);
      }

      // No active session found - route to Login
      router.replace('/login');
    };

    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F8FAFC" />
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text style={styles.text}>Loading Rapid YMS...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#64748B',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
});
