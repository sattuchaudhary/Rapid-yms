import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getUserInfo, saveUserInfo, UserSession, apiRequest, clearTokens, getProfileImage, setProfileImage } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Settings,
  Shield,
  LogOut,
  Camera,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  const [profilePic, setProfilePic] = useState(defaultAvatar);

  const loadPic = async () => {
    const pic = await getProfileImage();
    if (pic) setProfilePic(pic);
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
            setProfilePic(defaultAvatar);
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
    Alert.alert(label, `${label} settings feature coming soon in version 1.1.`);
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <TouchableOpacity 
            activeOpacity={0.85} 
            onPress={changeProfilePic}
            style={styles.avatarWrapper}
          >
            <Image source={{ uri: profilePic }} style={styles.avatarImage} />
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
              {currentUser?.email || 'operator@ymsyard.com'}
            </ThemedText>
            <ThemedText style={styles.profilePhone}>
              {currentUser?.phone || currentUser?.tenant?.phone || '+91 9876543210'}
            </ThemedText>
          </View>
        </View>

        {/* Yard Information Card */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Yard Information</ThemedText>
          
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Yard Name</ThemedText>
            <ThemedText style={styles.infoValue}>
              {currentUser?.tenant?.yardName || 'Mumbai Yard'}
            </ThemedText>
          </View>

          <View style={styles.infoRowDivider} />

          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Address</ThemedText>
            <ThemedText style={[styles.infoValue, { flex: 2, textAlign: 'right' }]}>
              {currentUser?.tenant?.address || 'Plot No. 45, Industrial Area, Mumbai, Maharashtra'}
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
});
