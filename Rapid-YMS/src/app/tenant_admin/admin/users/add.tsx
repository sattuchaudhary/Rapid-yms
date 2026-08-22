import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  PhoneCall,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Calendar,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  UserPlus,
  FileText,
  CreditCard,
  X,
  UploadCloud,
  Sparkles,
  Save,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { apiRequest } from '@/services/api';
import { UserRole, ROLE_META } from './types';
import UploadPickerModal from './components/UploadPickerModal';

// Role Dropdown Options
interface RoleOption {
  role: UserRole;
  title: string;
  desc: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { role: 'TENANT_ADMIN', title: 'Sub Admin', desc: 'Full administrative access' },
  { role: 'MANAGER', title: 'Manager', desc: 'Yard operations & inventory' },
  { role: 'SUPERVISOR', title: 'Supervisor', desc: 'Inspection & bay allocation' },
  { role: 'EXECUTIVE', title: 'Executive', desc: 'Billing & paperwork' },
  { role: 'GUARD', title: 'Guard', desc: 'Gate inward/outward barrier' },
];

// Indian ID Document Types
type IdDocType = 'AADHAAR' | 'PAN' | 'DRIVING_LICENSE' | 'VOTER_ID' | 'PASSPORT';

interface IdDocOption {
  key: IdDocType;
  label: string;
  requiresBack: boolean;
}

const ID_DOC_OPTIONS: IdDocOption[] = [
  { key: 'AADHAAR', label: 'Aadhaar Card', requiresBack: true },
  { key: 'PAN', label: 'PAN Card', requiresBack: false },
  { key: 'DRIVING_LICENSE', label: 'Driving License', requiresBack: true },
  { key: 'VOTER_ID', label: 'Voter ID Card', requiresBack: true },
  { key: 'PASSPORT', label: 'Passport', requiresBack: true },
];

// Permission Level Types
type PermissionLevel = 'FULL_ACCESS' | 'OPERATIONAL' | 'VIEW_ONLY';

interface PermissionOption {
  key: PermissionLevel;
  label: string;
  desc: string;
}

const PERMISSION_OPTIONS: PermissionOption[] = [
  { key: 'FULL_ACCESS', label: 'Full Access', desc: 'Create, Edit, Approvals & Deletion' },
  { key: 'OPERATIONAL', label: 'Operational', desc: 'Standard inward, outward & condition logging' },
  { key: 'VIEW_ONLY', label: 'View Only', desc: 'Read-only access to records & reports' },
];

export default function AddUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

  // 1. Role & Permission State
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('OPERATIONAL');

  // 2. Contact & Personal Details State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // 3. Security State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 4. Joining Date State
  const [joiningDate, setJoiningDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 5. Documentation & KYC State
  const [userPhotoUri, setUserPhotoUri] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<IdDocType>('AADHAAR');
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);
  const [docFrontUri, setDocFrontUri] = useState<string | null>(null);
  const [docBackUri, setDocBackUri] = useState<string | null>(null);

  // Attractive Upload Picker Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'PHOTO' | 'DOC_FRONT' | 'DOC_BACK' | null>(null);
  const [pickerTitle, setPickerTitle] = useState('Upload File');
  const [pickerSubtitle, setPickerSubtitle] = useState('Choose where you want to upload from');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(false);

  // Prefill details in Edit Mode
  useEffect(() => {
    if (id) {
      (async () => {
        try {
          setFetchingUser(true);
          const res = await apiRequest(`/api/users/${id}`);
          const u = res?.data || res;
          if (u && u.id) {
            setName(u.name || '');
            setEmail(u.email || '');
            setPhone(u.phone || '');
            setAddress(u.address || '');
            setEmergencyContact(u.emergencyContact || '');
            if (u.dob) setDob(new Date(u.dob));
            if (u.permissionLevel) setPermissionLevel(u.permissionLevel as PermissionLevel);
            if (u.role) setSelectedRole(u.role);
            if (u.joiningDate) setJoiningDate(new Date(u.joiningDate));
            if (u.photoUri) setUserPhotoUri(u.photoUri);
            if (u.docType) setSelectedDocType(u.docType as IdDocType);
            if (u.docFrontUri) setDocFrontUri(u.docFrontUri);
            if (u.docBackUri) setDocBackUri(u.docBackUri);
          }
        } catch (err) {
          console.warn('[Fetch User for Edit Error]', err);
        } finally {
          setFetchingUser(false);
        }
      })();
    }
  }, [id]);

  const handleBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.back();
  };

  const currentDocMeta = ID_DOC_OPTIONS.find((d) => d.key === selectedDocType) || ID_DOC_OPTIONS[0];

  // Open Attractive Upload Picker Modal
  const handleOpenPicker = (target: 'PHOTO' | 'DOC_FRONT' | 'DOC_BACK') => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPickerTarget(target);
    if (target === 'PHOTO') {
      setPickerTitle('Upload Staff Profile Photo');
      setPickerSubtitle('Take a live portrait with camera or select from album');
    } else if (target === 'DOC_FRONT') {
      setPickerTitle(`Upload ${currentDocMeta.label} (Front)`);
      setPickerSubtitle('Capture clear front side of government document');
    } else {
      setPickerTitle(`Upload ${currentDocMeta.label} (Back)`);
      setPickerSubtitle('Capture clear back side of government document');
    }
    setPickerModalVisible(true);
  };

  const applyImageUri = (uri: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (pickerTarget === 'PHOTO') setUserPhotoUri(uri);
    if (pickerTarget === 'DOC_FRONT') setDocFrontUri(uri);
    if (pickerTarget === 'DOC_BACK') setDocBackUri(uri);
  };

  // 1. Launch Camera
  const handleSelectCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        applyImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera.');
    }
  };

  // 2. Launch Photo Gallery
  const handleSelectGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        applyImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to access photo album.');
    }
  };

  // 3. Launch Document File Picker
  const handleSelectDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        applyImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Document Error', err.message || 'Unable to select file.');
    }
  };

  // Form Submit Handler (Create or Update)
  const handleRegister = async () => {
    // Validation
    if (!selectedRole) {
      Alert.alert('Validation Error', 'Please select a role for the user.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter staff full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Validation Error', 'Please enter mobile number.');
      return;
    }
    if (!isEditMode && password.trim() && password.trim().length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (isEditMode) {
        await apiRequest(`/api/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address.trim() || undefined,
            emergencyContact: emergencyContact.trim() || undefined,
            dob: dob ? dob.toISOString() : undefined,
            permissionLevel,
            joiningDate: joiningDate.toISOString(),
            role: selectedRole,
            photoUri: userPhotoUri || undefined,
            docType: selectedDocType,
            docFrontUri: docFrontUri || undefined,
            docBackUri: docBackUri || undefined,
            ...(password.trim() ? { password: password.trim() } : {}),
          }),
        });

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        Alert.alert(
          'Staff Updated',
          `Account for "${name.trim()}" updated successfully!`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address.trim() || undefined,
            emergencyContact: emergencyContact.trim() || undefined,
            dob: dob ? dob.toISOString() : undefined,
            permissionLevel,
            joiningDate: joiningDate.toISOString(),
            password: password.trim() || 'password123',
            role: selectedRole,
            photoUri: userPhotoUri || undefined,
            docType: selectedDocType,
            docFrontUri: docFrontUri || undefined,
            docBackUri: docBackUri || undefined,
          }),
        });

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        Alert.alert(
          'User Registered',
          `Account for "${name.trim()}" created successfully!`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert(isEditMode ? 'Update Failed' : 'Registration Failed', err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Clean Header */}
      <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color="#0F172A" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Staff User' : 'Register User'}</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={[styles.formContent, { paddingBottom: bottomPadding + 90 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============================================================ */}
          {/* 1. COMPACT ROLE SELECTION DROPDOWN (TOP)                     */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>STAFF ROLE</Text>

            <TouchableOpacity
              style={[
                styles.compactDropdownTrigger,
                isRoleDropdownOpen && styles.dropdownTriggerOpen,
              ]}
              onPress={() => {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                  Haptics.selectionAsync().catch(() => {});
                }
                setIsRoleDropdownOpen((prev) => !prev);
              }}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.roleIconMini,
                  {
                    backgroundColor: selectedRole
                      ? ROLE_META[selectedRole].avatarBg
                      : '#F1F5F9',
                  },
                ]}
              >
                <Shield
                  size={15}
                  color={selectedRole ? ROLE_META[selectedRole].badgeTextColor : '#64748B'}
                  strokeWidth={2.4}
                />
              </View>

              <Text
                style={[
                  styles.compactDropdownText,
                  !selectedRole && styles.placeholderText,
                ]}
              >
                {selectedRole
                  ? ROLE_OPTIONS.find((r) => r.role === selectedRole)?.title
                  : 'Select Staff Role *'}
              </Text>

              {isRoleDropdownOpen ? (
                <ChevronUp size={18} color="#64748B" strokeWidth={2.2} />
              ) : (
                <ChevronDown size={18} color="#64748B" strokeWidth={2.2} />
              )}
            </TouchableOpacity>

            {/* Dropdown Options */}
            {isRoleDropdownOpen && (
              <View style={styles.dropdownMenuBox}>
                {ROLE_OPTIONS.map((item, idx) => {
                  const isSelected = selectedRole === item.role;
                  const meta = ROLE_META[item.role];
                  const isLast = idx === ROLE_OPTIONS.length - 1;

                  return (
                    <TouchableOpacity
                      key={item.role}
                      style={[
                        styles.dropdownItemRow,
                        isSelected && styles.dropdownItemSelected,
                        !isLast && styles.dropdownItemDivider,
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'ios' || Platform.OS === 'android') {
                          Haptics.selectionAsync().catch(() => {});
                        }
                        setSelectedRole(item.role);
                        setIsRoleDropdownOpen(false);
                      }}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.roleIconMini,
                          { backgroundColor: isSelected ? meta.avatarBg : '#F1F5F9' },
                        ]}
                      >
                        <Shield
                          size={14}
                          color={isSelected ? meta.badgeTextColor : '#64748B'}
                          strokeWidth={2.4}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownItemTitleText,
                            isSelected && { color: meta.badgeTextColor, fontWeight: '800' },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.dropdownItemDescText}>{item.desc}</Text>
                      </View>

                      {isSelected ? (
                        <CheckCircle2 size={18} color={meta.badgeTextColor} strokeWidth={2.4} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Permission Level Selector */}
            <View style={styles.cardDivider} />
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Permission & Access Level</Text>
              <View style={styles.permissionLevelRow}>
                {PERMISSION_OPTIONS.map((opt) => {
                  const isSelected = permissionLevel === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.permissionOptionChip,
                        isSelected && styles.permissionOptionChipSelected,
                      ]}
                      onPress={() => {
                        if (Platform.OS === 'ios' || Platform.OS === 'android') {
                          Haptics.selectionAsync().catch(() => {});
                        }
                        setPermissionLevel(opt.key);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.permissionOptionChipText,
                          isSelected && styles.permissionOptionChipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* 2. CONTACT & PERSONAL DETAILS                                */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>CONTACT & PERSONAL DETAILS</Text>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.fieldInputBox}>
                <User size={16} color="#64748B" strokeWidth={2} />
                <TextInput
                  style={styles.fieldTextInput}
                  placeholder="Enter staff full name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Email Address <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.fieldInputBox}>
                <Mail size={16} color="#64748B" strokeWidth={2} />
                <TextInput
                  style={styles.fieldTextInput}
                  placeholder="e.g. staff@yard.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mobile Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.fieldInputBox}>
                <Phone size={16} color="#64748B" strokeWidth={2} />
                <TextInput
                  style={styles.fieldTextInput}
                  placeholder="e.g. +91 9876543210"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Date of Birth (DOB) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth (DOB)</Text>
              <TouchableOpacity
                style={styles.fieldInputBox}
                onPress={() => setShowDobPicker(true)}
                activeOpacity={0.75}
              >
                <Calendar size={16} color="#7C3AED" strokeWidth={2} />
                <Text
                  style={[
                    styles.datePickerText,
                    !dob && styles.placeholderText,
                  ]}
                >
                  {dob
                    ? dob.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Select Date of Birth'}
                </Text>
                <Text style={styles.changeDateLabel}>{dob ? 'Change' : 'Select'}</Text>
              </TouchableOpacity>

              {showDobPicker && (
                <DateTimePicker
                  value={dob || new Date(1995, 0, 1)}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowDobPicker(false);
                    if (date) setDob(date);
                  }}
                />
              )}
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Resident Address</Text>
              <View style={[styles.fieldInputBox, styles.addressInputBox]}>
                <MapPin size={16} color="#64748B" strokeWidth={2} style={{ marginTop: 2 }} />
                <TextInput
                  style={[styles.fieldTextInput, styles.addressTextInput]}
                  placeholder="Enter residential address"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            {/* Emergency Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Emergency Contact Number</Text>
              <View style={styles.fieldInputBox}>
                <PhoneCall size={16} color="#EA580C" strokeWidth={2} />
                <TextInput
                  style={styles.fieldTextInput}
                  placeholder="e.g. +91 9811122233 (Family / Relative)"
                  placeholderTextColor="#94A3B8"
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* 3. PASSWORD & SECURITY                                       */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>ACCOUNT SECURITY</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {isEditMode ? 'New Password' : 'Password'}{' '}
                <Text style={styles.optionalNote}>
                  {isEditMode ? '(Leave blank to keep existing)' : '(Default: password123)'}
                </Text>
              </Text>
              <View style={styles.fieldInputBox}>
                <Lock size={16} color="#64748B" strokeWidth={2} />
                <TextInput
                  style={styles.fieldTextInput}
                  placeholder={isEditMode ? 'Enter new password to change' : 'Leave empty for password123'}
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={17} color="#64748B" strokeWidth={2} />
                  ) : (
                    <Eye size={17} color="#64748B" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* 4. JOINING DATE                                              */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>EMPLOYMENT TIMELINE</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Joining Date</Text>
              <TouchableOpacity
                style={styles.fieldInputBox}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.75}
              >
                <Calendar size={16} color="#0062FF" strokeWidth={2} />
                <Text style={styles.datePickerText}>
                  {joiningDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.changeDateLabel}>Change</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={joiningDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setJoiningDate(date);
                  }}
                />
              )}
            </View>
          </View>

          {/* ============================================================ */}
          {/* 5. DOCUMENTATION & KYC PART                                  */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>DOCUMENTATION & KYC</Text>

            {/* 5A. User Profile Photo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>User Profile Photo</Text>

              {userPhotoUri ? (
                <View style={styles.photoPreviewCard}>
                  <Image source={{ uri: userPhotoUri }} style={styles.profileThumbnail} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadedSuccessText}>Profile Photo Uploaded</Text>
                    <TouchableOpacity
                      onPress={() => handleOpenPicker('PHOTO')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changePhotoText}>Retake / Replace Photo</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setUserPhotoUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color="#E11D48" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadDottedBox}
                  onPress={() => handleOpenPicker('PHOTO')}
                  activeOpacity={0.75}
                >
                  <View style={styles.uploadIconCircle}>
                    <Camera size={20} color="#7C3AED" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.uploadMainText}>Upload Staff Photo</Text>
                  <Text style={styles.uploadSubText}>Take photo with camera or choose from gallery</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.cardDivider} />

            {/* 5B. ID Proof Type Dropdown */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Government ID Proof</Text>

              <TouchableOpacity
                style={[
                  styles.compactDropdownTrigger,
                  isDocDropdownOpen && styles.dropdownTriggerOpen,
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setIsDocDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.75}
              >
                <CreditCard size={16} color="#0062FF" strokeWidth={2.2} />
                <Text style={styles.compactDropdownText}>{currentDocMeta.label}</Text>
                {isDocDropdownOpen ? (
                  <ChevronUp size={18} color="#64748B" strokeWidth={2.2} />
                ) : (
                  <ChevronDown size={18} color="#64748B" strokeWidth={2.2} />
                )}
              </TouchableOpacity>

              {/* ID Proof Dropdown Menu */}
              {isDocDropdownOpen && (
                <View style={styles.dropdownMenuBox}>
                  {ID_DOC_OPTIONS.map((doc, idx) => {
                    const isSelected = selectedDocType === doc.key;
                    const isLast = idx === ID_DOC_OPTIONS.length - 1;

                    return (
                      <TouchableOpacity
                        key={doc.key}
                        style={[
                          styles.dropdownItemRow,
                          isSelected && styles.dropdownItemSelected,
                          !isLast && styles.dropdownItemDivider,
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'ios' || Platform.OS === 'android') {
                            Haptics.selectionAsync().catch(() => {});
                          }
                          setSelectedDocType(doc.key);
                          setIsDocDropdownOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.dropdownItemTitleText,
                            isSelected && { color: '#0062FF', fontWeight: '800' },
                          ]}
                        >
                          {doc.label}
                        </Text>
                        {isSelected ? (
                          <CheckCircle2 size={18} color="#0062FF" strokeWidth={2.4} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 5C. ID Proof Image Upload Slots (Front & Back) */}
            <View style={styles.docUploadGrid}>
              {/* Front Side */}
              <View style={{ flex: 1 }}>
                <Text style={styles.docSideLabel}>
                  {currentDocMeta.requiresBack ? 'Front Side' : 'Document Image'}
                </Text>
                {docFrontUri ? (
                  <View style={styles.docThumbnailCard}>
                    <Image source={{ uri: docFrontUri }} style={styles.docThumbnail} />
                    <TouchableOpacity
                      style={styles.docRemoveBadge}
                      onPress={() => setDocFrontUri(null)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <X size={12} color="#FFFFFF" strokeWidth={2.6} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.docUploadSlot}
                    onPress={() => handleOpenPicker('DOC_FRONT')}
                    activeOpacity={0.75}
                  >
                    <UploadCloud size={20} color="#0062FF" strokeWidth={2} />
                    <Text style={styles.docUploadSlotText}>Upload Front</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Back Side (If applicable) */}
              {currentDocMeta.requiresBack && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.docSideLabel}>Back Side</Text>
                  {docBackUri ? (
                    <View style={styles.docThumbnailCard}>
                      <Image source={{ uri: docBackUri }} style={styles.docThumbnail} />
                      <TouchableOpacity
                        style={styles.docRemoveBadge}
                        onPress={() => setDocBackUri(null)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={12} color="#FFFFFF" strokeWidth={2.6} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.docUploadSlot}
                      onPress={() => handleOpenPicker('DOC_BACK')}
                      activeOpacity={0.75}
                    >
                      <UploadCloud size={20} color="#0062FF" strokeWidth={2} />
                      <Text style={styles.docUploadSlotText}>Upload Back</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Sticky Submit Button */}
        <View style={[styles.bottomBarWrapper, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={submitting}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Register User"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                {isEditMode ? (
                  <Save size={19} color="#FFFFFF" strokeWidth={2.4} />
                ) : (
                  <UserPlus size={19} color="#FFFFFF" strokeWidth={2.4} />
                )}
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Save Changes' : 'Register User'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attractive Upload Bottom Sheet Modal */}
      <UploadPickerModal
        visible={pickerModalVisible}
        title={pickerTitle}
        subtitle={pickerSubtitle}
        onClose={() => setPickerModalVisible(false)}
        onSelectCamera={handleSelectCamera}
        onSelectGallery={handleSelectGallery}
        onSelectDocument={handleSelectDocument}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerPlaceholder: {
    width: 40,
  },
  keyboardContainer: {
    flex: 1,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
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
  compactDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    gap: 10,
  },
  dropdownTriggerOpen: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  roleIconMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  dropdownMenuBox: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#FAF5FF',
  },
  dropdownItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownItemDescText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  permissionLevelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  permissionOptionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionOptionChipSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  permissionOptionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  permissionOptionChipTextSelected: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  requiredStar: {
    color: '#E11D48',
    fontWeight: '800',
  },
  optionalNote: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  fieldInputBox: {
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
  addressInputBox: {
    height: 70,
    alignItems: 'flex-start',
    paddingTop: 10,
  },
  fieldTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  addressTextInput: {
    height: 52,
    textAlignVertical: 'top',
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeDateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0062FF',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },

  // Photo & KYC styles
  uploadDottedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadMainText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  uploadSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  profileThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  uploadedSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  changePhotoText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0062FF',
    marginTop: 2,
  },
  removePhotoBtn: {
    padding: 6,
  },
  docUploadGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  docSideLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  docUploadSlot: {
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  docUploadSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  docThumbnailCard: {
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  docThumbnail: {
    width: '100%',
    height: '100%',
  },
  docRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(225, 29, 72, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#A78BFA',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
