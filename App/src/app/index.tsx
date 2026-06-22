import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuthToken, getUserInfo, checkMidnightExpiry } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function IndexScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const expired = await checkMidnightExpiry();
        if (expired) {
          console.log('[Index] Session expired at midnight. Redirecting to login.');
          router.replace('/login');
          return;
        }

        const token = await getAuthToken();
        const user = await getUserInfo();

        if (token && user) {
          console.log(`[Index] User session found. Role: ${user.role}`);
          router.replace('/admin/dashboard');
        } else {
          console.log('[Index] No active session. Redirecting to login.');
          router.replace('/login');
        }
      } catch (error) {
        console.error('[Index] Error checking auth:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#10B981" />
        <ThemedText style={styles.text}>Initializing YMS Mobile...</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#6B7280',
  },
});
