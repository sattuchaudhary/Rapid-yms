import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AdminDashboardHeader from './header';
import DashboardDrawer from './dashboarddrawer';
import AdminDashboardBottomNavBar, {
  AdminDashboardTabKey,
} from '../navigation/admindashbordbottomnavbar';
import { getUserInfo, clearTokens } from '@/services/api';
import { UserSession } from '@/types/roles';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminDashboardTabKey>('home');
  const [user, setUser] = useState<UserSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await getUserInfo();
        if (session) {
          setUser(session);
        }
      } catch (err) {
        console.warn('[Dashboard Load Session Error]', err);
      }
    };
    loadSession();
  }, []);

  const handleTabPress = (tab: AdminDashboardTabKey) => {
    setActiveTab(tab);
    if (tab === 'vehicles') {
      router.push('/tenant_admin/admin/vehicles' as any);
    }
  };

  const handleMenuPress = () => {
    setDrawerOpen(true);
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'No unread notifications at the moment.');
  };

  const handleProfilePress = () => {
    Alert.alert(
      'Admin Profile',
      `Name: ${user?.name || 'Admin'}\nEmail: ${user?.email || 'N/A'}\nRole: ${user?.role || 'ADMIN'}`
    );
  };

  const handleLogout = async () => {
    await clearTokens();
    router.replace('/login');
  };

  const yardName = user?.tenant?.yardName || 'Rapid Logistics Yard';
  const userInitial = user?.name ? user.name.charAt(0) : 'A';
  const adminName = user?.name || 'Yard Admin';
  const adminEmail = user?.email || 'admin@rapidyms.com';
  const adminRole = user?.role || 'ADMIN';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Admin Dashboard Header */}
      <AdminDashboardHeader
        yardName={yardName}
        userInitial={userInitial}
        hasUnreadNotification={false}
        onMenuPress={handleMenuPress}
        onNotificationPress={handleNotificationPress}
        onProfilePress={handleProfilePress}
      />

      {/* Blank Dashboard Canvas (Ready for widgets/content) */}
      <View style={styles.contentArea} />

      {/* Admin Dashboard Bottom Navigation Bar */}
      <AdminDashboardBottomNavBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
      />

      {/* Smooth Side Navigation Drawer */}
      <DashboardDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        yardName={yardName}
        adminName={adminName}
        adminEmail={adminEmail}
        adminRole={adminRole}
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentArea: {
    flex: 1,
  },
});
