import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

const JWT_KEY = 'yms_jwt_token';
const REFRESH_KEY = 'yms_refresh_token';
const SERVER_URL_KEY = 'yms_server_url';
const USER_INFO_KEY = 'yms_user_info';

// Default development IPs
const DEFAULT_URL = 'https://rapid-yms.onrender.com';

export const getServerUrl = async (): Promise<string> => {
  const saved = await SecureStore.getItemAsync(SERVER_URL_KEY);
  return saved || DEFAULT_URL;
};

export const setServerUrl = async (url: string) => {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
};

export const getAuthToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(JWT_KEY);
};

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync(JWT_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync(JWT_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await AsyncStorage.removeItem(USER_INFO_KEY);
};

export interface UserSession {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  tenant: {
    id: string;
    yardName: string;
    status: string;
    address?: string;
    phone?: string;
  };
}

export const saveUserInfo = async (user: UserSession) => {
  await AsyncStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
};

export const getUserInfo = async (): Promise<UserSession | null> => {
  const data = await AsyncStorage.getItem(USER_INFO_KEY);
  return data ? JSON.parse(data) : null;
};

// Simple fetch-based request client
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

  console.log(`[API] Fetching ${options.method || 'GET'} to ${url}`);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized (expired access token), try silent refresh
  if (response.status === 401 && !isRetry && endpoint !== '/api/auth/refresh') {
    console.log('[API] Access Token expired (401). Attempting silent refresh...');
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          if (tokens && tokens.accessToken && tokens.refreshToken) {
            console.log('[API] Silent refresh succeeded. Saving new tokens...');
            await saveTokens(tokens.accessToken, tokens.refreshToken);

            // Retry request with new token
            return await apiRequest(endpoint, options, true);
          }
        } else {
          console.warn('[API] Refresh request failed with status:', refreshResponse.status);
        }
      } catch (err) {
        console.warn('[API] Silent refresh failed with error:', err);
      }
    }

    // Clear tokens and force logout if refresh token is also invalid/expired
    console.log('[API] Authentication failed. Clearing tokens and logging out...');
    await clearTokens();
    router.replace('/login');
    throw new Error('Session expired. Please log in again.');
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { error: text };
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
};

const PROFILE_IMAGE_KEY = 'yms_user_profile_image';

export const getProfileImage = async (): Promise<string | null> => {
  try {
    const val = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
    if (val === 'profile_pic.jpg') {
      const fileUri = `${FileSystem.documentDirectory}profile_pic.jpg`;
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) {
        return fileUri;
      }
    } else if (val && val.startsWith('http')) {
      return val;
    }
  } catch (e) {
    console.warn('[ProfileImage] Failed to read cached image:', e);
  }
  return null;
};

export const setProfileImage = async (uri: string) => {
  try {
    const targetUri = `${FileSystem.documentDirectory}profile_pic.jpg`;
    if (uri) {
      if (uri.startsWith('file://')) {
        // Copy temporary image file to persistent document directory
        await FileSystem.copyAsync({
          from: uri,
          to: targetUri,
        });
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, 'profile_pic.jpg');
      } else {
        // External Web URI
        await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
      }
    } else {
      // Clear key and delete file
      await AsyncStorage.removeItem(PROFILE_IMAGE_KEY);
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
    }
  } catch (e) {
    console.error('[ProfileImage] Failed to save/clear profile image:', e);
  }
};

const SESSION_DATE_KEY = 'yms_last_session_date';

export const saveSessionDate = async () => {
  const today = new Date().toISOString().split('T')[0]; // e.g. "2026-06-20"
  await AsyncStorage.setItem(SESSION_DATE_KEY, today);
};

export const checkMidnightExpiry = async (): Promise<boolean> => {
  const token = await SecureStore.getItemAsync(JWT_KEY);
  if (!token) return false;

  const savedDate = await AsyncStorage.getItem(SESSION_DATE_KEY);
  const today = new Date().toISOString().split('T')[0];

  if (savedDate && savedDate !== today) {
    // Midnight crossed! Clear tokens and expire session
    await clearTokens();
    await AsyncStorage.removeItem(SESSION_DATE_KEY);
    return true;
  }

  if (!savedDate) {
    await saveSessionDate();
  }

  return false;
};

