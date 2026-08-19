export type SuperAdminRole = 'SUPER_ADMIN';

export type TenantRole =
  | 'ADMIN'
  | 'SUB_ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'EXECUTIVE'
  | 'GUARD';

export type UserRole = SuperAdminRole | TenantRole;

export interface UserSession {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  tenantId?: string | null;
  tenant?: {
    id: string;
    yardName: string;
    status: string;
  };
}
