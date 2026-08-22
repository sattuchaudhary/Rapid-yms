export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'EXECUTIVE'
  | 'GUARD';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface YardUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  address?: string;
  emergencyContact?: string;
  dob?: string;
  permissionLevel?: 'FULL_ACCESS' | 'OPERATIONAL' | 'VIEW_ONLY';
  joiningDate?: string;
  photoUri?: string;
  docType?: string;
  docFrontUri?: string;
  docBackUri?: string;
}

export interface RoleMeta {
  label: string;
  badgeBg: string;
  badgeTextColor: string;
  badgeBorder: string;
  avatarBg: string;
  avatarTextColor: string;
  desc: string;
  permissions: string[];
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  TENANT_ADMIN: {
    label: 'Tenant Admin',
    badgeBg: '#F5F3FF',
    badgeTextColor: '#7C3AED',
    badgeBorder: '#DDD6FE',
    avatarBg: '#EDE9FE',
    avatarTextColor: '#6D28D9',
    desc: 'Complete administrative authority over yard operations, staff, & billing',
    permissions: [
      'Full Yard Management',
      'Staff Creation & Permission Assignment',
      'Bank & Rate Matrix Control',
      'Financial & Turnover Reports',
    ],
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    badgeBg: '#FEF2F2',
    badgeTextColor: '#DC2626',
    badgeBorder: '#FECACA',
    avatarBg: '#FEE2E2',
    avatarTextColor: '#B91C1C',
    desc: 'Platform-wide administrative control',
    permissions: ['Platform Administration', 'Tenant Management', 'Global Configurations'],
  },
  MANAGER: {
    label: 'Yard Manager',
    badgeBg: '#EEF2FF',
    badgeTextColor: '#4F46E5',
    badgeBorder: '#C7D2FE',
    avatarBg: '#E0E7FF',
    avatarTextColor: '#4338CA',
    desc: 'Oversees day-to-day yard inventory, space allocation, & staff approvals',
    permissions: [
      'Vehicle Inward / Outward Approvals',
      'Staff Shift Supervision',
      'Space & Bay Allocation',
      'Operational Rate Overrides',
    ],
  },
  SUPERVISOR: {
    label: 'Supervisor',
    badgeBg: '#FFFBEB',
    badgeTextColor: '#D97706',
    badgeBorder: '#FDE68A',
    avatarBg: '#FEF3C7',
    avatarTextColor: '#B45309',
    desc: 'Manages yard bay positioning, inspections, & shift logs',
    permissions: [
      'Vehicle Physical Condition Check',
      'Kachha to Pakka Conversion',
      'Key & Document Tagging',
      'Daily Yard Audit',
    ],
  },
  EXECUTIVE: {
    label: 'Executive',
    badgeBg: '#EFF6FF',
    badgeTextColor: '#0284C7',
    badgeBorder: '#BAE6FD',
    avatarBg: '#E0F2FE',
    avatarTextColor: '#0369A1',
    desc: 'Handles customer desk, billing computation, & release paperwork',
    permissions: [
      'Gate Pass Verification',
      'Parking Charges Calculation',
      'Release Order Entry',
      'Customer Support',
    ],
  },
  GUARD: {
    label: 'Gate Guard',
    badgeBg: '#F0FDF4',
    badgeTextColor: '#16A34A',
    badgeBorder: '#BBF7D0',
    avatarBg: '#DCFCE7',
    avatarTextColor: '#15803D',
    desc: 'Controls physical gate barrier entry, QR scans, & outward validation',
    permissions: [
      'Gate Inward QR / Number Plate Scan',
      'Physical Vehicle Entry Verification',
      'Exit Gate Pass Inspection',
      'Visitor / Driver Log',
    ],
  },
};
