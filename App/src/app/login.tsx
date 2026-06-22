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
import { apiRequest, saveTokens, saveUserInfo, getServerUrl, setServerUrl, saveSessionDate } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Shield, Server, Mail, Lock, Check } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Server Settings Modal
  const [serverUrl, setServerUrlState] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Load current server URL on mount
    const loadUrl = async () => {
      const url = await getServerUrl();
      setServerUrlState(url);
    };
    loadUrl();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all details');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success) {
        await saveTokens(response.accessToken, response.refreshToken);
        await saveUserInfo(response.user);
        await saveSessionDate();

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

  const handleSaveServer = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'URL cannot be empty');
      return;
    }
    await setServerUrl(serverUrl.trim());
    setModalVisible(false);
    Alert.alert('Success', 'Server URL updated');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.container}>
          {/* Settings Icon */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Server size={22} color="#2563EB" />
          </TouchableOpacity>

          {/* Logo Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Shield size={38} color="#2563EB" />
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
                placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginBtn}
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
          </View>

          {/* Server Config Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
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
                  placeholderTextColor="#94A3B8"
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
          </Modal>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 40,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#0F172A',
    fontSize: 15,
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
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
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
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
});
