import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { UserSession } from '../types/roles';

const JWT_KEY = 'rapid_yms_jwt_token';
const REFRESH_KEY = 'rapid_yms_refresh_token';
const BIOMETRIC_REFRESH_KEY = 'rapid_yms_biometric_refresh_token';
const SERVER_URL_KEY = 'rapid_yms_server_url';
const USER_INFO_KEY = 'rapid_yms_user_info';
const CACHED_EMAIL_KEY = 'rapid_yms_cached_email';
const OFFLINE_CREDS_KEY = 'rapid_yms_offline_creds';

export const DEFAULT_SERVER_URL = 'https://rapid-yms.onrender.com';

// In-memory memory fallback in case both native and storage throw in edge cases
const memoryStore = new Map<string, string>();

/**
 * Resilient cross-platform storage adapter.
 * Supports Web (localStorage), iOS/Android (SecureStore / AsyncStorage), and In-Memory fallback.
 */
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Web LocalStorage
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const item = window.localStorage.getItem(key);
          if (item !== null) return item;
        }
      } catch {
        // Fall through
      }
    }

    // 2. Mobile SecureStore
    if (Platform.OS !== 'web') {
      try {
        const available = await SecureStore.isAvailableAsync().catch(() => false);
        if (available) {
          const val = await SecureStore.getItemAsync(key).catch(() => null);
          if (val !== null && val !== undefined) return val;
        }
      } catch {
        // Fall through
      }
    }

    // 3. AsyncStorage
    try {
      const asyncVal = await AsyncStorage.getItem(key);
      if (asyncVal !== null) return asyncVal;
    } catch {
      // Fall through
    }

    // 4. Memory Fallback
    return memoryStore.get(key) || null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);

    // 1. Web LocalStorage
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Fall through
      }
    }

    // 2. Mobile SecureStore
    if (Platform.OS !== 'web') {
      try {
        const available = await SecureStore.isAvailableAsync().catch(() => false);
        if (available) {
          await SecureStore.setItemAsync(key, value).catch(() => null);
        }
      } catch {
        // Fall through
      }
    }

    // 3. AsyncStorage
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Handled silently by memoryStore
    }
  },

  deleteItem: async (key: string): Promise<void> => {
    memoryStore.delete(key);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Ignore
      }
    }

    if (Platform.OS !== 'web') {
      try {
        const available = await SecureStore.isAvailableAsync().catch(() => false);
        if (available) {
          await SecureStore.deleteItemAsync(key).catch(() => null);
        }
      } catch {
        // Ignore
      }
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

// Non-reversible secure credential hash generator for offline authentication
export const hashCredential = (email: string, pass: string): string => {
  const str = `${email.trim().toLowerCase()}:${pass}:rapid_yms_secure_offline_salt_2026`;
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const getServerUrl = async (): Promise<string> => {
  try {
    const saved = await safeStorage.getItem(SERVER_URL_KEY);
    return saved || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
};

export const setServerUrl = async (url: string) => {
  await safeStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
};

export const getAuthToken = async (): Promise<string | null> => {
  return await safeStorage.getItem(JWT_KEY);
};

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await safeStorage.setItem(JWT_KEY, accessToken);
  await safeStorage.setItem(REFRESH_KEY, refreshToken);
  if (refreshToken) {
    await safeStorage.setItem(BIOMETRIC_REFRESH_KEY, refreshToken);
  }
};

export const getBiometricRefreshToken = async (): Promise<string | null> => {
  return (await safeStorage.getItem(BIOMETRIC_REFRESH_KEY)) || (await safeStorage.getItem(REFRESH_KEY));
};

export const saveCachedEmail = async (email: string) => {
  await safeStorage.setItem(CACHED_EMAIL_KEY, email);
};

export const getCachedEmail = async (): Promise<string | null> => {
  return await safeStorage.getItem(CACHED_EMAIL_KEY);
};

export const saveOfflineCredentials = async (email: string, pass: string, session: UserSession) => {
  const hash = hashCredential(email, pass);
  await safeStorage.setItem(OFFLINE_CREDS_KEY, JSON.stringify({ hash, session }));
};

export const getOfflineCredentials = async (): Promise<{ hash: string; session: UserSession } | null> => {
  try {
    const data = await safeStorage.getItem(OFFLINE_CREDS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const clearTokens = async () => {
  await safeStorage.deleteItem(JWT_KEY);
  await safeStorage.deleteItem(REFRESH_KEY);
  // Keep BIOMETRIC_REFRESH_KEY and OFFLINE_CREDS_KEY so biometric login works after logout
  await safeStorage.deleteItem(USER_INFO_KEY);
};

export const clearBiometricSession = async () => {
  await safeStorage.deleteItem(BIOMETRIC_REFRESH_KEY);
  await safeStorage.deleteItem(OFFLINE_CREDS_KEY);
};

export const saveUserInfo = async (user: UserSession) => {
  await safeStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
};

export const getUserInfo = async (): Promise<UserSession | null> => {
  try {
    const data = await safeStorage.getItem(USER_INFO_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

let isRedirectingToLogin = false;

// Robust fetch-based API client wrapper
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<any> => {
  const baseUrl = await getServerUrl();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle Token Expiry & Silent Refresh
  if (response.status === 401 && !isRetry && endpoint !== '/api/auth/refresh') {
    const refreshToken = await safeStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          if (tokens?.accessToken && tokens?.refreshToken) {
            await saveTokens(tokens.accessToken, tokens.refreshToken);
            return await apiRequest(endpoint, options, true);
          }
        }
      } catch (err) {
        console.warn('[API] Refresh token attempt failed:', err);
      }
    }

    await clearTokens();
    if (!isRedirectingToLogin) {
      isRedirectingToLogin = true;
      setTimeout(() => { isRedirectingToLogin = false; }, 2000);
      router.replace('/login');
    }
    throw new Error('Session expired. Please log in again.');
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const preMatch = text.match(/<pre>(.*?)<\/pre>/s);
    const rawClean = preMatch ? preMatch[1].trim() : text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    data = { error: rawClean || `Server returned error status ${response.status}` };
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
};

// Vehicles API Client Service
export interface FetchVehicleParams {
  search?: string;
  vehicleType?: string;
  yardStatus?: string;
  shiftStatus?: string;
  shifting?: boolean;
  bankName?: string;
  repoAgency?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const getVehicles = async (params: FetchVehicleParams = {}): Promise<any> => {
  const queryParts: string[] = [];
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.vehicleType) queryParts.push(`vehicleType=${encodeURIComponent(params.vehicleType)}`);
  if (params.yardStatus) queryParts.push(`yardStatus=${encodeURIComponent(params.yardStatus)}`);
  if (params.shiftStatus) queryParts.push(`shiftStatus=${encodeURIComponent(params.shiftStatus)}`);
  if (params.shifting) queryParts.push(`shifting=true`);
  if (params.bankName) queryParts.push(`bankName=${encodeURIComponent(params.bankName)}`);
  if (params.repoAgency) queryParts.push(`repoAgency=${encodeURIComponent(params.repoAgency)}`);
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
  if (params.page) queryParts.push(`page=${params.page}`);
  if (params.limit) queryParts.push(`limit=${params.limit}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return await apiRequest(`/api/vehicles${queryString}`);
};

export const getVehicleSummary = async (params: { startDate?: string; endDate?: string } = {}): Promise<any> => {
  const queryParts: string[] = [];
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return await apiRequest(`/api/vehicles/summary${queryString}`);
};

export const getVehicleById = async (id: string): Promise<any> => {
  return await apiRequest(`/api/vehicles/${id}`);
};

export const updateVehicle = async (id: string, data: any): Promise<any> => {
  return await apiRequest(`/api/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const getDashboardStats = async (params: { startDate?: string; endDate?: string } = {}): Promise<any> => {
  const queryParts: string[] = [];
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return await apiRequest(`/api/reports/dashboard${queryString}`);
};

export const getVehicleParkingCalculation = async (
  vehicleId: string,
  params: {
    releasePersonType?: 'CUSTOMER' | 'BUYER';
    todayDate?: string;
    releaseOrderDate?: string;
  } = {}
): Promise<any> => {
  const queryParts: string[] = [];
  if (params.releasePersonType) queryParts.push(`releasePersonType=${encodeURIComponent(params.releasePersonType)}`);
  if (params.todayDate) queryParts.push(`todayDate=${encodeURIComponent(params.todayDate)}`);
  if (params.releaseOrderDate) queryParts.push(`releaseOrderDate=${encodeURIComponent(params.releaseOrderDate)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return await apiRequest(`/api/vehicles/${vehicleId}/parking-calculation${queryString}`);
};

export const directReleaseVehicle = async (vehicleId: string, data: any): Promise<any> => {
  return await apiRequest(`/api/releases/${vehicleId}/direct`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const uploadFileToStorage = async (
  fileUri: string,
  folder = 'releases',
  fileType = 'image/jpeg'
): Promise<string> => {
  try {
    const presignRes = await apiRequest(
      `/api/uploads/presigned-url?fileType=${encodeURIComponent(fileType)}&folder=${encodeURIComponent(folder)}&fileSize=250000`
    );

    if (presignRes?.success && presignRes?.data) {
      const { uploadUrl, publicUrl } = presignRes.data;

      if (!uploadUrl.includes('mock-s3-bucket')) {
        const blob = await fetch(fileUri).then((r) => r.blob());
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': fileType },
          body: blob,
        });

        if (!uploadRes.ok) {
          throw new Error('S3 direct upload failed');
        }
      }
      return publicUrl;
    }
    return fileUri;
  } catch (err) {
    console.warn('[uploadFileToStorage] upload error, falling back to uri:', err);
    return fileUri;
  }
};

export const analyzeRoDocument = async (
  vehicleId: string,
  payload: {
    fileUrl?: string;
    fileBase64?: string;
    mimeType?: string;
    fileName?: string;
    fileSizeBytes?: number;
  }
): Promise<any> => {
  return await apiRequest(`/api/releases/${vehicleId}/ro-document/analyze`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const saveRoManualOverride = async (
  vehicleId: string,
  payload: {
    documentId: string;
    fieldName: string;
    oldValue?: string;
    newValue: string;
    reason: string;
  }
): Promise<any> => {
  return await apiRequest(`/api/releases/${vehicleId}/ro-document/manual-edit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
