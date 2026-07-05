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
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { apiRequest, saveTokens, saveUserInfo, getServerUrl, setServerUrl, saveSessionDate } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Shield, Server, Mail, Lock, Check, Key } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Server Settings Modal
  const [serverUrl, setServerUrlState] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Biometrics & Forgot Password Modals
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  useEffect(() => {
    // Load current server URL on mount
    const loadUrl = async () => {
      const url = await getServerUrl();
      setServerUrlState(url);
    };
    loadUrl();

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
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all details');
      return;
    }

    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = !!netInfo.isConnected;

      if (!isOnline) {
        // Offline Authentication Fallback from securely cached credentials
        const cachedEmail = await SecureStore.getItemAsync('yms_cached_email');
        const cachedPassword = await SecureStore.getItemAsync('yms_cached_password');

        if (
          cachedEmail &&
          cachedPassword &&
          cachedEmail === email.trim().toLowerCase() &&
          cachedPassword === password
        ) {
          console.log('[Login] Offline login authentication successful');
          Alert.alert('Offline Mode', 'Network offline. Authenticated successfully using local credentials.');
          router.replace('/admin/dashboard');
          setLoading(false);
          return;
        } else {
          Alert.alert(
            'Authentication Error',
            'You are offline. To log in offline, you must enter the exact email and password of your last online session on this device.'
          );
          setLoading(false);
          return;
        }
      }

      // Online authentication flow
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success) {
        await saveTokens(response.accessToken, response.refreshToken);
        await saveUserInfo(response.user);
        await saveSessionDate();

        // Save credentials securely for offline authentication
        await SecureStore.setItemAsync('yms_cached_email', email.trim().toLowerCase());
        await SecureStore.setItemAsync('yms_cached_password', password);

        // Redirect to admin dashboard
        router.replace('/admin/dashboard');
      } else {
        Alert.alert('Login Failed', response.error || 'Check credentials');
      }
    } catch (error: any) {
      console.error('[Login] Error:', error);
      Alert.alert('Login Error', error.message || 'Server connection failed. Set correct server IP.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const cachedEmail = await SecureStore.getItemAsync('yms_cached_email');
      const cachedPassword = await SecureStore.getItemAsync('yms_cached_password');

      if (!cachedEmail || !cachedPassword) {
        Alert.alert('Biometrics Setup Required', 'Please log in with your email and password at least once before using biometrics.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Enterprise YMS',
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        setEmail(cachedEmail);
        setPassword(cachedPassword);
        setLoading(true);

        const netInfo = await NetInfo.fetch();
        const isOnline = !!netInfo.isConnected;

        if (isOnline) {
          const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: cachedEmail, password: cachedPassword }),
          });

          if (response.success) {
            await saveTokens(response.accessToken, response.refreshToken);
            await saveUserInfo(response.user);
            await saveSessionDate();
            router.replace('/admin/dashboard');
          } else {
            Alert.alert('Biometric Login Failed', response.error || 'Check credentials');
          }
        } else {
          // Offline biometrics success bypass
          Alert.alert('Offline Mode', 'Authenticated successfully using biometrics in offline mode.');
          router.replace('/admin/dashboard');
        }
      }
    } catch (e: any) {
      console.warn('[Biometrics Auth] Error:', e);
      Alert.alert('Biometric Error', 'Authentication process failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServer = async () => {
    const url = serverUrl.trim();
    if (!url) {
      Alert.alert('Error', 'URL cannot be empty');
      return;
    }
    // URL Pattern Regex Verification
    const urlPattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
    if (!urlPattern.test(url)) {
      Alert.alert('Invalid Endpoint', 'Please enter a valid URL starting with http:// or https://');
      return;
    }
    await setServerUrl(url);
    setModalVisible(false);
    Alert.alert('Success', 'Server URL updated');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {/* Settings Icon */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Server size={22} color="#6366F1" />
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
            <View style={styles.inputContainer}>
              <Mail size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Lock size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Login Button Row with Biometrics */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
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
                  <Key size={24} color="#6366F1" />
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
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <ThemedText style={styles.modalTitle}>Server Configuration</ThemedText>
                  <ThemedText style={styles.modalSubtitle}>
                    Change API Server endpoint if testing on custom LAN IP:
                  </ThemedText>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="http://192.168.1.XX:5000"
                    placeholderTextColor="#64748B"
                    value={serverUrl}
                    onChangeText={setServerUrlState}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={styles.modalBtnRow}>
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
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#1E1B4B', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <Shield size={26} color="#6366F1" />
                  </View>
                  <ThemedText style={styles.modalTitle}>Forgot Password?</ThemedText>
                </View>
                
                <ThemedText style={{ color: '#94A3B8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 }}>
                  Security rules ke anusar, please reset ke liye apne **Yard Tenant Admin** ya crew supervisor se contact karein. Wo aapka credentials details panel se override kar sakte hain.
                </ThemedText>

                <TouchableOpacity
                  style={[styles.loginBtn, { marginTop: 0 }]}
                  onPress={() => setForgotModalVisible(false)}
                >
                  <ThemedText style={styles.loginBtnText}>Okay, Got It</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  settingsBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 45,
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
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
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
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  biometricBtn: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    height: 50,
    fontSize: 15,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalCloseBtn: {
    backgroundColor: '#374151',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
