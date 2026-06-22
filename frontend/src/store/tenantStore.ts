import { create } from 'zustand';
import api from '../services/api';

export interface TenantDetails {
  id: string;
  yardName: string;
  address: string;
  logo: string | null;
  status: string;
  planName: string;
  storageLimit: number;
  email: string;
}

interface TenantState {
  resolvedTenant: TenantDetails | null;
  isRoot: boolean;
  loading: boolean;
  error: string | null;
  resolveTenant: (host: string) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  resolvedTenant: null,
  isRoot: true,
  loading: false,
  error: null,
  resolveTenant: async (host) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/tenants/resolve/host?host=${host}`);
      if (res.data?.success) {
        if (res.data.isRoot) {
          set({ resolvedTenant: null, isRoot: true, loading: false });
        } else {
          set({ resolvedTenant: res.data.data, isRoot: false, loading: false });
        }
      }
    } catch (err: any) {
      set({
        resolvedTenant: null,
        isRoot: false,
        error: err.response?.data?.message || 'Failed to resolve yard subdomain',
        loading: false,
      });
    }
  },
}));
