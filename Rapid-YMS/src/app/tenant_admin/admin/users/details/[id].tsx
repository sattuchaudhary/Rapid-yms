import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Mail,
  Phone,
  PhoneCall,
  MessageSquare,
  Shield,
  Calendar,
  KeyRound,
  UserX,
  UserCheck,
  LogOut,
  Pencil,
  Lock,
  X,
  MapPin,
  FileText,
  CreditCard,
  Eye,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { apiRequest } from '@/services/api';
import { YardUser, ROLE_META } from '../types';

export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16);

  // State
  const [user, setUser] = useState<YardUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals state
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('Document Preview');

  // Reset form state
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Fetch User Details from Live API
  const fetchUserDetails = useCallback(async () => {
    if (!id) return;
    try {
      const response = await apiRequest(`/api/users/${id}`);
      const userData = response?.data || response;
      if (userData && userData.id) {
        setUser(userData);
      }
    } catch (err: any) {
      console.warn('[Fetch User Details Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Re-fetch on focus so updates from Edit Page appear immediately
  useFocusEffect(
    useCallback(() => {
      fetchUserDetails();
    }, [fetchUserDetails])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserDetails();
  }, [fetchUserDetails]);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  // Open Edit User Page (reusing the clean Add/Edit User screen)
  const handleNavigateToEdit = () => {
    if (!user) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push(`/tenant_admin/admin/users/add?id=${user.id}` as any);
  };

  // Direct Communication Handlers
  const handleCall = () => {
    if (user?.phone) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Linking.openURL(`tel:${user.phone}`).catch(() => {
        Alert.alert('Unable to Call', 'Phone dialer could not be opened.');
      });
    } else {
      Alert.alert('No Phone Number', 'No contact phone number is registered for this staff.');
    }
  };

  const handleEmail = () => {
    if (user?.email) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Linking.openURL(`mailto:${user.email}`).catch(() => {
        Alert.alert('Unable to Email', 'Mail client could not be opened.');
      });
    }
  };

  const handleMessage = () => {
    if (user?.phone) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Linking.openURL(`sms:${user.phone}`).catch(() => {
        Alert.alert('Unable to SMS', 'SMS client could not be opened.');
      });
    } else {
      Alert.alert('No Phone Number', 'No mobile number registered.');
    }
  };

  // Save Password Reset
  const handleSavePasswordReset = async () => {
    const passwordToSet = newPassword.trim() || 'password123';
    if (passwordToSet.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setResetSubmitting(true);
      await apiRequest(`/api/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: passwordToSet }),
      });
      setShowResetModal(false);
      setNewPassword('');
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Success', `Password for ${user?.name} has been reset to "${passwordToSet}".`);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Unable to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = () => {
    if (!user) return;
    const isCurrentlyActive = user.status === 'ACTIVE';
    const actionLabel = isCurrentlyActive ? 'Deactivate' : 'Activate';

    Alert.alert(
      `${actionLabel} Account?`,
      `Are you sure you want to ${actionLabel.toLowerCase()} access for ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
            try {
              await apiRequest(`/api/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: nextStatus }),
              });
              setUser((prev) => (prev ? { ...prev, status: nextStatus } : null));
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              }
              Alert.alert('Updated', `Account has been marked as ${nextStatus.toLowerCase()}.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update account status.');
            }
          },
        },
      ]
    );
  };

  // Revoke Remote Sessions
  const handleForceLogout = () => {
    if (!user) return;
    Alert.alert(
      'Revoke Remote Session',
      `Force sign out ${user.name} from all active devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/users/${id}/force-logout`, {
                method: 'POST',
              });
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              Alert.alert('Session Revoked', `All active sessions for ${user.name} have been logged out.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke remote session.');
            }
          },
        },
      ]
    );
  };

  // Open Document Preview Modal
  const handleOpenDocPreview = (uri: string, title: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    setPreviewImageUri(uri);
    setPreviewImageTitle(title);
  };

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: topPadding }]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Fetching staff details...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.errorScreen, { paddingTop: topPadding }]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <Text style={styles.errorTitle}>User Not Found</Text>
        <Text style={styles.errorSubtitle}>The requested staff profile does not exist.</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={handleBack}>
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
  const isActive = user.status === 'ACTIVE';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>User Details</Text>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleNavigateToEdit}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <Pencil size={18} color="#0F172A" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]}
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
        {/* ============================================================ */}
        {/* HERO PROFILE CARD                                            */}
        {/* ============================================================ */}
        <View style={styles.heroCard}>
          {/* Avatar Profile Photo or Initials */}
          {user.photoUri ? (
            <TouchableOpacity
              onPress={() => handleOpenDocPreview(user.photoUri!, `${user.name} - Profile Photo`)}
              activeOpacity={0.88}
            >
              <Image source={{ uri: user.photoUri }} style={styles.heroPhotoAvatar} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.avatarOuter, { backgroundColor: roleInfo.avatarBg }]}>
              <Text style={[styles.avatarText, { color: roleInfo.avatarTextColor }]}>
                {initials}
              </Text>
            </View>
          )}

          {/* Name & Email */}
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>

          {/* Badges Row */}
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: roleInfo.badgeBg,
                  borderColor: roleInfo.badgeBorder,
                },
              ]}
            >
              <Shield size={12} color={roleInfo.badgeTextColor} strokeWidth={2.4} />
              <Text style={[styles.roleBadgeText, { color: roleInfo.badgeTextColor }]}>
                {roleInfo.label}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                isActive ? styles.activeStatusBadge : styles.inactiveStatusBadge,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? '#16A34A' : '#94A3B8' },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isActive ? '#15803D' : '#64748B' },
                ]}
              >
                {isActive ? 'Active Staff' : 'Deactivated'}
              </Text>
            </View>
          </View>

          {/* Quick Contact Action Buttons */}
          <View style={styles.quickActionsBar}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleCall}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <PhoneCall size={18} color="#0062FF" strokeWidth={2.2} />
              </View>
              <Text style={styles.quickActionLabel}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleEmail}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Mail size={18} color="#7C3AED" strokeWidth={2.2} />
              </View>
              <Text style={styles.quickActionLabel}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleMessage}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <MessageSquare size={18} color="#16A34A" strokeWidth={2.2} />
              </View>
              <Text style={styles.quickActionLabel}>SMS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* SECTION 1: CONTACT INFORMATION                               */}
        {/* ============================================================ */}
        <View style={styles.infoSectionCard}>
          <Text style={styles.sectionHeaderTitle}>CONTACT INFORMATION</Text>

          {/* Email */}
          <View style={styles.infoRowItem}>
            <View style={styles.infoIconWrapper}>
              <Mail size={16} color="#64748B" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>Email Address</Text>
              <Text style={styles.infoItemValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Phone */}
          <View style={styles.infoRowItem}>
            <View style={styles.infoIconWrapper}>
              <Phone size={16} color="#64748B" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>Mobile Number</Text>
              <Text style={styles.infoItemValue}>
                {user.phone || 'Not provided'}
              </Text>
            </View>
          </View>

          {/* Emergency Contact */}
          {user.emergencyContact ? (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.infoRowItem}>
                <View style={[styles.infoIconWrapper, { backgroundColor: '#FFF7ED' }]}>
                  <PhoneCall size={16} color="#EA580C" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoItemLabel}>Emergency Contact Number</Text>
                  <Text style={styles.infoItemValue}>{user.emergencyContact}</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Date of Birth (DOB) */}
          {user.dob ? (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.infoRowItem}>
                <View style={[styles.infoIconWrapper, { backgroundColor: '#F5F3FF' }]}>
                  <Calendar size={16} color="#7C3AED" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoItemLabel}>Date of Birth (DOB)</Text>
                  <Text style={styles.infoItemValue}>
                    {new Date(user.dob).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Address */}
          {user.address ? (
            <>
              <View style={styles.cardDivider} />
              <View style={styles.infoRowItem}>
                <View style={styles.infoIconWrapper}>
                  <MapPin size={16} color="#64748B" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoItemLabel}>Resident Address</Text>
                  <Text style={styles.infoItemValue}>{user.address}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* ============================================================ */}
        {/* SECTION 2: ROLE & TIMELINE (CLEAN & DYNAMIC)                 */}
        {/* ============================================================ */}
        <View style={styles.infoSectionCard}>
          <Text style={styles.sectionHeaderTitle}>ROLE & ACCESS LEVEL</Text>

          {/* Assigned Role */}
          <View style={styles.infoRowItem}>
            <View
              style={[
                styles.infoIconWrapper,
                { backgroundColor: roleInfo.avatarBg, borderColor: roleInfo.badgeBorder },
              ]}
            >
              <Shield size={16} color={roleInfo.badgeTextColor} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>Assigned Role</Text>
              <Text style={[styles.infoItemValue, { color: roleInfo.badgeTextColor }]}>
                {roleInfo.label}
              </Text>
            </View>
          </View>

          {/* Permission Level */}
          <View style={styles.cardDivider} />
          <View style={styles.infoRowItem}>
            <View style={[styles.infoIconWrapper, { backgroundColor: '#F0FDF4' }]}>
              <Shield size={16} color="#16A34A" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>Permission Level</Text>
              <Text style={[styles.infoItemValue, { color: '#15803D' }]}>
                {user.permissionLevel === 'FULL_ACCESS'
                  ? 'Full Administrative Access'
                  : user.permissionLevel === 'VIEW_ONLY'
                  ? 'View Only Access'
                  : 'Standard Operational Access'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Joining Date */}
          <View style={styles.infoRowItem}>
            <View style={[styles.infoIconWrapper, { backgroundColor: '#EFF6FF' }]}>
              <Calendar size={16} color="#0062FF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>Joining / Registration Date</Text>
              <Text style={styles.infoItemValue}>
                {user.joiningDate
                  ? new Date(user.joiningDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Active since registration'}
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* SECTION 3: DOCUMENTATION & KYC                               */}
        {/* ============================================================ */}
        <View style={styles.infoSectionCard}>
          <Text style={styles.sectionHeaderTitle}>GOVERNMENT ID & KYC</Text>

          <View style={styles.infoRowItem}>
            <View style={[styles.infoIconWrapper, { backgroundColor: '#F0F9FF' }]}>
              <CreditCard size={16} color="#0284C7" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoItemLabel}>ID Document Type</Text>
              <Text style={styles.infoItemValue}>
                {user.docType ? user.docType.replace('_', ' ') : 'Aadhaar Card'}
              </Text>
            </View>
          </View>

          {/* Document Thumbnails (Front & Back) */}
          {user.docFrontUri || user.docBackUri ? (
            <View style={styles.docsPreviewRow}>
              {user.docFrontUri ? (
                <TouchableOpacity
                  style={styles.docCardSlot}
                  onPress={() =>
                    handleOpenDocPreview(
                      user.docFrontUri!,
                      `${user.name} - ${user.docType || 'ID'} (Front)`
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: user.docFrontUri }} style={styles.docImage} />
                  <View style={styles.docCardLabelTag}>
                    <Eye size={12} color="#FFFFFF" />
                    <Text style={styles.docCardLabelText}>Front Side</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {user.docBackUri ? (
                <TouchableOpacity
                  style={styles.docCardSlot}
                  onPress={() =>
                    handleOpenDocPreview(
                      user.docBackUri!,
                      `${user.name} - ${user.docType || 'ID'} (Back)`
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: user.docBackUri }} style={styles.docImage} />
                  <View style={styles.docCardLabelTag}>
                    <Eye size={12} color="#FFFFFF" />
                    <Text style={styles.docCardLabelText}>Back Side</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyDocBox}>
              <FileText size={24} color="#94A3B8" strokeWidth={1.8} />
              <Text style={styles.emptyDocText}>
                No KYC documents uploaded during registration.
              </Text>
            </View>
          )}
        </View>

        {/* ============================================================ */}
        {/* SECTION 4: ADMINISTRATIVE MANAGEMENT ACTIONS                 */}
        {/* ============================================================ */}
        <View style={styles.infoSectionCard}>
          <Text style={styles.sectionHeaderTitle}>ACCOUNT ACTIONS</Text>

          {/* Edit Details */}
          <TouchableOpacity
            style={styles.adminActionRow}
            onPress={handleNavigateToEdit}
            activeOpacity={0.75}
          >
            <View style={[styles.adminActionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Pencil size={17} color="#0062FF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminActionTitle}>Edit Staff Details</Text>
              <Text style={styles.adminActionDesc}>Update contact info, address, role, or KYC</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Reset Password */}
          <TouchableOpacity
            style={styles.adminActionRow}
            onPress={() => setShowResetModal(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.adminActionIcon, { backgroundColor: '#F5F3FF' }]}>
              <KeyRound size={17} color="#7C3AED" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminActionTitle}>Reset Login Password</Text>
              <Text style={styles.adminActionDesc}>Set a new custom or default password</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Revoke Remote Sessions */}
          <TouchableOpacity
            style={styles.adminActionRow}
            onPress={handleForceLogout}
            activeOpacity={0.75}
          >
            <View style={[styles.adminActionIcon, { backgroundColor: '#FFF7ED' }]}>
              <LogOut size={17} color="#EA580C" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminActionTitle}>Revoke Active Sessions</Text>
              <Text style={styles.adminActionDesc}>Force sign out this staff from all devices</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          {/* Toggle Active / Deactivate */}
          <TouchableOpacity
            style={styles.adminActionRow}
            onPress={handleToggleStatus}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.adminActionIcon,
                { backgroundColor: isActive ? '#FEF2F2' : '#F0FDF4' },
              ]}
            >
              {isActive ? (
                <UserX size={17} color="#DC2626" strokeWidth={2.2} />
              ) : (
                <UserCheck size={17} color="#16A34A" strokeWidth={2.2} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.adminActionTitle,
                  { color: isActive ? '#DC2626' : '#16A34A' },
                ]}
              >
                {isActive ? 'Deactivate Staff Account' : 'Activate Staff Account'}
              </Text>
              <Text style={styles.adminActionDesc}>
                {isActive
                  ? 'Temporarily disable yard login access'
                  : 'Re-enable yard login and operational permissions'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* FULL IMAGE PREVIEW MODAL                                     */}
      {/* ============================================================ */}
      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeaderTitle} numberOfLines={1}>
              {previewImageTitle}
            </Text>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewImageUri(null)}
              activeOpacity={0.7}
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewImageContainer}>
            {previewImageUri ? (
              <Image
                source={{ uri: previewImageUri }}
                style={styles.previewFullImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* RESET PASSWORD MODAL                                         */}
      {/* ============================================================ */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResetModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={() => setShowResetModal(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Login Password</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowResetModal(false)}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFormContent}>
              <Text style={styles.resetModalDesc}>
                Set a new password for {user.name}. Staff will be required to log in with this new password.
              </Text>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>New Password</Text>
                <View style={styles.modalInputBox}>
                  <Lock size={16} color="#64748B" />
                  <TextInput
                    style={styles.modalInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password (min 6 chars)"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, resetSubmitting && styles.modalSubmitBtnDisabled]}
                onPress={handleSavePasswordReset}
                disabled={resetSubmitting}
                activeOpacity={0.88}
              >
                {resetSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '600',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  errorBackBtn: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroPhotoAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#EDE9FE',
    marginBottom: 10,
  },
  avatarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  heroEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  activeStatusBadge: {
    backgroundColor: '#F0FDF4',
  },
  inactiveStatusBadge: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionsBar: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    justifyContent: 'space-around',
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  quickActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  infoSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoItemLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  infoItemValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  docsPreviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  docCardSlot: {
    flex: 1,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  docImage: {
    width: '100%',
    height: '100%',
  },
  docCardLabelTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docCardLabelText: {
    fontSize: 10.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyDocBox: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyDocText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  adminActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  adminActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminActionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  // Image Preview Modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  previewHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewFullImage: {
    width: '100%',
    height: '100%',
  },

  // Reset Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFormContent: {
    gap: 12,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalInputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  modalInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    gap: 10,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  resetModalDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 4,
  },
  modalSubmitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#A78BFA',
    shadowOpacity: 0.1,
  },
  modalSubmitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
