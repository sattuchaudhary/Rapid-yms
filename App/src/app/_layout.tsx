import { Stack, router } from 'expo-router';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useEffect } from 'react';
import { initDatabase } from '@/services/sqlite';
import { initializeSyncService } from '@/services/sync';
import { checkMidnightExpiry } from '@/services/api';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize SQLite tables & Background Sync service
    initDatabase();
    initializeSyncService();

    // Check midnight expiry on mount and periodically
    const checkExpiry = async () => {
      try {
        const expired = await checkMidnightExpiry();
        if (expired) {
          router.replace('/login');
        }
      } catch (err) {
        console.warn('Failed checkMidnightExpiry:', err);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 15000); // Check every 15 seconds

    // Check when returning to foreground
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkExpiry();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="guard/dashboard" />
        <Stack.Screen name="guard/check-in" />
        <Stack.Screen name="guard/check-out" />
        <Stack.Screen name="guard/vehicle-details" />
        <Stack.Screen name="guard/vehicle-list" />
        <Stack.Screen name="guard/profile" />
        <Stack.Screen name="guard/calculate-charges" />
        <Stack.Screen name="guard/reports" />
        <Stack.Screen name="guard/kachha-to-pakka" />
        <Stack.Screen name="guard/banks" />
        <Stack.Screen name="guard/notifications" />
        <Stack.Screen name="admin/dashboard" />
      </Stack>
    </ThemeProvider>
  );
}
