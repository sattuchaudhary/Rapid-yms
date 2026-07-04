import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  Building,
  Mail,
  Lock,
  Phone,
  Shield,
  Trash2,
} from 'lucide-react-native';

interface CrewMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EXECUTIVE' | 'GUARD';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Yard Manager (Admin)',
  MANAGER: 'Yard Supervisor',
  SUPERVISOR: 'Yard Supervisor',
  EXECUTIVE: 'Yard Executive',
  GUARD: 'Yard Guard',
};

const ROLES_TO_CREATE = [
  { value: 'GUARD', label: 'Yard Guard' },
  { value: 'SUPERVISOR', label: 'Yard Supervisor' },
  { value: 'EXECUTIVE', label: 'Yard Executive' },
  { value: 'MANAGER', label: 'Yard Manager' },
] as const;

export default function CrewScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'LIST' | 'REGISTER'>('LIST');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Roster States
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Register Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'GUARD' | 'SUPERVISOR' | 'EXECUTIVE' | 'MANAGER'>('GUARD');
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  const loadCrew = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiRequest('/api/users');
      if (res.success && res.data) {
        // Sort: Admins first, then Supervisors, then active guards
        const sorted = (res.data as CrewMember[]).sort((a, b) => {
          if (a.role === 'TENANT_ADMIN') return -1;
          if (b.role === 'TENANT_ADMIN') return 1;
          return a.name.localeCompare(b.name);
        });
        setCrew(sorted);
      }
    } catch (err: any) {
      console.warn('[Crew Roster] Failed to load staff:', err.message);
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

  const handleToggleStatus = async (member: CrewMember) => {
    if (member.id === currentUser?.id) {
      Alert.alert('Action Restricted', 'You cannot deactivate your own account.');
      return;
    }

    const action = member.status === 'ACTIVE' ? 'deactivate' : 'activate';
    const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    Alert.alert(
      `${member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Crew Member`,
      `Are you sure you want to ${action} ${member.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.toUpperCase(),
          style: member.status === 'ACTIVE' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await apiRequest(`/api/users/${member.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
              });

              if (res.success) {
                Alert.alert('Success', `${member.name} has been ${member.status === 'ACTIVE' ? 'deactivated' : 'activated'}.`);
                loadCrew(true);
              } else {
                Alert.alert('Failed', res.message || 'Status toggle failed.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Server error.');
            }
          },
        },
      ]
    );
  };

  const handleRegister = async () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot register crew members while offline.');
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please fill in Name, Email, and Password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setRegistering(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password: password,
        role: selectedRole,
      };

      const res = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        Alert.alert('Success', `Registered ${name} successfully as ${ROLE_LABELS[selectedRole]}!`);
        // Reset form
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setSelectedRole('GUARD');
        
        // Reload list and switch tab
        await loadCrew(true);
        setActiveTab('LIST');
      } else {
        Alert.alert('Registration Failed', res.message || res.error || 'Failed to create user');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Server connection failed.');
    } finally {
      setRegistering(false);
    }
  };

  const filteredCrew = crew.filter((member) => {
    const q = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q) ||
      (member.phone && member.phone.includes(q))
    );
  });

  return (
    <ThemedView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Crew Management</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Connection warning banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Shield size={14} color="#D97706" style={{ marginRight: 6 }} />
          <ThemedText style={styles.offlineBannerText}>
            Offline Mode: Register tab is disabled.
          </ThemedText>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'LIST' && styles.tabButtonActive]}
          onPress={() => setActiveTab('LIST')}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.tabButtonText, activeTab === 'LIST' && styles.tabButtonTextActive]}>
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
          <Plus size={16} color={activeTab === 'REGISTER' ? '#4F46E5' : '#64748B'} style={{ marginRight: 4 }} />
          <ThemedText style={[styles.tabButtonText, activeTab === 'REGISTER' && styles.tabButtonTextActive]}>
            Register Staff
          </ThemedText>
        </TouchableOpacity>
      </View>

      {activeTab === 'LIST' ? (
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchWrapper}>
              <Search size={16} color="#94A3B8" style={styles.searchIconLeft} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search staff by name or email"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <ThemedText style={styles.loadingText}>Fetching staff details...</ThemedText>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
              }
            >
              {filteredCrew.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <User size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
                  <ThemedText style={styles.emptyTitle}>No Staff Members</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>
                    {searchQuery ? 'Try searching another name' : 'Get started by registering a new guard/manager.'}
                  </ThemedText>
                </View>
              ) : (
                filteredCrew.map((member) => {
                  const isSelf = member.id === currentUser?.id;
                  const isActive = member.status === 'ACTIVE';
                  
                  return (
                    <View key={member.id} style={[styles.staffCard, !isActive && styles.staffCardInactive]}>
                      {/* Avatar Circle */}
                      <View style={[styles.avatarCircle, isActive ? styles.avatarActive : styles.avatarInactive]}>
                        <User size={20} color={isActive ? '#4F46E5' : '#64748B'} />
                      </View>

                      {/* Info Block */}
                      <View style={styles.staffMeta}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <ThemedText style={[styles.staffName, !isActive && styles.staffTextInactive]}>
                            {member.name}
                          </ThemedText>
                          {isSelf && (
                            <View style={styles.selfBadge}>
                              <ThemedText style={styles.selfBadgeText}>YOU</ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText style={styles.staffRole}>{ROLE_LABELS[member.role] || member.role}</ThemedText>
                        <ThemedText style={styles.staffEmail}>{member.email}</ThemedText>
                        {member.phone && <ThemedText style={styles.staffPhone}>{member.phone}</ThemedText>}
                      </View>

                      {/* Toggle Activation Button */}
                      {!isSelf && (
                        <TouchableOpacity
                          style={[
                            styles.statusBtn,
                            isActive ? styles.statusBtnDeactivate : styles.statusBtnActivate,
                          ]}
                          onPress={() => handleToggleStatus(member)}
                          activeOpacity={0.75}
                        >
                          {isActive ? (
                            <Trash2 size={16} color="#EF4444" />
                          ) : (
                            <Check size={16} color="#10B981" />
                          )}
                          <ThemedText style={[styles.statusBtnText, isActive ? { color: '#EF4444' } : { color: '#10B981' }]}>
                            {isActive ? 'Suspend' : 'Activate'}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        /* REGISTER STAFF FORM TAB */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              <ThemedText style={styles.formHeader}>Register Staff Credentials</ThemedText>
              
              {/* Full Name */}
              <ThemedText style={styles.inputLabel}>Full Name *</ThemedText>
              <View style={styles.inputContainer}>
                <User size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Rahul Sharma"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />
              </View>

              {/* Email Address */}
              <ThemedText style={styles.inputLabel}>Email Address *</ThemedText>
              <View style={styles.inputContainer}>
                <Mail size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="rahul@yard.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Phone Number */}
              <ThemedText style={styles.inputLabel}>Phone Number</ThemedText>
              <View style={styles.inputContainer}>
                <Phone size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>

              {/* Password */}
              <ThemedText style={styles.inputLabel}>Password *</ThemedText>
              <View style={styles.inputContainer}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={{ paddingHorizontal: 10 }}>
                  <ThemedText style={styles.toggleShowPasswordText}>{showPassword ? 'Hide' : 'Show'}</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Role Select Button */}
              <ThemedText style={styles.inputLabel}>System Permission Level (Role) *</ThemedText>
              <TouchableOpacity
                style={styles.rolePickerSelect}
                onPress={() => setRoleModalVisible(true)}
                activeOpacity={0.7}
              >
                <Shield size={18} color="#4F46E5" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.rolePickerValText}>
                    {ROLE_LABELS[selectedRole]}
                  </ThemedText>
                </View>
                <ThemedText style={styles.changeRoleLabelText}>Change</ThemedText>
              </TouchableOpacity>

              {/* Register Button */}
              <TouchableOpacity
                style={[styles.submitBtn, registering && styles.submitBtnDisabled]}
                onPress={handleRegister}
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

      {/* Role Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={roleModalVisible}
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Select Roster Role</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Configure system privilege access levels:</ThemedText>

            <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
              {ROLES_TO_CREATE.map((role) => {
                const isSelected = selectedRole === role.value;
                return (
                  <TouchableOpacity
                    key={role.value}
                    style={[styles.roleSelectRow, isSelected && styles.roleSelectRowActive]}
                    onPress={() => {
                      setSelectedRole(role.value);
                      setRoleModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleSelectRadio, isSelected && styles.roleSelectRadioActive]}>
                      {isSelected && <View style={styles.roleRadioCenter} />}
                    </View>
                    <ThemedText style={[styles.roleSelectLabel, isSelected && styles.roleSelectLabelActive]}>
                      {role.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setRoleModalVisible(false)}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#4F46E5',
  },
  tabButtonDisabled: {
    opacity: 0.5,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#4F46E5',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIconLeft: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    padding: 0,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  staffCardInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.75,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarActive: {
    backgroundColor: '#EEF2FF',
  },
  avatarInactive: {
    backgroundColor: '#F1F5F9',
  },
  staffMeta: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffTextInactive: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  selfBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selfBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  staffRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  staffEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  staffPhone: {
    fontSize: 11,
    color: '#64748B',
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusBtnDeactivate: {
    backgroundColor: '#FEE2E2',
  },
  statusBtnActivate: {
    backgroundColor: '#D1FAE5',
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  formHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 48,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    padding: 0,
  },
  toggleShowPasswordText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  rolePickerSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 20,
  },
  rolePickerValText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 14,
  },
  changeRoleLabelText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  roleSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleSelectRowActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#BFDBFE',
  },
  roleSelectRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  roleSelectRadioActive: {
    borderColor: '#4F46E5',
  },
  roleRadioCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F46E5',
  },
  roleSelectLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  roleSelectLabelActive: {
    color: '#4F46E5',
  },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
});
