import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Bell,
  Camera,
  Mail,
  Phone,
  Pencil,
  Building2,
  MapPin,
  CreditCard,
  Calendar,
  Lock,
  ShieldCheck,
  Smartphone,
  Globe,
  Palette,
  LogOut,
  ChevronRight,
  X,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react-native';

import {
  getUserInfo,
  getMyProfile,
  changeMyPassword,
  clearTokens,
  saveUserInfo,
} from '@/services/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    createdAt?: string;
    tenant?: {
      id: string;
      yardName: string;
      status: string;
      address?: string;
      phone?: string;
      createdAt?: string;
    };
  }>({
    id: 'TEN12345',
    name: 'Rohit Sharma',
    email: 'rohit@abcindustries.com',
    phone: '+91 98765 43210',
    role: 'Tenant Admin',
    createdAt: new Date().toISOString(),
    tenant: {
      id: 'TEN12345',
      yardName: 'ABC Industries Pvt. Ltd.',
      status: 'ACTIVE',
      address: 'Yard 12, Logistics Park, Jaipur',
      phone: '+91 98765 43210',
      createdAt: new Date('2024-01-15').toISOString(),
    },
  });

  // Modals state
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Load Profile from API
  const loadProfile = useCallback(async () => {
    try {
      // 1. First get cached session
      const cached = await getUserInfo();
      if (cached) {
        setUserProfile((prev) => ({
          ...prev,
          id: cached.id || prev.id,
          name: cached.name || prev.name,
          email: cached.email || prev.email,
          phone: cached.phone || prev.phone,
          role: cached.role?.replace(/_/g, ' ') || 'Tenant Admin',
          tenant: {
            id: cached.tenant?.id || cached.tenantId || prev.tenant?.id || 'TEN12345',
            yardName: cached.tenant?.yardName || prev.tenant?.yardName || 'Yard Management Hub',
            status: cached.tenant?.status || 'ACTIVE',
            address: prev.tenant?.address || 'Logistics Yard Hub',
            phone: cached.phone || prev.tenant?.phone,
            createdAt: prev.tenant?.createdAt,
          },
        }));
      }

      // 2. Fetch fresh profile from API
      const res = await getMyProfile();
      if (res?.data) {
        const u = res.data;
        setUserProfile({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '+91 98765 43210',
          role: (u.role || 'TENANT_ADMIN').replace(/_/g, ' '),
          createdAt: u.createdAt,
          tenant: {
            id: u.tenant?.id || 'TEN12345',
            yardName: u.tenant?.yardName || 'ABC Industries Pvt. Ltd.',
            status: u.tenant?.status || 'ACTIVE',
            address: u.tenant?.address || 'Yard 12, Logistics Park, Jaipur',
            phone: u.tenant?.phone || u.phone || '+91 98765 43210',
            createdAt: u.tenant?.createdAt,
          },
        });
      }
    } catch (err) {
      console.warn('[Load Profile Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
  };

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const handleOpenEditProfile = () => {
    setEditName(userProfile.name);
    setEditPhone(userProfile.phone);
    setEditProfileModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }

    try {
      const updated = {
        ...userProfile,
        name: editName.trim(),
        phone: editPhone.trim(),
      };
      setUserProfile(updated);
      await saveUserInfo({
        id: userProfile.id,
        name: editName.trim(),
        email: userProfile.email,
        phone: editPhone.trim(),
        role: userProfile.role as any,
        tenantId: userProfile.tenant?.id,
        tenant: userProfile.tenant as any,
      });
      setEditProfileModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile.');
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    try {
      setPasswordLoading(true);
      await changeMyPassword(newPassword);
      setChangePasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to sign out from your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await clearTokens();
            router.replace('/login' as any);
          },
        },
      ]
    );
  };

  const formatMemberDate = (d?: string) => {
    if (!d) return '15 Jan 2024';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '15 Jan 2024';
    }
  };

  const tenantShortId = (userProfile.tenant?.id || 'TEN12345').toUpperCase().slice(0, 8);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* 1. Dashboard Style Clean Header Bar */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerBar}>
          {/* Left: Back Button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Center: Title & Role Subtitle */}
          <View style={styles.headerCenterBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              My Profile
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {userProfile.role}
            </Text>
          </View>

          {/* Right: Notification Bell Button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => Alert.alert('Notifications', 'No new notifications at this time.')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color="#0F172A" strokeWidth={2} />
            <View style={styles.notificationBadgeDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Body */}
      <ScrollView
        style={styles.scrollBody}
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
        {/* 2. Hero Profile Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {/* Left: Avatar with Camera Badge */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <View style={styles.avatarHead} />
                <View style={styles.avatarShoulders} />
              </View>

              <TouchableOpacity
                style={styles.cameraBadge}
                activeOpacity={0.8}
                onPress={() => Alert.alert('Profile Photo', 'Photo upload option')}
              >
                <Camera size={12} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Right: Info & Edit Profile Button */}
            <View style={styles.heroInfoContainer}>
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroUserName} numberOfLines={1}>
                    {userProfile.name}
                  </Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{userProfile.role}</Text>
                  </View>
                </View>

                {/* Edit Profile Outline Button */}
                <TouchableOpacity
                  style={styles.editProfileBtn}
                  onPress={handleOpenEditProfile}
                  activeOpacity={0.75}
                >
                  <Pencil size={11} color="#0062FF" strokeWidth={2.4} />
                  <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Email */}
              <View style={styles.heroMetaRow}>
                <Mail size={13} color="#64748B" strokeWidth={2} />
                <Text style={styles.heroMetaText} numberOfLines={1}>
                  {userProfile.email}
                </Text>
              </View>

              {/* Phone */}
              <View style={styles.heroMetaRow}>
                <Phone size={13} color="#64748B" strokeWidth={2} />
                <Text style={styles.heroMetaText} numberOfLines={1}>
                  {userProfile.phone}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Section 1: Organization / Tenant Details */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>Organization / Tenant Details</Text>

          <View style={styles.cardGroup}>
            {/* Tenant Name */}
            <View style={styles.groupItemRow}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Building2 size={17} color="#0062FF" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemLabel}>Tenant / Company Name</Text>
                <Text style={styles.itemValue}>{userProfile.tenant?.yardName || 'ABC Industries Pvt. Ltd.'}</Text>
              </View>
            </View>

            <View style={styles.itemDivider} />

            {/* Yard Location */}
            <View style={styles.groupItemRow}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <MapPin size={17} color="#0062FF" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemLabel}>Yard / Location</Text>
                <Text style={styles.itemValue}>{userProfile.tenant?.address || 'Yard 12, Logistics Park, Jaipur'}</Text>
              </View>
            </View>

            <View style={styles.itemDivider} />

            {/* Tenant ID */}
            <View style={styles.groupItemRow}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <CreditCard size={17} color="#0062FF" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemLabel}>Tenant ID</Text>
                <Text style={styles.itemValue}>{tenantShortId}</Text>
              </View>
            </View>

            <View style={styles.itemDivider} />

            {/* Member Since */}
            <View style={styles.groupItemRow}>
              <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Calendar size={17} color="#0062FF" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemLabel}>Member Since</Text>
                <Text style={styles.itemValue}>{formatMemberDate(userProfile.tenant?.createdAt || userProfile.createdAt)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Section 2: Account & Security */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>Account & Security</Text>

          <View style={styles.cardGroup}>
            {/* Change Password */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => setChangePasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#F5F3FF' }]}>
                <Lock size={17} color="#7C3AED" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Change Password</Text>
                <Text style={styles.itemActionSub}>Update your account password</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Security */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => Alert.alert('Security', 'Two-factor authentication & login activity settings.')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <ShieldCheck size={17} color="#059669" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Security</Text>
                <Text style={styles.itemActionSub}>Two-factor authentication, login activity</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Devices */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => Alert.alert('Devices', '1 active session (Current Device).')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#FAF5FF' }]}>
                <Smartphone size={17} color="#9333EA" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Devices</Text>
                <Text style={styles.itemActionSub}>Manage your logged-in devices</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Section 3: Preferences */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>Preferences</Text>

          <View style={styles.cardGroup}>
            {/* Notification Settings */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => Alert.alert('Notifications', 'Push & SMS notification alerts are active.')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <Bell size={17} color="#D97706" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Notification Settings</Text>
                <Text style={styles.itemActionSub}>Manage app notifications</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Language */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => Alert.alert('Language', 'Default language is set to English.')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Globe size={17} color="#0062FF" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Language</Text>
                <Text style={styles.itemActionSub}>English</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            {/* Theme */}
            <TouchableOpacity
              style={styles.groupItemRowAction}
              onPress={() => Alert.alert('Theme', 'Light Mode is active.')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconCircle, { backgroundColor: '#FFF1F2' }]}>
                <Palette size={17} color="#E11D48" strokeWidth={2} />
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemActionTitle}>Theme</Text>
                <Text style={styles.itemActionSub}>Light Mode</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Section 4: Logout Button */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <View style={styles.logoutIconBox}>
            <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
          </View>
          <View style={styles.logoutTextBox}>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutSubtitle}>Sign out from your account</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* 7. Edit Profile Modal */}
      <Modal
        visible={editProfileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter full name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 8. Change Password Modal */}
      <Modal
        visible={changePasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChangePasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 6 chars)"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Confirm New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#7C3AED' }]}
                onPress={handleChangePasswordSubmit}
                disabled={passwordLoading}
                activeOpacity={0.8}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.modalSaveBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // 1. Dashboard Style Clean White Header Bar
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  headerCenterBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  notificationBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },

  // Main Scroll Body
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // 2. Hero Profile Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  avatarHead: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#0062FF',
    marginBottom: 2,
  },
  avatarShoulders: {
    width: 48,
    height: 26,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#3B82F6',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroInfoContainer: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  heroUserName: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 16,
    gap: 4,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0062FF',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // Section Blocks
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    marginLeft: 2,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  groupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  groupItemRowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextBox: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  itemValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  itemActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemActionSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },

  // 6. Logout Card
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1.2,
    borderColor: '#FECDD3',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  logoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTextBox: {
    flex: 1,
  },
  logoutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  logoutSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBody: {
    paddingTop: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0062FF',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 18,
    gap: 6,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
