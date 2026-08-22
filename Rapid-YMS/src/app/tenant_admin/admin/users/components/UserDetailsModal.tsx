import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Linking,
} from 'react-native';
import {
  X,
  Mail,
  Phone,
  Shield,
  Calendar,
  KeyRound,
  UserX,
  UserCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { YardUser, ROLE_META } from '../types';

export interface UserDetailsModalProps {
  visible: boolean;
  user: YardUser | null;
  onClose: () => void;
  onToggleStatus?: (user: YardUser) => void;
  onResetPassword?: (user: YardUser) => void;
}

export default function UserDetailsModal({
  visible,
  user,
  onClose,
  onToggleStatus,
  onResetPassword,
}: UserDetailsModalProps) {
  if (!user) return null;

  const roleInfo = ROLE_META[user.role] || ROLE_META.GUARD;
  const initials = user.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const isActive = user.status === 'ACTIVE';

  const handleCall = () => {
    if (user.phone) {
      Linking.openURL(`tel:${user.phone}`).catch(() => {});
    }
  };

  const handleEmail = () => {
    if (user.email) {
      Linking.openURL(`mailto:${user.email}`).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.headerRow}>
                <Text style={styles.modalTitle}>Staff Details</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#64748B" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              {/* Profile Card Header */}
              <View style={styles.profileSection}>
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: roleInfo.avatarBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: roleInfo.avatarTextColor },
                    ]}
                  >
                    {initials}
                  </Text>
                </View>
                <Text style={styles.userName}>{user.name}</Text>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: roleInfo.badgeBg,
                      borderColor: roleInfo.badgeBorder,
                    },
                  ]}
                >
                  <Shield size={12} color={roleInfo.badgeTextColor} strokeWidth={2.4} />
                  <Text
                    style={[
                      styles.roleText,
                      { color: roleInfo.badgeTextColor },
                    ]}
                  >
                    {roleInfo.label}
                  </Text>
                </View>
              </View>

              {/* Info Rows */}
              <View style={styles.infoList}>
                {/* Email */}
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={handleEmail}
                  activeOpacity={0.7}
                >
                  <View style={styles.infoIconBox}>
                    <Mail size={16} color="#64748B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user.email}</Text>
                  </View>
                </TouchableOpacity>

                {/* Phone */}
                {user.phone ? (
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={handleCall}
                    activeOpacity={0.7}
                  >
                    <View style={styles.infoIconBox}>
                      <Phone size={16} color="#64748B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>Mobile Number</Text>
                      <Text style={styles.infoValue}>{user.phone}</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {/* Status */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    {isActive ? (
                      <UserCheck size={16} color="#16A34A" />
                    ) : (
                      <UserX size={16} color="#DC2626" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        { color: isActive ? '#16A34A' : '#DC2626', fontWeight: '700' },
                      ]}
                    >
                      {isActive ? 'Active Account' : 'Inactive / Suspended'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                {onResetPassword && (
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={() => onResetPassword(user)}
                    activeOpacity={0.8}
                  >
                    <KeyRound size={15} color="#475569" />
                    <Text style={styles.resetBtnText}>Reset Password</Text>
                  </TouchableOpacity>
                )}

                {onToggleStatus && (
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      isActive ? styles.deactivateBtn : styles.activateBtn,
                    ]}
                    onPress={() => onToggleStatus(user)}
                    activeOpacity={0.8}
                  >
                    {isActive ? (
                      <UserX size={15} color="#DC2626" />
                    ) : (
                      <UserCheck size={15} color="#16A34A" />
                    )}
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: isActive ? '#DC2626' : '#16A34A' },
                      ]}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  deactivateBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  activateBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
