import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  Platform,
  PanResponder,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  X,
  Building2,
  LogOut,
  Landmark,
  Users,
  BarChart3,
  Settings,
  ChevronRight,
  ScanText,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

export interface DashboardDrawerProps {
  visible: boolean;
  onClose: () => void;
  yardName?: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: string;
  onLogout?: () => void;
}

interface DrawerMenuItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBgColor: string;
}

const DRAWER_MENU_ITEMS: DrawerMenuItem[] = [
  {
    id: 'ocr',
    title: 'OCR Scanner',
    subtitle: 'Extract text from image/doc',
    route: '/tenant_admin/admin/ocr',
    icon: ScanText,
    iconColor: '#EA580C',
    iconBgColor: '#FFF7ED',
  },
  {
    id: 'banks',
    title: 'Bank Management',
    subtitle: 'Parking rates & sub-banks',
    route: '/tenant_admin/admin/banks',
    icon: Landmark,
    iconColor: '#0062FF',
    iconBgColor: '#EFF6FF',
  },
  {
    id: 'users',
    title: 'User Management',
    subtitle: 'Staff accounts & role access',
    route: '/tenant_admin/admin/users',
    icon: Users,
    iconColor: '#7C3AED',
    iconBgColor: '#F5F3FF',
  },
  {
    id: 'reports',
    title: 'Reports',
    subtitle: 'Yard stats & revenue insights',
    route: '/tenant_admin/admin/reports',
    icon: BarChart3,
    iconColor: '#0D9488',
    iconBgColor: '#F0FDFA',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Yard config & preferences',
    route: '/tenant_admin/admin/settings',
    icon: Settings,
    iconColor: '#475569',
    iconBgColor: '#F1F5F9',
  },
];

export default function DashboardDrawer({
  visible,
  onClose,
  yardName = 'Rapid Logistics Yard',
  onLogout,
}: DashboardDrawerProps) {
  const insets = useSafeAreaInsets();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Dynamic Live App Version from Expo Constants / app.json
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    '1.0.0';

  // Animation values for Drawer
  const animValue = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Animation values for Logout Modal
  const modalScale = useRef(new Animated.Value(0.85)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // PanResponder for smooth swipe-to-close gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && gestureState.dx < 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const progress = Math.max(0, 1 + gestureState.dx / DRAWER_WIDTH);
          animValue.setValue(progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -DRAWER_WIDTH * 0.25 || gestureState.vx < -0.5) {
          handleClose();
        } else {
          Animated.spring(animValue, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      Animated.parallel([
        Animated.spring(animValue, {
          toValue: 1,
          friction: 8,
          tension: 52,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 320,
          delay: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (showLogoutConfirm) {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalScale.setValue(0.85);
      modalOpacity.setValue(0);
    }
  }, [showLogoutConfirm]);

  const handleClose = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.timing(animValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    handleClose();
    if (onLogout) {
      onLogout();
    }
  };

  const router = useRouter();

  const handleNavigate = (path: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync().catch(() => {});
    }
    handleClose();
    setTimeout(() => {
      router.push(path as any);
    }, 120);
  };

  if (!visible && !showLogoutConfirm) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const drawerTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH - 20, 0],
  });

  const headerScale = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0],
  });

  const contentOpacity = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <>
      <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
        {/* Dynamic Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Sliding Drawer Panel */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              paddingTop: insets.top + (Platform.OS === 'ios' ? 14 : 18),
              paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 18 : 16),
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
        >
          {/* Glowing Edge Line */}
          <View style={styles.rightGlowEdge} />

          {/* Top Header Card */}
          <Animated.View
            style={[
              styles.drawerHeader,
              {
                opacity: contentOpacity,
                transform: [{ scale: headerScale }],
              },
            ]}
          >
            <View style={styles.yardHeaderRow}>
              <View style={styles.yardIconCircle}>
                <Building2 size={19} color="#0062FF" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.yardNameText} numberOfLines={1}>
                  {yardName}
                </Text>
                <Text style={styles.systemTag}>Rapid YMS • Yard Control</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close Drawer"
              >
                <X size={18} color="#64748B" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Drawer Menu Items */}
          <Animated.View
            style={[
              styles.drawerBody,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <Text style={styles.menuSectionHeader}>MANAGEMENT</Text>

            <ScrollView
              style={styles.menuListScroll}
              contentContainerStyle={styles.menuListScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {DRAWER_MENU_ITEMS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuItemCard}
                    onPress={() => handleNavigate(item.route)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View
                      style={[
                        styles.menuIconCircle,
                        { backgroundColor: item.iconBgColor },
                      ]}
                    >
                      <IconComponent
                        size={18}
                        color={item.iconColor}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.menuTextContent}>
                      <Text style={styles.menuItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" strokeWidth={2} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Bottom Footer Actions & Dynamic Live App Version */}
          <Animated.View
            style={[
              styles.drawerFooter,
              {
                opacity: contentOpacity,
              },
            ]}
          >
            {onLogout && (
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => setShowLogoutConfirm(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                <LogOut size={18} color="#E11D48" strokeWidth={2.2} />
                <Text style={styles.logoutText}>Sign Out of Yard</Text>
              </TouchableOpacity>
            )}

            {/* Live Dynamic App Version & Branding Row */}
            <View style={styles.versionContainer}>
              <Image
                source={require('../../../../../assets/app logo and icon/wordmark-premium.png')}
                style={styles.drawerWordmark}
                resizeMode="contain"
              />
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v{appVersion}</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Ultra-Attractive Custom Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="none"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLogoutConfirm(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalCard,
                  {
                    opacity: modalOpacity,
                    transform: [{ scale: modalScale }],
                  },
                ]}
              >
                {/* Glowing Danger Aura Icon */}
                <View style={styles.dangerAuraOuter}>
                  <View style={styles.dangerAuraInner}>
                    <LogOut size={26} color="#E11D48" strokeWidth={2.4} />
                  </View>
                </View>

                {/* Dialog Content */}
                <Text style={styles.modalTitle}>Sign Out of Yard?</Text>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to exit? Your active yard management session on this device will be closed.
                </Text>

                {/* Modal Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowLogoutConfirm(false)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.cancelButtonText}>Stay In</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmLogoutButton}
                    onPress={handleConfirmLogout}
                    activeOpacity={0.85}
                  >
                    <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.confirmLogoutText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0F1D',
    zIndex: 999,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 25,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  rightGlowEdge: {
    position: 'absolute',
    top: 40,
    bottom: 40,
    right: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#0062FF',
    opacity: 0.4,
  },
  drawerHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  yardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yardNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  systemTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    flex: 1,
    paddingTop: 16,
  },
  menuSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  menuListScroll: {
    flex: 1,
  },
  menuListScrollContent: {
    paddingBottom: 16,
    gap: 10,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    gap: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF1F2',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  logoutText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#E11D48',
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  drawerWordmark: {
    width: 155,
    height: 36,
    opacity: 0.92,
  },
  versionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },

  // ---- Ultra Attractive Logout Confirmation Modal Styles ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  dangerAuraOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(225, 29, 72, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dangerAuraInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 6,
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmLogoutButton: {
    flex: 1.2,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E11D48',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmLogoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
