import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AdminDashboardHeader from './header';
import DashboardDrawer from './dashboarddrawer';
import DashboardTopMetrics, {
  DashboardMetricsData,
  DashboardTimeFilter,
} from './components/DashboardTopMetrics';
import AdminDashboardBottomNavBar, {
  AdminDashboardTabKey,
} from '../navigation/admindashbordbottomnavbar';
import { getUserInfo, clearTokens, getVehicleSummary } from '@/services/api';
import { UserSession } from '@/types/roles';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminDashboardTabKey>('home');
  const [user, setUser] = useState<UserSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Top Section Live Metrics Data State
  const [selectedFilter, setSelectedFilter] = useState<DashboardTimeFilter>('all');
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metricsData, setMetricsData] = useState<DashboardMetricsData>({
    total: 0,
    inYard: 0,
    pakka: 0,
    kachha: 0,
    released: 0,
    shifting: 0,
  });



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

  const fetchMetrics = useCallback(async (filter: DashboardTimeFilter = selectedFilter) => {
    try {
      const now = new Date();
      let params: { startDate?: string; endDate?: string } = {};

      if (filter === 'today') {
        params = {
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString(),
        };
      } else if (filter === 'this_month') {
        params = {
          startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
        };
      }

      const summaryRes = await getVehicleSummary(params);
      if (summaryRes?.success && summaryRes?.data) {
        const d = summaryRes.data;
        const pakka = d.pakka || 0;
        const kachha = d.kachha || 0;
        const inYard = d.inYard !== undefined ? d.inYard : (pakka + kachha);
        const total = d.all || 0;
        const released = d.released || 0;
        const shifting = d.shifting || 0;

        setMetricsData({
          total,
          inYard,
          pakka,
          kachha,
          released,
          shifting,
        });
      }
    } catch (err) {
      console.warn('[Dashboard Fetch Metrics Error]', err);
    } finally {
      setLoadingMetrics(false);
      setRefreshing(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    loadSession();
    fetchMetrics(selectedFilter);
  }, [fetchMetrics, selectedFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSession(), fetchMetrics(selectedFilter)]);
  };

  const handleFilterChange = (filter: DashboardTimeFilter) => {
    setSelectedFilter(filter);
    setLoadingMetrics(true);
    fetchMetrics(filter);
  };

  const handleCardPress = (metricKey: 'total' | 'inYard' | 'pakka' | 'kachha' | 'released' | 'shifting') => {
    let category = 'ALL';
    if (metricKey === 'pakka') category = 'PAKKA';
    else if (metricKey === 'kachha') category = 'KACHHA';
    else if (metricKey === 'released') category = 'RELEASED';
    else if (metricKey === 'shifting') category = 'SHIFTING';
    else if (metricKey === 'inYard' || metricKey === 'total') category = 'ALL';

    const filterParam = selectedFilter === 'today' ? 'today' : selectedFilter === 'this_month' ? 'this_month' : 'all_time';

    router.push({
      pathname: '/tenant_admin/admin/vehicles',
      params: {
        category,
        filter: filterParam,
      },
    } as any);
  };

  const handleTabPress = (tab: AdminDashboardTabKey) => {
    setActiveTab(tab);
    if (tab === 'add') {
      router.push('/tenant_admin/admin/vehicles/add' as any);
    } else if (tab === 'vehicles') {
      router.push('/tenant_admin/admin/vehicles' as any);
    } else if (tab === 'release') {
      router.push('/tenant_admin/admin/vehicles/release' as any);
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

      {/* Scrollable Dashboard Body */}
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0062FF']}
            tintColor="#0062FF"
          />
        }
      >
        {/* Top Summary Metrics Section */}
        <DashboardTopMetrics
          data={metricsData}
          loading={loadingMetrics}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          onCardPress={handleCardPress}
        />
      </ScrollView>

      {/* Admin Dashboard Bottom Navigation Bar */}
      <AdminDashboardBottomNavBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        badges={{
          vehicles: metricsData.inYard > 0 ? metricsData.inYard : undefined,
        }}
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
  scrollContent: {
    paddingBottom: 24,
  },
});
