import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, getUserInfo } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NetInfo from '@react-native-community/netinfo';
import {
  ChevronLeft,
  User,
  Plus,
  Search,
  Check,
  Mail,
  Lock,
  Phone,
  Shield,
  Trash2,
  Pencil,
  LogOut,
  Key,
  Eye,
  EyeOff,
  MoreVertical,
  X,
  Users,
  UserCheck,
  UserX,
  ChevronRight,
} from 'lucide-react-native';

// ============================================================================
// 1. TYPES & DATA CONTRACTS
// ============================================================================

export type RoleType =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'EXECUTIVE'
  | 'GUARD';

export type StatusType = 'ACTIVE' | 'INACTIVE';

export interface CrewMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: RoleType;
  status: StatusType;
  createdAt: string;
}

export type ModalType =
  | 'NONE'
  | 'ACTION_MENU'
  | 'EDIT_DETAILS'
  | 'RESET_PASSWORD'
  | 'REGISTER_ROLE_PICKER'
  | 'EDIT_ROLE_PICKER';

interface RoleConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  desc: string;
  icon: any;
}

// ============================================================================
// 2. CONSTANTS & DESIGN SYSTEM TOKENS
// ============================================================================

const COLORS = {
  primary: '#4F46E5',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  secondary: '#64748B',
  activeGreenBg: '#DCFCE7',
  activeGreenText: '#15803D',
  activeGreenBorder: '#BBF7D0',
  inactiveRedBg: '#FEE2E2',
  inactiveRedText: '#B91C1C',
  inactiveRedBorder: '#FCA5A5',
} as const;

const ROLE_CONFIG: Record<RoleType, RoleConfig> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    bg: '#EEF2FF',
    text: '#4F46E5',
    border: '#C7D2FE',
    desc: 'Full multi-tenant system control',
    icon: Shield,
  },
  TENANT_ADMIN: {
    label: 'Yard Manager (Admin)',
    bg: '#EEF2FF',
    text: '#4F46E5',
    border: '#C7D2FE',
    desc: 'Full yard & crew administration',
    icon: Shield,
  },
  MANAGER: {
    label: 'Yard Manager',
    bg: '#F3E8FF',
    text: '#9333EA',
    border: '#E9D5FF',
    desc: 'Operational & financial oversight',
    icon: Users,
  },
  SUPERVISOR: {
    label: 'Yard Supervisor',
    bg: '#E0F2FE',
    text: '#0284C7',
    border: '#BAE6FD',
    desc: 'Field oversight & guard supervision',
    icon: UserCheck,
  },
  EXECUTIVE: {
    label: 'Yard Executive',
    bg: '#FFEDD5',
    text: '#EA580C',
    border: '#FED7AA',
    desc: 'Gate operations & checkout desk',
    icon: User,
  },
  GUARD: {
    label: 'Yard Guard',
    bg: '#DCFCE7',
    text: '#16A34A',
    border: '#BBF7D0',
    desc: 'Vehicle entry & checklist logging',
    icon: Shield,
  },
};

const ROLES_TO_CREATE = [
  { value: 'GUARD' as const, ...ROLE_CONFIG.GUARD },
  { value: 'EXECUTIVE' as const, ...ROLE_CONFIG.EXECUTIVE },
  { value: 'SUPERVISOR' as const, ...ROLE_CONFIG.SUPERVISOR },
  { value: 'MANAGER' as const, ...ROLE_CONFIG.MANAGER },
] as const;

// ============================================================================
// 3. API SERVICE HELPERS
// ============================================================================

const crewApi = {
  async fetchCrew(): Promise<{ success: boolean; data?: CrewMember[]; message?: string }> {
    return await apiRequest('/api/users');
  },
  async createUser(payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: RoleType;
  }): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    return await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async updateUser(
    id: string,
    payload: { name?: string; email?: string; phone?: string; role?: string; status?: StatusType }
  ): Promise<{ success: boolean; message?: string }> {
    return await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  async resetPassword(
    id: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    return await apiRequest(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
  async forceLogoutUser(id: string): Promise<{ success: boolean; message?: string }> {
    return await apiRequest(`/api/users/${id}/force-logout`, {
      method: 'POST',
    });
  },
};

// Helper for confirmation dialogs
const confirmAction = (
  title: string,
  message: string,
  onConfirm: () => void,
  isDestructive = false
) => {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: title.toUpperCase(),
      style: isDestructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
};

// Extract initials for avatars
const getInitials = (name: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

// ============================================================================
// 4. REUSABLE SUBCOMPONENTS
// ============================================================================

// --- Reusable Bottom Sheet ---
interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const ReusableBottomSheet: React.FC<BottomSheetProps> = React.memo(
  ({ visible, onClose, title, subtitle, children }) => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={onClose}
            accessibilityLabel="Close dialog"
            accessibilityRole="button"
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetDragHandleBar}>
              <View style={styles.sheetDragHandle} />
            </View>

            <View style={styles.sheetHeaderContainer}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sheetTitleText}>{title}</ThemedText>
                {subtitle ? (
                  <ThemedText style={styles.sheetSubtitleText}>{subtitle}</ThemedText>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.sheetCloseBtn}
                activeOpacity={0.7}
                accessibilityLabel="Close modal"
              >
                <X size={18} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetContentBody}>{children}</View>
          </View>
        </View>
      </Modal>
    );
  }
);

// --- Memoized Crew Card ---
interface CrewCardProps {
  member: CrewMember;
  isSelf: boolean;
  onOpenMenu: (member: CrewMember) => void;
}

const CrewCard: React.FC<CrewCardProps> = React.memo(({ member, isSelf, onOpenMenu }) => {
  const isActive = member.status === 'ACTIVE';
  const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.GUARD;
  const initials = useMemo(() => getInitials(member.name), [member.name]);

  return (
    <View style={styles.cardContainer}>
      {/* Left: Avatar & Main Info */}
      <View style={styles.cardLeftCol}>
        <View
          style={[
            styles.avatarCircle,
            isActive ? styles.avatarActiveBg : styles.avatarInactiveBg,
          ]}
        >
          <ThemedText
            style={[
              styles.avatarText,
              isActive ? { color: COLORS.primary } : { color: COLORS.secondary },
            ]}
          >
            {initials}
          </ThemedText>
        </View>

        <View style={styles.cardMetaContainer}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.cardNameText} numberOfLines={1}>
              {member.name}
            </ThemedText>
            {isSelf ? (
              <View style={styles.selfPill}>
                <ThemedText style={styles.selfPillText}>YOU</ThemedText>
              </View>
            ) : null}
          </View>

          {/* Badges Row */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.roleChip,
                { backgroundColor: roleCfg.bg, borderColor: roleCfg.border },
              ]}
            >
              <ThemedText style={[styles.roleChipText, { color: roleCfg.text }]}>
                {roleCfg.label}
              </ThemedText>
            </View>

            <View
              style={[
                styles.statusPill,
                isActive ? styles.statusPillActive : styles.statusPillInactive,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  isActive
                    ? { backgroundColor: COLORS.activeGreenText }
                    : { backgroundColor: COLORS.inactiveRedText },
                ]}
              />
              <ThemedText
                style={[
                  styles.statusPillText,
                  isActive
                    ? { color: COLORS.activeGreenText }
                    : { color: COLORS.inactiveRedText },
                ]}
              >
                {isActive ? 'Active' : 'Suspended'}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Middle: Email & Phone */}
      <View style={styles.cardMiddleCol}>
        <View style={styles.contactRow}>
          <Mail size={12} color={COLORS.secondary} style={{ marginRight: 5 }} />
          <ThemedText style={styles.contactText} numberOfLines={1}>
            {member.email}
          </ThemedText>
        </View>
        {member.phone ? (
          <View style={styles.contactRow}>
            <Phone size={12} color={COLORS.secondary} style={{ marginRight: 5 }} />
            <ThemedText style={styles.contactText} numberOfLines={1}>
              {member.phone}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* Right: Three-dot overflow button */}
      <View style={styles.cardRightCol}>
        <TouchableOpacity
          style={styles.moreMenuBtn}
          onPress={() => onOpenMenu(member)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Actions for ${member.name}`}
          accessibilityRole="button"
        >
          <MoreVertical size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// --- Statistics Cards Row Component ---
interface StatisticsRowProps {
  total: number;
  active: number;
  suspended: number;
}

const StatisticsRow: React.FC<StatisticsRowProps> = React.memo(({ total, active, suspended }) => (
  <View style={styles.statsRow}>
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
        <Users size={16} color={COLORS.primary} />
      </View>
      <View style={styles.statTextWrap}>
        <ThemedText style={styles.statValText}>{total}</ThemedText>
        <ThemedText style={styles.statLabelText}>Total Staff</ThemedText>
      </View>
    </View>

    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: COLORS.activeGreenBg }]}>
        <UserCheck size={16} color={COLORS.activeGreenText} />
      </View>
      <View style={styles.statTextWrap}>
        <ThemedText style={styles.statValText}>{active}</ThemedText>
        <ThemedText style={styles.statLabelText}>Active</ThemedText>
      </View>
    </View>

    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: COLORS.inactiveRedBg }]}>
        <UserX size={16} color={COLORS.inactiveRedText} />
      </View>
      <View style={styles.statTextWrap}>
        <ThemedText style={styles.statValText}>{suspended}</ThemedText>
        <ThemedText style={styles.statLabelText}>Suspended</ThemedText>
      </View>
    </View>
  </View>
));

// --- Enhanced Search Bar Component ---
interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filteredCount: number;
  totalCount: number;
}

const SearchBar: React.FC<SearchBarProps> = React.memo(
  ({ query, onQueryChange, filteredCount, totalCount }) => (
    <View style={styles.searchContainer}>
      <View style={styles.searchWrapper}>
        <Search size={16} color="#94A3B8" style={styles.searchIconLeft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, phone or role..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={onQueryChange}
          autoCorrect={false}
          accessibilityLabel="Search staff members"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => onQueryChange('')}
            style={styles.clearSearchBtn}
            activeOpacity={0.7}
            accessibilityLabel="Clear search"
          >
            <X size={14} color={COLORS.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ThemedText style={styles.searchResultCountText}>
        Showing {filteredCount} of {totalCount} staff members
      </ThemedText>
    </View>
  )
);

// ============================================================================
// 5. MAIN CONTAINER COMPONENT
// ============================================================================

export default function CrewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'LIST' | 'REGISTER'>('LIST');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Roster & Network State
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Single Unified Modal Controller
  const [activeModal, setActiveModal] = useState<ModalType>('NONE');
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'GUARD' as RoleType,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Edit Form Fields State
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'GUARD' as RoleType,
  });
  const [updating, setUpdating] = useState(false);

  // Reset Password State
  const [resetPasswordText, setResetPasswordText] = useState('');
  const [showResetPasswordText, setShowResetPasswordText] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Toast State with Timer Ref Safety
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    AccessibilityInfo.announceForAccessibility(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Listen to network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  // Load Crew Handler
  const loadCrew = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await crewApi.fetchCrew();
      if (res.success && res.data) {
        const sorted = [...res.data].sort((a, b) => {
          if (a.role === 'TENANT_ADMIN') return -1;
          if (b.role === 'TENANT_ADMIN') return 1;
          return a.name.localeCompare(b.name);
        });
        setCrew(sorted);
      }
    } catch (err: any) {
      console.warn('[Crew Roster] Load failed:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const info = await getUserInfo();
      setCurrentUser(info);
      loadCrew();
    };
    init();
  }, [loadCrew]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCrew(true);
  }, [loadCrew]);

  // Modal Control Handlers
  const handleOpenActionMenu = useCallback((member: CrewMember) => {
    setSelectedMember(member);
    setActiveModal('ACTION_MENU');
  }, []);

  const handleOpenEditModal = useCallback((member: CrewMember) => {
    setSelectedMember(member);
    setEditFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
    });
    setActiveModal('EDIT_DETAILS');
  }, []);

  const handleOpenResetModal = useCallback((member: CrewMember) => {
    setSelectedMember(member);
    setResetPasswordText('');
    setActiveModal('RESET_PASSWORD');
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal('NONE');
    setSelectedMember(null);
  }, []);

  // Action: Toggle Active/Suspended Status
  const handleToggleStatus = useCallback(
    (member: CrewMember) => {
      handleCloseModal();
      if (member.id === currentUser?.id) {
        Alert.alert('Restricted Action', 'You cannot suspend your own active account.');
        return;
      }

      const isCurrentlyActive = member.status === 'ACTIVE';
      const actionName = isCurrentlyActive ? 'Suspend' : 'Activate';
      const newStatus: StatusType = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';

      confirmAction(
        `${actionName} Staff Member`,
        `Are you sure you want to ${actionName.toLowerCase()} access for ${member.name}?`,
        async () => {
          try {
            const res = await crewApi.updateUser(member.id, { status: newStatus });
            if (res.success) {
              showToast(`${member.name} has been ${isCurrentlyActive ? 'suspended' : 'activated'}.`);
              loadCrew(true);
            } else {
              Alert.alert('Action Failed', res.message || 'Status toggle failed.');
            }
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Server connection error.');
          }
        },
        isCurrentlyActive
      );
    },
    [currentUser?.id, handleCloseModal, loadCrew, showToast]
  );

  // Action: Force Remote Logout
  const handleForceLogout = useCallback(
    (member: CrewMember) => {
      handleCloseModal();
      if (member.id === currentUser?.id) {
        Alert.alert('Restricted Action', 'You cannot force logout your own active session.');
        return;
      }

      confirmAction(
        `Force Logout ${member.name}?`,
        `This will immediately invalidate active login sessions for ${member.name} across all devices.`,
        async () => {
          try {
            const res = await crewApi.forceLogoutUser(member.id);
            if (res.success) {
              showToast(`${member.name} has been logged out from all devices.`);
              loadCrew(true);
            } else {
              Alert.alert('Failed', res.message || 'Could not force logout user.');
            }
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Server error.');
          }
        },
        true
      );
    },
    [currentUser?.id, handleCloseModal, loadCrew, showToast]
  );

  // Action: Save Edit Details
  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    if (!editFormData.name.trim() || !editFormData.email.trim()) {
      Alert.alert('Validation Error', 'Full Name and Email Address are required.');
      return;
    }

    setUpdating(true);
    try {
      const res = await crewApi.updateUser(selectedMember.id, {
        name: editFormData.name.trim(),
        email: editFormData.email.trim().toLowerCase(),
        phone: editFormData.phone.trim() || undefined,
        role: editFormData.role,
      });

      if (res.success) {
        showToast(`Updated details for ${editFormData.name.trim()}`);
        handleCloseModal();
        loadCrew(true);
      } else {
        Alert.alert('Update Failed', res.message || 'Could not update staff member.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Server error.');
    } finally {
      setUpdating(false);
    }
  };

  // Action: Submit Reset Password
  const handleResetPasswordSubmit = async () => {
    if (!selectedMember) return;
    if (!resetPasswordText.trim() || resetPasswordText.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    setResetting(true);
    try {
      const res = await crewApi.resetPassword(selectedMember.id, resetPasswordText.trim());
      if (res.success) {
        showToast(`Password for ${selectedMember.name} reset successfully!`);
        handleCloseModal();
        setResetPasswordText('');
      } else {
        Alert.alert('Reset Failed', res.message || 'Failed to reset password.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Server error.');
    } finally {
      setResetting(false);
    }
  };

  // Action: Register New Staff
  const handleRegisterSubmit = async () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot register crew members while offline.');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      Alert.alert('Required Fields', 'Please fill in Name, Email, and Password.');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    setRegistering(true);
    try {
      const res = await crewApi.createUser({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        role: formData.role,
      });

      if (res.success) {
        showToast(
          `Registered ${formData.name.trim()} successfully as ${
            ROLE_CONFIG[formData.role]?.label
          }!`
        );
        setFormData({
          name: '',
          email: '',
          phone: '',
          password: '',
          role: 'GUARD',
        });
        await loadCrew(true);
        setActiveTab('LIST');
      } else {
        Alert.alert('Registration Failed', res.message || res.error || 'Failed to create user.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Server connection failed.');
    } finally {
      setRegistering(false);
    }
  };

  // Memoized Filtered Roster Data
  const filteredCrew = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return crew;
    return crew.filter((member) => {
      const nameMatch = member.name.toLowerCase().includes(q);
      const emailMatch = member.email.toLowerCase().includes(q);
      const phoneMatch = member.phone ? member.phone.toLowerCase().includes(q) : false;
      const roleLabel = ROLE_CONFIG[member.role]?.label.toLowerCase() || '';
      const roleMatch = roleLabel.includes(q) || member.role.toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch || roleMatch;
    });
  }, [crew, searchQuery]);

  // Statistics metric calculations
  const statsMetrics = useMemo(() => {
    const total = crew.length;
    const active = crew.filter((c) => c.status === 'ACTIVE').length;
    const suspended = crew.filter((c) => c.status === 'INACTIVE').length;
    return { total, active, suspended };
  }, [crew]);

  const renderCrewItem = useCallback(
    ({ item }: { item: CrewMember }) => (
      <CrewCard
        member={item}
        isSelf={item.id === currentUser?.id}
        onOpenMenu={handleOpenActionMenu}
      />
    ),
    [currentUser?.id, handleOpenActionMenu]
  );

  const keyExtractor = useCallback((item: CrewMember) => item.id, []);

  return (
    <ThemedView style={styles.container}>
      {/* Top Header Bar with Safe Top Inset */}
      <View
        style={[
          styles.headerBar,
          { paddingTop: Math.max(insets.top, 16) + (Platform.OS === 'ios' ? 4 : 8) },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
          activeOpacity={0.7}
          accessibilityLabel="Back to dashboard"
        >
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <ThemedText style={styles.headerTitleText}>Crew Management</ThemedText>
          <ThemedText style={styles.headerSubTitleText}>
            Yard Staff Roster & Access Controls
          </ThemedText>
        </View>

        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => {
            if (isOnline) setActiveTab('REGISTER');
          }}
          disabled={!isOnline}
          activeOpacity={0.7}
          accessibilityLabel="Register new staff member"
        >
          <Plus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Offline Status Warning Banner */}
      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Shield size={14} color="#D97706" style={{ marginRight: 6 }} />
          <ThemedText style={styles.offlineBannerText}>
            Offline Mode: Registration & edits are currently disabled.
          </ThemedText>
        </View>
      ) : null}

      {/* Toast Notification Popup */}
      {toastMessage ? (
        <View
          style={[
            styles.toastContainer,
            { top: Math.max(insets.top, 16) + 54 },
          ]}
        >
          <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </View>
      ) : null}

      {/* Top Statistics KPI Row */}
      <StatisticsRow
        total={statsMetrics.total}
        active={statsMetrics.active}
        suspended={statsMetrics.suspended}
      />

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'LIST' && styles.tabButtonActive]}
          onPress={() => setActiveTab('LIST')}
          activeOpacity={0.7}
        >
          <ThemedText
            style={[styles.tabButtonText, activeTab === 'LIST' && styles.tabButtonTextActive]}
          >
            Staff Roster ({filteredCrew.length})
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'REGISTER' && styles.tabButtonActive,
            !isOnline && styles.tabButtonDisabled,
          ]}
          onPress={() => isOnline && setActiveTab('REGISTER')}
          disabled={!isOnline}
          activeOpacity={0.7}
        >
          <Plus
            size={16}
            color={activeTab === 'REGISTER' ? COLORS.primary : COLORS.secondary}
            style={{ marginRight: 4 }}
          />
          <ThemedText
            style={[
              styles.tabButtonText,
              activeTab === 'REGISTER' && styles.tabButtonTextActive,
            ]}
          >
            Register Staff
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* TAB 1: STAFF ROSTER LIST */}
      {activeTab === 'LIST' ? (
        <View style={{ flex: 1 }}>
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            filteredCount={filteredCrew.length}
            totalCount={crew.length}
          />

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <ThemedText style={styles.loadingText}>Fetching crew details...</ThemedText>
            </View>
          ) : (
            <FlatList
              data={filteredCrew}
              renderItem={renderCrewItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={[
                styles.listContentContainer,
                { paddingBottom: 90 + Math.max(insets.bottom, 16) },
              ]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[COLORS.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <User size={40} color="#94A3B8" style={{ marginBottom: 10 }} />
                  <ThemedText style={styles.emptyTitle}>No Staff Members Found</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    {searchQuery
                      ? 'Try searching with another keyword'
                      : 'Get started by registering a new guard or supervisor.'}
                  </ThemedText>
                </View>
              }
            />
          )}
        </View>
      ) : (
        /* TAB 2: REGISTER NEW STAFF FORM */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.listContentContainer,
              { paddingBottom: 90 + Math.max(insets.bottom, 16) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <ThemedText style={styles.formHeader}>Register Staff Credentials</ThemedText>
              <ThemedText style={styles.formSubHeader}>
                Create login access for yard personnel
              </ThemedText>

              {/* Full Name */}
              <ThemedText style={styles.inputLabel}>Full Name *</ThemedText>
              <View style={styles.inputContainer}>
                <User size={18} color={COLORS.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#94A3B8"
                  value={formData.name}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  autoCorrect={false}
                />
              </View>

              {/* Email Address */}
              <ThemedText style={styles.inputLabel}>Email Address *</ThemedText>
              <View style={styles.inputContainer}>
                <Mail size={18} color={COLORS.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="rahul@yard.com"
                  placeholderTextColor="#94A3B8"
                  value={formData.email}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Phone Number */}
              <ThemedText style={styles.inputLabel}>Phone Number</ThemedText>
              <View style={styles.inputContainer}>
                <Phone size={18} color={COLORS.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor="#94A3B8"
                  value={formData.phone}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>

              {/* Password */}
              <ThemedText style={styles.inputLabel}>Password *</ThemedText>
              <View style={styles.inputContainer}>
                <Lock size={18} color={COLORS.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={formData.password}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, password: val }))}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  style={{ paddingHorizontal: 10 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={COLORS.secondary} />
                  ) : (
                    <Eye size={18} color={COLORS.secondary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Role Select Button */}
              <ThemedText style={styles.inputLabel}>Permission Role Level *</ThemedText>
              <TouchableOpacity
                style={styles.rolePickerSelect}
                onPress={() => setActiveModal('REGISTER_ROLE_PICKER')}
                activeOpacity={0.7}
              >
                <Shield size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.rolePickerValText}>
                    {ROLE_CONFIG[formData.role]?.label}
                  </ThemedText>
                  <ThemedText style={styles.rolePickerDescText}>
                    {ROLE_CONFIG[formData.role]?.desc}
                  </ThemedText>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Submit Registration Button */}
              <TouchableOpacity
                style={[styles.submitBtn, registering && styles.submitBtnDisabled]}
                onPress={handleRegisterSubmit}
                disabled={registering}
                activeOpacity={0.8}
              >
                {registering ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.submitBtnText}>Register Account</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ==================================================================== */}
      {/* UNIFIED MODAL LAYOUTS */}
      {/* ==================================================================== */}

      {/* MODAL 1: OVERFLOW ACTION SHEET */}
      <ReusableBottomSheet
        visible={activeModal === 'ACTION_MENU'}
        onClose={handleCloseModal}
        title={selectedMember?.name || 'Staff Actions'}
        subtitle={
          selectedMember
            ? `${ROLE_CONFIG[selectedMember.role]?.label || selectedMember.role} • ${
                selectedMember.email
              }`
            : undefined
        }
      >
        {selectedMember ? (
          <View style={styles.actionMenuContainer}>
            {/* Edit Details */}
            <TouchableOpacity
              style={styles.actionMenuRow}
              onPress={() => handleOpenEditModal(selectedMember)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionMenuIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Pencil size={18} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.actionMenuLabelText}>Edit Details</ThemedText>
                <ThemedText style={styles.actionMenuSubText}>
                  Update name, email, phone & role
                </ThemedText>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Reset Password */}
            <TouchableOpacity
              style={styles.actionMenuRow}
              onPress={() => handleOpenResetModal(selectedMember)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionMenuIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Key size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.actionMenuLabelText}>Reset Password</ThemedText>
                <ThemedText style={styles.actionMenuSubText}>
                  Assign new login password
                </ThemedText>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Force Logout (Destructive) */}
            {selectedMember.id !== currentUser?.id ? (
              <TouchableOpacity
                style={styles.actionMenuRow}
                onPress={() => handleForceLogout(selectedMember)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionMenuIconBox, { backgroundColor: COLORS.inactiveRedBg }]}>
                  <LogOut size={18} color={COLORS.inactiveRedText} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.actionMenuLabelText, { color: COLORS.inactiveRedText }]}
                  >
                    Force Logout
                  </ThemedText>
                  <ThemedText style={styles.actionMenuSubText}>
                    Revoke active sessions across all devices
                  </ThemedText>
                </View>
                <ChevronRight size={16} color="#FCA5A5" />
              </TouchableOpacity>
            ) : null}

            {/* Suspend / Activate Account */}
            {selectedMember.id !== currentUser?.id ? (
              <TouchableOpacity
                style={styles.actionMenuRow}
                onPress={() => handleToggleStatus(selectedMember)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionMenuIconBox,
                    selectedMember.status === 'ACTIVE'
                      ? { backgroundColor: COLORS.inactiveRedBg }
                      : { backgroundColor: COLORS.activeGreenBg },
                  ]}
                >
                  {selectedMember.status === 'ACTIVE' ? (
                    <Trash2 size={18} color={COLORS.inactiveRedText} />
                  ) : (
                    <Check size={18} color={COLORS.activeGreenText} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[
                      styles.actionMenuLabelText,
                      selectedMember.status === 'ACTIVE'
                        ? { color: COLORS.inactiveRedText }
                        : { color: COLORS.activeGreenText },
                    ]}
                  >
                    {selectedMember.status === 'ACTIVE'
                      ? 'Suspend Account'
                      : 'Activate Account'}
                  </ThemedText>
                  <ThemedText style={styles.actionMenuSubText}>
                    {selectedMember.status === 'ACTIVE'
                      ? 'Disable login access for this user'
                      : 'Restore login access for this user'}
                  </ThemedText>
                </View>
                <ChevronRight size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ReusableBottomSheet>

      {/* MODAL 2: EDIT STAFF DETAILS */}
      <ReusableBottomSheet
        visible={activeModal === 'EDIT_DETAILS'}
        onClose={handleCloseModal}
        title="Edit Staff Member"
        subtitle={
          selectedMember ? `Updating profile for ${selectedMember.name}` : undefined
        }
      >
        <ScrollView contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
          <View>
            <ThemedText style={styles.inputLabel}>Full Name *</ThemedText>
            <View style={styles.inputContainer}>
              <User size={18} color={COLORS.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={editFormData.name}
                onChangeText={(val) => setEditFormData((prev) => ({ ...prev, name: val }))}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <ThemedText style={styles.inputLabel}>Email Address *</ThemedText>
            <View style={styles.inputContainer}>
              <Mail size={18} color={COLORS.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={editFormData.email}
                onChangeText={(val) => setEditFormData((prev) => ({ ...prev, email: val }))}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Email Address"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <ThemedText style={styles.inputLabel}>Phone Number</ThemedText>
            <View style={styles.inputContainer}>
              <Phone size={18} color={COLORS.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={editFormData.phone}
                onChangeText={(val) => setEditFormData((prev) => ({ ...prev, phone: val }))}
                keyboardType="phone-pad"
                placeholder="Phone Number"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <ThemedText style={styles.inputLabel}>Permission Role Level</ThemedText>
            <TouchableOpacity
              style={styles.rolePickerSelect}
              onPress={() => setActiveModal('EDIT_ROLE_PICKER')}
              activeOpacity={0.7}
            >
              <Shield size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.rolePickerValText}>
                  {ROLE_CONFIG[editFormData.role]?.label || editFormData.role}
                </ThemedText>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalActionButtonsRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { flex: 1 }]}
              onPress={handleCloseModal}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { flex: 1, marginTop: 0 },
                updating && styles.submitBtnDisabled,
              ]}
              onPress={handleSaveEdit}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ReusableBottomSheet>

      {/* MODAL 3: EDIT ROLE SELECTOR */}
      <ReusableBottomSheet
        visible={activeModal === 'EDIT_ROLE_PICKER'}
        onClose={() => setActiveModal('EDIT_DETAILS')}
        title="Select Staff Role"
        subtitle="Choose permission tier for editing staff member"
      >
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {ROLES_TO_CREATE.map((role) => {
            const isSelected = editFormData.role === role.value;
            const IconComponent = role.icon;
            return (
              <TouchableOpacity
                key={role.value}
                style={[styles.roleOptionCard, isSelected && styles.roleOptionCardActive]}
                onPress={() => {
                  setEditFormData((prev) => ({ ...prev, role: role.value }));
                  setActiveModal('EDIT_DETAILS');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.roleOptionIconBox,
                    { backgroundColor: role.bg, borderColor: role.border },
                  ]}
                >
                  <IconComponent size={20} color={role.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.roleOptionTitle, isSelected && { color: COLORS.primary }]}
                  >
                    {role.label}
                  </ThemedText>
                  <ThemedText style={styles.roleOptionDesc}>{role.desc}</ThemedText>
                </View>
                {isSelected ? <Check size={18} color={COLORS.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ReusableBottomSheet>

      {/* MODAL 4: REGISTER ROLE SELECTOR */}
      <ReusableBottomSheet
        visible={activeModal === 'REGISTER_ROLE_PICKER'}
        onClose={handleCloseModal}
        title="Select System Role"
        subtitle="Configure system privilege access level for new staff:"
      >
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {ROLES_TO_CREATE.map((role) => {
            const isSelected = formData.role === role.value;
            const IconComponent = role.icon;
            return (
              <TouchableOpacity
                key={role.value}
                style={[styles.roleOptionCard, isSelected && styles.roleOptionCardActive]}
                onPress={() => {
                  setFormData((prev) => ({ ...prev, role: role.value }));
                  handleCloseModal();
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.roleOptionIconBox,
                    { backgroundColor: role.bg, borderColor: role.border },
                  ]}
                >
                  <IconComponent size={20} color={role.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.roleOptionTitle, isSelected && { color: COLORS.primary }]}
                  >
                    {role.label}
                  </ThemedText>
                  <ThemedText style={styles.roleOptionDesc}>{role.desc}</ThemedText>
                </View>
                {isSelected ? <Check size={18} color={COLORS.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ReusableBottomSheet>

      {/* MODAL 5: RESET PASSWORD */}
      <ReusableBottomSheet
        visible={activeModal === 'RESET_PASSWORD'}
        onClose={handleCloseModal}
        title="Reset Password"
        subtitle={
          selectedMember
            ? `Set new credentials for ${selectedMember.name} (${selectedMember.email})`
            : undefined
        }
      >
        <View style={{ gap: 14 }}>
          <View>
            <ThemedText style={styles.inputLabel}>New Password *</ThemedText>
            <View style={styles.inputContainer}>
              <Lock size={18} color={COLORS.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter at least 6 characters"
                placeholderTextColor="#94A3B8"
                value={resetPasswordText}
                onChangeText={setResetPasswordText}
                secureTextEntry={!showResetPasswordText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowResetPasswordText((p) => !p)}
                style={{ paddingHorizontal: 10 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showResetPasswordText ? (
                  <EyeOff size={18} color={COLORS.secondary} />
                ) : (
                  <Eye size={18} color={COLORS.secondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActionButtonsRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { flex: 1 }]}
              onPress={handleCloseModal}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { flex: 1, marginTop: 0, backgroundColor: '#D97706' },
                resetting && styles.submitBtnDisabled,
              ]}
              onPress={handleResetPasswordSubmit}
              disabled={resetting}
            >
              {resetting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Reset Password</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ReusableBottomSheet>
    </ThemedView>
  );
}

// ============================================================================
// 6. STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubTitleText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 1,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  offlineBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 66,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  /* Statistics Cards */
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statTextWrap: {
    flex: 1,
  },
  statValText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 18,
  },
  statLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 1,
  },

  /* Tab Bar */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: COLORS.border,
    borderRadius: 14,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonDisabled: {
    opacity: 0.5,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },

  /* Search Section */
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIconLeft: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  clearSearchBtn: {
    padding: 4,
  },
  searchResultCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 6,
    marginLeft: 4,
  },

  /* List & Card Item Styles */
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarActiveBg: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarInactiveBg: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardMetaContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  selfPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  selfPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  roleChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: COLORS.activeGreenBg,
    borderColor: COLORS.activeGreenBorder,
  },
  statusPillInactive: {
    backgroundColor: COLORS.inactiveRedBg,
    borderColor: COLORS.inactiveRedBorder,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardMiddleCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  cardRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  moreMenuBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty & Loading States */
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: 4,
  },

  /* Register Form Styles */
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  formHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  formSubHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: -6,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  rolePickerSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rolePickerValText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  rolePickerDescText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Reusable Bottom Sheet */
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheetContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetDragHandleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  sheetHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  sheetTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  sheetSubtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContentBody: {
    paddingVertical: 4,
  },

  /* Action Menu Options */
  actionMenuContainer: {
    gap: 8,
  },
  actionMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionMenuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionMenuLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  actionMenuSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 1,
  },

  /* Role Selection Cards */
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleOptionCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  roleOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  roleOptionDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 2,
  },

  /* Modal Actions Helpers */
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
});
