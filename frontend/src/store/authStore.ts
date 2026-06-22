import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EXECUTIVE' | 'GUARD';
  tenant: {
    id: string;
    yardName: string;
    status: string;
  };
  requiresPasswordReset?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem(
      'yms_auth',
      JSON.stringify({ user, accessToken, refreshToken })
    );
    set({ user, accessToken, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('yms_auth');
    localStorage.removeItem('yms_active_tab');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
  initialize: () => {
    const authData = localStorage.getItem('yms_auth');
    if (authData) {
      try {
        const { user, accessToken } = JSON.parse(authData);
        if (user && accessToken) {
          set({ user, accessToken, isAuthenticated: true });
        }
      } catch (e) {
        localStorage.removeItem('yms_auth');
      }
    }
  },
}));
