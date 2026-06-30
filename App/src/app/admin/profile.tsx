import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, ChevronLeft, ChevronRight, Lock, LogOut, Settings, Check, WifiOff } from 'lucide-react-native';
import { getUserInfo, saveUserInfo, UserSession, apiRequest, clearTokens, getProfileImage, setProfileImage } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [profilePic, setProfilePic] = useState('');

  // Change Password Modal States
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // App Settings Modal States
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [syncInterval, setSyncInterval] = useState('15');
  const [warningEnabled, setWarningEnabled] = useState(true);

  // Connection State
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const interval = await AsyncStorage.getItem('yms_settings_sync_interval');
        if (interval) setSyncInterval(interval);
        
        const warning = await AsyncStorage.getItem('yms_settings_warning_enabled');
        if (warning !== null) setWarningEnabled(warning === 'true');
      } catch (e) {
        console.warn('[ProfileSettings] Load failed:', e);
      }
    };
    loadSettings();
  }, []);

  const loadPic = async () => {
    const pic = await getProfileImage();
    if (pic) setProfilePic(pic);
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const netInfo = await NetInfo.fetch();
      const online = !!netInfo.isConnected;

      if (!online) {
        Alert.alert('Offline Mode', 'Cannot change password while offline.');
        setChangingPassword(false);
        return;
      }

      const res = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      if (res.success) {
        Alert.alert('Success', 'Password updated successfully.');
        // Update cached offline credentials
        await SecureStore.setItemAsync('yms_cached_password', newPassword);
        setPasswordModalVisible(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Failed', res.message || res.error || 'Password update failed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Server connection failed.');
    } finally {
      setChangingPassword(false);
    }
  };

  const changeProfilePic = async () => {
    Alert.alert(
      'Profile Photo',
      'Select action for profile picture',
      [
        { text: 'Take Photo', onPress: () => captureProfilePic() },
        { text: 'Choose from Gallery', onPress: () => pickProfilePic() },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => {
            setProfilePic('');
            await setProfileImage('');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const captureProfilePic = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProfilePic(compressed.uri);
        await setProfileImage(compressed.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not capture photo');
    }
  };

  const pickProfilePic = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProfilePic(compressed.uri);
        await setProfileImage(compressed.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick photo');
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      // 1. Get cached info first for immediate render
      const info = await getUserInfo();
      if (info) {
        setCurrentUser(info);
      }

      // 2. Fetch fresh details from the backend
      try {
        const res = await apiRequest('/api/auth/profile');
        if (res.success && res.data) {
          setCurrentUser(res.data);
          await saveUserInfo(res.data);
        }
      } catch (err) {
        console.warn('[ProfileScreen] Failed to refresh user profile from backend:', err);
      }
    };
    loadUser();
    loadPic();
  }, []);

  const formatRole = (roleStr: string | undefined) => {
    if (!roleStr) return 'Yard Operator';
    // Format e.g., 'TENANT_ADMIN' -> 'Yard Manager', 'GUARD' -> 'Yard Guard'
    if (roleStr === 'SUPER_ADMIN' || roleStr === 'TENANT_ADMIN') {
      return 'Yard Manager';
    }
    if (roleStr === 'GUARD') {
      return 'Yard Guard';
    }
    return roleStr.charAt(0) + roleStr.slice(1).toLowerCase().replace('_', ' ');
  };

  const handleAction = (label: string) => {
    if (label === 'Change Password') {
      setPasswordModalVisible(true);
    } else if (label === 'App Settings') {
      setSettingsModalVisible(true);
    } else {
      Alert.alert(label, `${label} settings feature coming soon in version 1.1.`);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of the Yard Management system?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Connection status banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#D97706" style={{ marginRight: 6 }} />
          <ThemedText style={styles.offlineBannerText}>
            Viewing cached profile details (Offline Mode)
          </ThemedText>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <TouchableOpacity 
            activeOpacity={0.85} 
            onPress={changeProfilePic}
            style={styles.avatarWrapper}
          >
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarInitialsContainer]}>
                <ThemedText style={styles.avatarInitialsText}>
                  {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <Camera size={14} color="#FFFFFF" />
            </View>
            <View style={styles.activeDot} />
          </TouchableOpacity>
          <View style={styles.profileMeta}>
            <ThemedText style={styles.profileRole}>
              {currentUser?.name || formatRole(currentUser?.role)}
            </ThemedText>
            <ThemedText style={styles.profileEmail}>
              {currentUser?.email || 'N/A'}
            </ThemedText>
            <ThemedText style={styles.profilePhone}>
              {currentUser?.phone || currentUser?.tenant?.phone || 'N/A'}
            </ThemedText>
          </View>
        </View>

        {/* Yard Information Card */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Yard Information</ThemedText>
          
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Yard Name</ThemedText>
            <ThemedText style={styles.infoValue}>
              {currentUser?.tenant?.yardName || 'N/A'}
            </ThemedText>
          </View>

          <View style={styles.infoRowDivider} />

          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Address</ThemedText>
            <ThemedText style={[styles.infoValue, { flex: 2, textAlign: 'right' }]}>
              {currentUser?.tenant?.address || 'N/A'}
            </ThemedText>
          </View>
        </View>

        {/* Settings Links */}
        <View style={styles.sectionCard}>
          <TouchableOpacity 
            style={styles.actionRow} 
            activeOpacity={0.7}
            onPress={() => handleAction('Change Password')}
          >
            <View style={styles.actionLabelContainer}>
              <Lock size={18} color="#64748B" style={{ marginRight: 12 }} />
              <ThemedText style={styles.actionText}>Change Password</ThemedText>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity 
            style={styles.actionRow} 
            activeOpacity={0.7}
            onPress={() => handleAction('App Settings')}
          >
            <View style={styles.actionLabelContainer}>
              <Settings size={18} color="#64748B" style={{ marginRight: 12 }} />
              <ThemedText style={styles.actionText}>App Settings</ThemedText>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity 
            style={styles.actionRow} 
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View style={styles.actionLabelContainer}>
              <LogOut size={18} color="#EF4444" style={{ marginRight: 12 }} />
              <ThemedText style={[styles.actionText, { color: '#EF4444' }]}>Logout</ThemedText>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* App Version Card */}
        <View style={styles.versionCard}>
          <ThemedText style={styles.versionLabel}>App Version</ThemedText>
          <ThemedText style={styles.versionValue}>1.0.0</ThemedText>
        </View>

        {/* Change Password Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={passwordModalVisible}
          onRequestClose={() => setPasswordModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
              
              <TextInput
                style={styles.modalInput}
                placeholder="New Password"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Confirm New Password"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCloseBtn]}
                  onPress={() => {
                    setPasswordModalVisible(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <ThemedText style={styles.modalCloseText}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalSaveBtn]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFF" style={{ marginRight: 4 }} />
                      <ThemedText style={styles.modalSaveText}>Update</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* App Settings Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={settingsModalVisible}
          onRequestClose={() => setSettingsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>App Settings</ThemedText>

              {/* Sync Interval Selector */}
              <ThemedText style={styles.settingsSubLabel}>Auto Sync Interval</ThemedText>
              <View style={styles.syncOptionsRow}>
                {['5', '15', '30'].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.syncOptionBtn,
                      syncInterval === mins && styles.syncOptionBtnSelected,
                    ]}
                    onPress={async () => {
                      setSyncInterval(mins);
                      await AsyncStorage.setItem('yms_settings_sync_interval', mins);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.syncOptionText,
                        syncInterval === mins && styles.syncOptionTextSelected,
                      ]}
                    >
                      {mins} Mins
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Warnings Switch */}
              <View style={styles.settingsRow}>
                <ThemedText style={styles.settingsLabelText}>Offline Warning Alerts</ThemedText>
                <Switch
                  value={warningEnabled}
                  onValueChange={async (val) => {
                    setWarningEnabled(val);
                    await AsyncStorage.setItem('yms_settings_warning_enabled', val ? 'true' : 'false');
                  }}
                  trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                  thumbColor={warningEnabled ? '#2563EB' : '#F1F5F9'}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, { marginTop: 20 }]}
                onPress={() => setSettingsModalVisible(false)}
              >
                <ThemedText style={styles.loginBtnText}>Save & Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 20,
    gap: 18,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#CBD5E1',
  },
  avatarInitialsContainer: {
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  profileRole: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  profilePhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoRowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  versionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  versionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  offlineBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#0F172A',
    height: 50,
    fontSize: 15,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  modalCloseBtn: {
    backgroundColor: '#64748B',
  },
  modalSaveBtn: {
    backgroundColor: '#2563EB',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  settingsSubLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  syncOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  syncOptionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  syncOptionBtnSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  syncOptionText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  syncOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  settingsLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
