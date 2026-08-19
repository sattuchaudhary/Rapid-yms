import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import NetInfo from '@react-native-community/netinfo';
import {
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  AlertCircle,
  X,
  Globe,
  Radio,
  AtSign,
  HelpCircle,
  Send,
  CheckCircle2,
  Truck,
  Package,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';

import {
  apiRequest,
  saveTokens,
  saveUserInfo,
  getServerUrl,
  setServerUrl,
  saveCachedEmail,
  getCachedEmail,
  saveOfflineCredentials,
  getOfflineCredentials,
  hashCredential,
  getBiometricRefreshToken,
  DEFAULT_SERVER_URL,
} from '@/services/api';
import { UserSession } from '@/types/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Connectivity
  const [isOnline, setIsOnline] = useState(true);

  // Modals
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Server state
  const [currentServerUrl, setCurrentServerUrl] = useState(DEFAULT_SERVER_URL);
  const [customServerInput, setCustomServerInput] = useState('');

  // Refs for input chaining
  const passwordInputRef = useRef<TextInput>(null);

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const savedUrl = await getServerUrl();
        if (isMounted) {
          setCurrentServerUrl(savedUrl);
          setCustomServerInput(savedUrl);
        }

        const cachedEmail = await getCachedEmail();
        if (isMounted && cachedEmail) {
          setEmail(cachedEmail);
          setForgotEmail(cachedEmail);
        }

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (isMounted) {
          setBiometricsAvailable(hasHardware && isEnrolled);
        }
      } catch (err) {
        console.warn('[Login Init Error]', err);
      }
    };
    init();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (isMounted) {
        setIsOnline(state.isConnected !== false);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Smart Role Navigator
  const navigateByRole = (user: UserSession) => {
    const role = (user.role || '').toUpperCase();
    console.log(`[Login] Successful authentication. Navigating for role: ${role}`);

    switch (role) {
      case 'SUPER_ADMIN':
        router.replace('/superadmin' as any);
        break;
      case 'TENANT_ADMIN':
      case 'ADMIN':
        router.replace('/tenant_admin/admin/dashboard' as any);
        break;
      case 'SUB_ADMIN':
        router.replace('/tenant_admin/sub_admin' as any);
        break;
      case 'MANAGER':
        router.replace('/tenant_admin/manager' as any);
        break;
      case 'SUPERVISOR':
        router.replace('/tenant_admin/supervisor' as any);
        break;
      case 'EXECUTIVE':
        router.replace('/tenant_admin/executive' as any);
        break;
      case 'GUARD':
      default:
        router.replace('/tenant_admin/guard' as any);
        break;
    }
  };

  // Standard Credentials Login
  const handleLogin = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your work email ID.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const net = await NetInfo.fetch();
      const online = net.isConnected !== false;

      if (!online) {
        const offlineData = await getOfflineCredentials();
        if (offlineData) {
          const currentHash = hashCredential(cleanEmail, password);
          if (offlineData.hash === currentHash) {
            await saveUserInfo(offlineData.session);
            setLoading(false);
            navigateByRole(offlineData.session);
            return;
          }
        }
        throw new Error('You are currently offline. Please connect to the internet to sign in.');
      }

      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      if (response && response.accessToken && response.user) {
        await saveTokens(response.accessToken, response.refreshToken || '');
        await saveUserInfo(response.user);
        await saveCachedEmail(cleanEmail);
        await saveOfflineCredentials(cleanEmail, password, response.user);

        setLoading(false);
        navigateByRole(response.user);
      } else {
        throw new Error('Invalid response received from server.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // Biometric Instant Login
  const handleBiometricAuth = async () => {
    setErrorMessage(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate for Rapid YMS',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        const refreshToken = await getBiometricRefreshToken();
        if (!refreshToken) {
          setLoading(false);
          setErrorMessage('Biometric token expired. Please sign in with password once.');
          return;
        }

        const net = await NetInfo.fetch();
        if (net.isConnected === false) {
          const offlineData = await getOfflineCredentials();
          if (offlineData) {
            setLoading(false);
            navigateByRole(offlineData.session);
            return;
          }
        }

        const response = await apiRequest('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });

        if (response && response.accessToken && response.user) {
          await saveTokens(response.accessToken, response.refreshToken || refreshToken);
          await saveUserInfo(response.user);
          setLoading(false);
          navigateByRole(response.user);
        } else {
          throw new Error('Biometric session expired. Please enter password.');
        }
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Biometric authentication was cancelled.');
    }
  };

  // Server Settings Save
  const handleSaveServer = async (url: string) => {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    await setServerUrl(clean);
    setCurrentServerUrl(clean);
    setServerModalVisible(false);
    Alert.alert('Server Configured', `API endpoint set to:\n${clean}`);
  };

  const handleForgotSubmit = () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      setForgotError('Please enter your email ID.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotError(null);
    setForgotSubmitted(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" backgroundColor="#ECEFFE" />
      <ScrollView
        style={[styles.rootContainer, { paddingTop: insets.top }]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        {/* Ambient Top Glow / Header */}
        <View style={styles.topAmbient}>
          {/* Top Bar with Server Selector */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.serverBadge}
              onPress={() => setServerModalVisible(true)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Configure API server endpoint"
            >
              <Globe size={13} color="#0062FF" />
              <Text style={styles.serverBadgeText} numberOfLines={1}>
                {currentServerUrl.replace('https://', '').replace('http://', '')}
              </Text>
              <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
            </TouchableOpacity>
          </View>

          {/* Custom Hero Illustration */}
          <View style={styles.heroContainer}>
            {/* Ambient blobs */}
            <View style={styles.blobOne} />
            <View style={styles.blobTwo} />

            {/* Ground / lot marking */}
            <View style={styles.laneMarkingRow}>
              {Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={styles.laneDash} />
              ))}
            </View>

            {/* Floating badge: Package */}
            <View style={[styles.floatBadge, styles.floatBadgeTopLeft]}>
              <Package size={16} color="#0062FF" />
            </View>

            {/* Floating badge: MapPin */}
            <View style={[styles.floatBadge, styles.floatBadgeTopRight]}>
              <MapPin size={16} color="#7C3AED" />
            </View>

            {/* Floating badge: Shield */}
            <View style={[styles.floatBadge, styles.floatBadgeBottomRight]}>
              <ShieldCheck size={15} color="#16A34A" />
            </View>

            {/* Central hero badge */}
            <View style={styles.heroBadgeOuter}>
              <View style={styles.heroBadgeInner}>
                <Truck size={38} color="#FFFFFF" strokeWidth={1.8} />
              </View>
            </View>

            <Text style={styles.heroCaption}>Manage your yard, on the move</Text>
          </View>
        </View>

        {/* Form Sheet Card */}
        <View style={styles.formCanvas}>
          {/* Title Header */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>Login</Text>
            <Text style={styles.taglineText}>Enterprise Yard Management System</Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={17} color="#E11D48" style={{ marginTop: 1 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Input 1: Email */}
          <View style={styles.inputBlock}>
            <View
              style={[
                styles.inputUnderlineBox,
                focusedField === 'email' && styles.inputUnderlineBoxFocused,
              ]}
            >
              <AtSign
                size={20}
                color={focusedField === 'email' ? '#0062FF' : '#9CA3AF'}
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Email ID"
                placeholderTextColor="#9CA3AF"
                value={email}
                editable={!loading}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
              {email.length > 0 && (
                <TouchableOpacity
                  onPress={() => setEmail('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear email"
                >
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Input 2: Password */}
          <View style={styles.inputBlock}>
            <View
              style={[
                styles.inputUnderlineBox,
                focusedField === 'password' && styles.inputUnderlineBoxFocused,
              ]}
            >
              <Lock
                size={20}
                color={focusedField === 'password' ? '#0062FF' : '#9CA3AF'}
                style={styles.inputLeftIcon}
              />
              <TextInput
                ref={passwordInputRef}
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                editable={!loading}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={19} color="#6B7280" />
                ) : (
                  <Eye size={19} color="#6B7280" />
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => {
                setForgotSubmitted(false);
                setForgotError(null);
                setForgotModalVisible(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.forgotLinkText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Main Action Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Login"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* OR Divider */}
          {biometricsAvailable && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Biometric Secondary Button */}
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                activeOpacity={0.8}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Login with biometrics"
              >
                <Fingerprint size={20} color="#0062FF" />
                <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Bottom Support Link */}
          <View style={styles.bottomSection}>
            <Text style={styles.bottomMutedText}>Need yard access assistance? </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Yard Crew Support',
                  'Please contact your Yard Administrator or Manager to provision credentials or reset security permissions.'
                )
              }
              accessibilityRole="button"
            >
              <Text style={styles.bottomHighlightText}>Contact Admin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableWithoutFeedback onPress={() => setForgotModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHandle} />

                  {!forgotSubmitted ? (
                    <>
                      <View style={styles.modalHeader}>
                        <View style={styles.modalIconBox}>
                          <HelpCircle size={22} color="#0062FF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalTitle}>Forgot Password?</Text>
                          <Text style={styles.modalSubtitle}>
                            Enter your work email address associated with your yard account.
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.closeBtn}
                          onPress={() => setForgotModalVisible(false)}
                          accessibilityRole="button"
                          accessibilityLabel="Close"
                        >
                          <X size={18} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          styles.inputUnderlineBox,
                          { marginTop: 14, marginBottom: 6 },
                          forgotError && styles.inputUnderlineBoxError,
                        ]}
                      >
                        <AtSign size={20} color="#0062FF" style={styles.inputLeftIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Email ID / Mobile number"
                          placeholderTextColor="#9CA3AF"
                          value={forgotEmail}
                          onChangeText={(val) => {
                            setForgotEmail(val);
                            if (forgotError) setForgotError(null);
                          }}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                      {forgotError && <Text style={styles.inlineErrorText}>{forgotError}</Text>}

                      <TouchableOpacity
                        style={[styles.modalSubmitButton, { marginTop: 12 }]}
                        onPress={handleForgotSubmit}
                        accessibilityRole="button"
                      >
                        <Text style={styles.modalSubmitButtonText}>Submit Request</Text>
                        <Send size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.successStateBox}>
                      <CheckCircle2 size={48} color="#16A34A" />
                      <Text style={styles.successTitle}>Request Sent</Text>
                      <Text style={styles.successDesc}>
                        A password reset notification has been forwarded to your Yard Admin for verification.
                      </Text>
                      <TouchableOpacity
                        style={[styles.modalSubmitButton, { backgroundColor: '#16A34A', marginTop: 16 }]}
                        onPress={() => setForgotModalVisible(false)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.modalSubmitButtonText}>Back to Login</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Server Endpoint Configuration Modal */}
      <Modal
        visible={serverModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setServerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableWithoutFeedback onPress={() => setServerModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalIconBox}>
                      <Globe size={22} color="#0062FF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>API Server Endpoint</Text>
                      <Text style={styles.modalSubtitle}>Select or configure backend API connection</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.closeBtn}
                      onPress={() => setServerModalVisible(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                    >
                      <X size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalBody}>
                    <Text style={styles.presetLabel}>Quick Presets:</Text>
                    <TouchableOpacity
                      style={[
                        styles.presetOption,
                        currentServerUrl === DEFAULT_SERVER_URL && styles.presetOptionActive,
                      ]}
                      onPress={() => handleSaveServer(DEFAULT_SERVER_URL)}
                    >
                      <Radio size={16} color={currentServerUrl === DEFAULT_SERVER_URL ? '#0062FF' : '#9CA3AF'} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.presetTitle}>Cloud Production</Text>
                        <Text style={styles.presetUrl}>{DEFAULT_SERVER_URL}</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.presetOption,
                        currentServerUrl.includes('192.168.') && styles.presetOptionActive,
                      ]}
                      onPress={() => handleSaveServer('http://192.168.1.100:5000')}
                    >
                      <Radio size={16} color={currentServerUrl.includes('192.168.') ? '#0062FF' : '#9CA3AF'} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.presetTitle}>Local Network Development</Text>
                        <Text style={styles.presetUrl}>http://192.168.1.100:5000</Text>
                      </View>
                    </TouchableOpacity>

                    <Text style={[styles.presetLabel, { marginTop: 14 }]}>Custom Endpoint URL:</Text>
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="https://your-server.com"
                        placeholderTextColor="#9CA3AF"
                        value={customServerInput}
                        onChangeText={setCustomServerInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.saveServerBtn}
                        onPress={() => handleSaveServer(customServerInput)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.saveServerBtnText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#ECEFFE',
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#ECEFFE',
  },
  scrollContent: {
    flexGrow: 1,
  },
  topAmbient: {
    backgroundColor: '#ECEFFE',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  serverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  serverBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 160,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },

  // ---- Custom Hero Illustration ----
  heroContainer: {
    height: 160,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.375,
    backgroundColor: 'rgba(0, 98, 255, 0.10)',
    top: -SCREEN_WIDTH * 0.35,
    left: -SCREEN_WIDTH * 0.15,
  },
  blobTwo: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: SCREEN_WIDTH * 0.275,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    bottom: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.15,
  },
  laneMarkingRow: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    gap: 10,
    opacity: 0.5,
  },
  laneDash: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
  },
  heroBadgeOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 98, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0062FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCaption: {
    position: 'absolute',
    bottom: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  floatBadge: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatBadgeTopLeft: {
    top: 10,
    left: 36,
    transform: [{ rotate: '-8deg' }],
  },
  floatBadgeTopRight: {
    top: 6,
    right: 42,
    transform: [{ rotate: '10deg' }],
  },
  floatBadgeBottomRight: {
    bottom: 34,
    right: 26,
    transform: [{ rotate: '-6deg' }],
  },
  // ---- End Hero Illustration ----

  formCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
  },
  titleSection: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  taglineText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#E11D48',
    fontWeight: '600',
  },
  inputBlock: {
    marginBottom: 14,
  },
  inputUnderlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  inputUnderlineBoxFocused: {
    borderColor: '#0062FF',
    backgroundColor: '#FFFFFF',
  },
  inputUnderlineBoxError: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E11D48',
    marginTop: 4,
    marginLeft: 2,
  },
  inputLeftIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 2,
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0062FF',
  },
  loginButton: {
    backgroundColor: '#0062FF',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  biometricButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  bottomMutedText: {
    fontSize: 13,
    color: '#6B7280',
  },
  bottomHighlightText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0062FF',
  },

  // Modal Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
  },
  modalSubmitButton: {
    backgroundColor: '#0062FF',
    borderRadius: 20,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  successStateBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  successDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  modalBody: {
    gap: 10,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  presetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetOptionActive: {
    borderColor: '#0062FF',
    backgroundColor: '#EFF2FE',
  },
  presetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  presetUrl: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
  },
  saveServerBtn: {
    backgroundColor: '#0062FF',
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveServerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
