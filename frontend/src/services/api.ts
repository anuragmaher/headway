import axios from 'axios';
import { useAuthStore } from '../features/auth/store/auth-store';

// Get API base URL from environment, removing trailing slash
const envApiUrl = import.meta.env.VITE_API_URL;
const API_BASE_URL = envApiUrl
  ? envApiUrl.replace(/\/$/, '') // Remove trailing slash
  : (import.meta.env.PROD ? '' : 'http://localhost:8056');

// Force rebuild for env var change

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(null);
    }
  });

  failedQueue = [];
};

// Add auth token to requests
api.interceptors.request.use((config) => {
  // Get token from Zustand store first, fallback to localStorage for hydration
  try {
    const authStore = useAuthStore.getState();
    const token = authStore.tokens?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }
  } catch (error) {
    console.debug('Zustand store not ready, falling back to localStorage');
  }

  // Fallback: Get from localStorage if store is not ready
  const authData = localStorage.getItem('headway-auth');
  if (authData) {
    try {
      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to parse auth data:', error);
    }
  }
  return config;
});

// Handle auth errors with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token from Zustand store
        const authStore = useAuthStore.getState();
        const refreshToken = authStore.tokens?.refresh_token;

        if (!refreshToken) {
          throw new Error('No refresh token found');
        }

        // Attempt to refresh token
        const refreshResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken
        });

        const newTokens = refreshResponse.data;

        // Update tokens in Zustand store (which persists to localStorage automatically)
        useAuthStore.setState({
          tokens: newTokens
        });

        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;

        processQueue(null);
        isRefreshing = false;

        // Retry the original request
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;

        // If refresh fails, logout user
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;