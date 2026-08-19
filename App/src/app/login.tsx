import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { apiRequest, saveTokens, saveUserInfo, getServerUrl, setServerUrl, saveSessionDate } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Shield, Server, Mail, Lock, Check, Scan, Eye, EyeOff, RefreshCw } from 'lucide-react-native';

const DEFAULT_SERVER_URL = 'https://rapid-yms.onrender.com';

// Non-reversible secure credential hash generator for offline authentication
const hashCredential = (email: string, pass: string) => {
  const str = `${email.trim().toLowerCase()}:${pass}:yms_secure_offline_salt_2026`;
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'server' | null>(null);

  // Server Settings Modal
  const [serverUrl, setServerUrlState] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Biometrics & Forgot Password Modals
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  useEffect(() => {
    // Load current server URL and pre-fill saved email on mount
    const loadSavedCredentials = async () => {
      try {
        const url = await getServerUrl();
        setServerUrlState(url);
        const cachedEmail = await SecureStore.getItemAsync('yms_cached_email');
        if (cachedEmail) {
          setEmail(cachedEmail);
        }
      } catch (err) {
        console.warn('[Login] Error loading saved credentials:', err);
      }
    };
    loadSavedCredentials();

    // Check biometric compatibility
    const checkBiometrics = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricsAvailable(hasHardware && isEnrolled);
      } catch (e) {
        console.warn('[Biometrics] Support check failed:', e);
      }
    };
    checkBiometrics();
  }, []);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (!password) {
      Alert.alert('Password Required', 'Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!(netInfo.isConnected && netInfo.isInternetReachable !== false);

      if (!isOnline) {
        // Secure Offline Authentication Fallback from cached hash
        const cachedEmail = await SecureStore.getItemAsync('yms_cached_email');
        const cachedHash = await SecureStore.getItemAsync('yms_cached_auth_hash');
        const inputHash = hashCredential(cleanEmail, password);

        const isMatch = cachedEmail && cachedEmail === cleanEmail && cachedHash && cachedHash === inputHash;

        if (isMatch) {
          console.log('[Login] Offline login authentication successful');
          await saveSessionDate();
          router.replace('/admin/dashboard');
          setLoading(false);
          return;
        } else {
          Alert.alert(
            'Offline Authentication',
            'Network is offline. To sign in offline, enter the exact email & password of your previous online session on this device.'
          );
          setLoading(false);
          return;
        }
      }

      // Online authentication flow
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (response.success) {
        await saveTokens(response.accessToken, response.refreshToken);
        await saveUserInfo(response.user);
        await saveSessionDate();

        // Save credentials securely using non-reversible hash for offline authentication
        const credHash = hashCredential(cleanEmail, password);
        await SecureStore.setItemAsync('yms_cached_email', cleanEmail);
        await SecureStore.setItemAsync('yms_cached_auth_hash', credHash);

        // Redirect to admin dashboard
        router.replace('/admin/dashboard');
      } else {
        Alert.alert('Login Failed', response.error || response.message || 'Invalid email or password. Please try again.');
      }
    } catch (error: any) {
      console.error('[Login] Error:', error);
      Alert.alert(
        'Connection Error',
        error.message || 'Unable to connect to server. Please check your internet or configure the Server IP in settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const cachedEmail = await SecureStore.getItemAsync('yms_cached_email');
      const cachedHash = await SecureStore.getItemAsync('yms_cached_auth_hash');

      if (!cachedEmail || !cachedHash) {
        Alert.alert(
          'Biometrics Setup Required',
          'Please log in with your email and password at least once on this device before using biometrics.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Enterprise YMS',
        fallbackLabel: 'Use Password',
      });

      if (!result.success) {
        return;
      }

      setEmail(cachedEmail);
      setLoading(true);

      const netInfo = await NetInfo.fetch();
      const isOnline = !!(netInfo.isConnected && netInfo.isInternetReachable !== false);

      if (isOnline) {
        const refreshToken = await SecureStore.getItemAsync('yms_refresh_token');
        const baseUrl = await getServerUrl();

        if (!refreshToken) {
          Alert.alert(
            'Session Expired',
            'Your previous session has expired. Please log in with your password once to re-activate biometrics.'
          );
          setLoading(false);
          return;
        }

        try {
          const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const resData = await refreshRes.json();
            if (resData.success && resData.accessToken) {
              await saveTokens(resData.accessToken, resData.refreshToken || refreshToken);
              await saveSessionDate();
              router.replace('/admin/dashboard');
              return;
            }
          }

          // If refresh token is expired/invalid on server
          Alert.alert(
            'Session Expired',
            'Your server session has expired. Please enter your password to sign in.'
          );
          setLoading(false);
          return;
        } catch (netErr) {
          console.warn('[Biometrics] Network error during token refresh, attempting offline entry:', netErr);
          // If server is unreachable, allow offline entry with cached session
          await saveSessionDate();
          router.replace('/admin/dashboard');
          return;
        }
      }

      // Offline mode
      await saveSessionDate();
      router.replace('/admin/dashboard');
    } catch (e: any) {
      console.warn('[Biometrics Auth] Error:', e);
      Alert.alert('Biometric Error', 'Authentication process failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServer = async () => {
    let url = serverUrl.trim().replace(/\/+$/, '');
    if (!url) {
      Alert.alert('Error', 'Server URL cannot be empty');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      Alert.alert('Invalid Endpoint', 'Please enter a valid URL (e.g. https://your-server.com or http://192.168.1.50:5000)');
      return;
    }

    await setServerUrl(url);
    setServerUrlState(url);
    setModalVisible(false);
    Alert.alert('Success', `Server URL updated to:\n${url}`);
  };

  const handleResetServer = async () => {
    await setServerUrl(DEFAULT_SERVER_URL);
    setServerUrlState(DEFAULT_SERVER_URL);
    setModalVisible(false);
    Alert.alert('Reset Complete', 'Server URL reset to production default.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#0B0F19' }}
    >
      <StatusBar style="light" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 24) + 12,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Settings Icon */}
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Server size={20} color="#818CF8" />
            </TouchableOpacity>

            {/* Logo Header */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Shield size={38} color="#6366F1" />
              </View>
              <ThemedText style={styles.brandTitle}>ENTERPRISE YMS</ThemedText>
              <ThemedText style={styles.brandSubtitle}>Yard Management SaaS Mobile</ThemedText>
            </View>

            {/* Login Form Container */}
            <View style={styles.formCard}>
              <ThemedText style={styles.formTitle}>Sign In</ThemedText>

              {/* Email Field */}
              <View style={[styles.inputContainer, focusedField === 'email' && styles.inputContainerFocused]}>
                <Mail size={18} color={focusedField === 'email' ? '#818CF8' : '#64748B'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              {/* Password Field */}
              <View style={[styles.inputContainer, focusedField === 'password' && styles.inputContainerFocused]}>
                <Lock size={18} color={focusedField === 'password' ? '#818CF8' : '#64748B'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 4 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94A3B8" />
                  ) : (
                    <Eye size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Login Button Row with Biometrics */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.loginBtn, { flex: 1 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.loginBtnText}>Secure Log In</ThemedText>
                  )}
                </TouchableOpacity>

                {biometricsAvailable && (
                  <TouchableOpacity
                    style={styles.biometricBtn}
                    onPress={handleBiometricLogin}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Scan size={22} color="#818CF8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                onPress={() => setForgotModalVisible(true)}
                style={styles.forgotBtn}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.forgotText}>Forgot Password?</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Server Config Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => setModalVisible(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <ThemedText style={styles.modalTitle}>Server Configuration</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>
                      Configure API endpoint for custom LAN / Cloud server:
                    </ThemedText>

                    <TextInput
                      style={styles.modalInput}
                      placeholder="https://rapid-yms.onrender.com"
                      placeholderTextColor="#64748B"
                      value={serverUrl}
                      onChangeText={setServerUrlState}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <View style={styles.modalBtnRow}>
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.modalResetBtn]}
                        onPress={handleResetServer}
                      >
                        <RefreshCw size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                        <ThemedText style={styles.modalResetText}>Reset</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalBtn, styles.modalCloseBtn]}
                        onPress={() => setModalVisible(false)}
                      >
                        <ThemedText style={styles.modalCloseText}>Cancel</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalBtn, styles.modalSaveBtn]}
                        onPress={handleSaveServer}
                      >
                        <Check size={16} color="#FFF" style={{ marginRight: 4 }} />
                        <ThemedText style={styles.modalSaveText}>Save</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* Forgot Password Modal */}
            <Modal
              animationType="fade"
              transparent={true}
              visible={forgotModalVisible}
              onRequestClose={() => setForgotModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E1B4B', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#4338CA' }}>
                      <Shield size={26} color="#818CF8" />
                    </View>
                    <ThemedText style={styles.modalTitle}>Reset Password</ThemedText>
                  </View>
                  
                  <ThemedText style={{ color: '#94A3B8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 }}>
                    Security compliance rules ke mutabiq, password reset ke liye apne <ThemedText style={{ fontWeight: '700', color: '#FFFFFF' }}>Yard Tenant Admin</ThemedText> ya crew supervisor se sampark karein. Wo Admin Panel se aapka temporary credentials generate kar sakte hain.
                  </ThemedText>

                  <TouchableOpacity
                    style={[styles.loginBtn, { marginTop: 0 }]}
                    onPress={() => setForgotModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.loginBtnText}>Got It</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    position: 'relative',
  },
  settingsBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 10,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  formTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  loginBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  biometricBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4338CA',
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotBtn: {
    alignSelf: 'center',
    marginTop: 18,
    padding: 4,
  },
  forgotText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    height: 50,
    fontSize: 14,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalResetBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 'auto',
  },
  modalResetText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalCloseBtn: {
    backgroundColor: '#374151',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
