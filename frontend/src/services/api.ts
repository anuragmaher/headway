import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

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
  // Get token from Zustand auth store persistence
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
        // Get auth data from localStorage
        const authData = localStorage.getItem('headway-auth');
        if (!authData) {
          throw new Error('No auth data found');
        }

        const parsedAuth = JSON.parse(authData);
        const refreshToken = parsedAuth.state?.tokens?.refresh_token;

        if (!refreshToken) {
          throw new Error('No refresh token found');
        }

        // Attempt to refresh token
        const refreshResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken
        });

        const newTokens = refreshResponse.data;

        // Update tokens in localStorage
        const updatedAuth = {
          ...parsedAuth,
          state: {
            ...parsedAuth.state,
            tokens: newTokens
          }
        };
        localStorage.setItem('headway-auth', JSON.stringify(updatedAuth));

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
        localStorage.removeItem('headway-auth');
        window.location.href = '/auth/login';

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;