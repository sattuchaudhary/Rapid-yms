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
  Image,
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
  AtSign,
  HelpCircle,
  Send,
  CheckCircle2,
} from 'lucide-react-native';

import {
  apiRequest,
  saveTokens,
  saveUserInfo,
  saveCachedEmail,
  getCachedEmail,
  saveOfflineCredentials,
  getOfflineCredentials,
  hashCredential,
  getBiometricRefreshToken,
} from '@/services/api';
import { UserSession } from '@/types/roles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Keyboard Open State
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Refs for input chaining
  const passwordInputRef = useRef<TextInput>(null);

  // Keyboard Event Listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardOpen(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
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
      const refreshToken = await getBiometricRefreshToken();
      const offlineData = await getOfflineCredentials();

      if (!refreshToken && !offlineData) {
        Alert.alert(
          'Biometric Login',
          'Please sign in with your email and password once to enable biometric login on this device.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate for Rapid YMS',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return;
      }

      setLoading(true);

      const net = await NetInfo.fetch();

      // 1. Try Refresh with Server if Online
      if (net.isConnected !== false && refreshToken) {
        try {
          const response = await apiRequest('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });

          if (response && response.accessToken && response.user) {
            await saveTokens(response.accessToken, response.refreshToken || refreshToken);
            await saveUserInfo(response.user);
            setLoading(false);
            navigateByRole(response.user);
            return;
          }
        } catch (serverErr) {
          console.warn('[Biometric Refresh Error]', serverErr);
        }
      }

      // 2. Offline / Saved Credentials Fallback
      if (offlineData && offlineData.session) {
        await saveUserInfo(offlineData.session);
        setLoading(false);
        navigateByRole(offlineData.session);
        return;
      }

      setLoading(false);
      setErrorMessage('Biometric session expired. Please sign in with your password.');
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Biometric authentication was cancelled.');
    }
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
      <StatusBar style="dark" backgroundColor="#ECEFFE" translucent={true} />
      <ScrollView
        style={styles.rootContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        {/* Sleek Enterprise Brand Header - Automatically hides when keyboard opens */}
        {!isKeyboardOpen && (
          <View style={[styles.topHeader, { paddingTop: insets.top + 24 }]}>
            <View style={styles.ambientGlowPrimary} />
            <View style={styles.ambientGlowSecondary} />

            <View style={styles.brandHeroContainer}>
              {/* Official Wordmark Logo */}
              <Image
                source={require('../../assets/app logo and icon/wordmark-premium.png')}
                style={styles.brandWordmark}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* Form Sheet Card - Slides to top when keyboard opens */}
        <View style={[styles.formCanvas, isKeyboardOpen && { marginTop: insets.top + 10, paddingTop: 22 }]}>
          {/* Modern Title Header */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>Login</Text>
              <View style={styles.titleIndicatorDot} />
            </View>
            <Text style={styles.subtitleText}>Enter your credentials to access yard control</Text>
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
        </View>
      </ScrollView>

      {/* Fixed Bottom Support Bar - Protected by Safe Area (Hidden when typing) */}
      {!isKeyboardOpen && (
        <View style={[styles.fixedBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.bottomMutedText}>Need yard access assistance? </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Yard Crew Support',
                'Please contact your Yard Administrator or Manager to provision credentials or reset security permissions.'
              )
            }
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.bottomHighlightText}>Contact Admin</Text>
          </TouchableOpacity>
        </View>
      )}

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
    backgroundColor: '#e4ebffff',
    paddingBottom: 70,
  },
  topHeader: {
    backgroundColor: '#ECEFFE',
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    paddingHorizontal: 0,
  },
  ambientGlowPrimary: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(0, 98, 255, 0.12)',
    top: -90,
    left: -40,
  },
  ambientGlowSecondary: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    bottom: -70,
    right: -40,
  },
  brandHeroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 12,
    zIndex: 2,
  },
  brandWordmark: {
    width: Math.min(SCREEN_WIDTH - 24, 440),
    height: Math.min(SCREEN_WIDTH - 24, 440) / 3.4,
    maxWidth: 440,
  },

  formCanvas: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    minHeight: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#e4ebffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    marginTop: -8,
    paddingHorizontal: 28,
    paddingTop: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 10,
  },
  titleSection: {
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  portalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 98, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 98, 255, 0.18)',
  },
  portalPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0062FF',
  },
  portalPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0062FF',
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  titleIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0062FF',
    marginTop: 6,
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#475569',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
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
    backgroundColor: '#FFFFFF',
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
  fixedBottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 14,
    backgroundColor: '#e4ebffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
  },
  bottomMutedText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
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
});
