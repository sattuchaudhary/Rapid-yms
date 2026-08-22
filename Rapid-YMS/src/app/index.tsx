import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
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
      <View style={styles.brandingBox}>
        <Image
          source={require('../../assets/app logo and icon/app-icon-premium-512.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/app logo and icon/wordmark-premium.png')}
          style={styles.wordmarkLogo}
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator size="small" color="#0A5CF0" style={styles.loader} />
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
    paddingHorizontal: 24,
  },
  brandingBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoIcon: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#0A5CF0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  wordmarkLogo: {
    width: 220,
    height: 48,
  },
  loader: {
    marginTop: 8,
  },
  text: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
