import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach authorization token
api.interceptors.request.use(
  (config) => {
    const authData = localStorage.getItem('yms_auth');
    if (authData) {
      const { accessToken } = JSON.parse(authData);
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration or refresh tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const authData = localStorage.getItem('yms_auth');
        if (authData) {
          const { refreshToken } = JSON.parse(authData);
          if (refreshToken) {
            const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
            if (res.data?.success) {
              const updatedAuth = {
                ...JSON.parse(authData),
                accessToken: res.data.accessToken,
                refreshToken: res.data.refreshToken,
              };
              localStorage.setItem('yms_auth', JSON.stringify(updatedAuth));
              originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
              return api(originalRequest);
            }
          }
        }
      } catch (err) {
        localStorage.removeItem('yms_auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
