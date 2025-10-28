/**
 * Authentication store using Zustand
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { AuthState, AuthActions, LoginRequest, GoogleLoginRequest, RegisterRequest, User, AuthTokens } from '../types/auth.types';
import { API_BASE_URL } from '../../../config/api.config';

const AUTH_STORAGE_KEY = 'headway-auth';

interface AuthStore extends AuthState, AuthActions {
  refreshTimerId?: NodeJS.Timeout;
}

let refreshTimerId: NodeJS.Timeout | undefined = undefined;

export const useAuthStore = create<AuthStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });

        try {
          // Check for demo credentials
          if (credentials.email === 'demo@headwayhq.com' && credentials.password === 'demo123') {
            // Use demo login instead of API call
            await get().demoLogin();
            return;
          }

          // Send form data to match backend expectations
          const formData = new FormData();
          formData.append('username', credentials.email);
          formData.append('password', credentials.password);

          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Login failed');
          }

          const tokens: AuthTokens = await response.json();

          // Get user info
          const userResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });

          if (!userResponse.ok) {
            throw new Error('Failed to get user info');
          }

          const user: User = await userResponse.json();

          set({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start automatic token refresh
          get().startTokenRefreshTimer();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      googleLogin: async (googleRequest: GoogleLoginRequest) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login-google`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleRequest),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Google login failed');
          }

          const tokens: AuthTokens = await response.json();

          // Get user info
          const userResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });

          if (!userResponse.ok) {
            throw new Error('Failed to get user info');
          }

          const user: User = await userResponse.json();

          set({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start automatic token refresh
          get().startTokenRefreshTimer();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Google login failed',
          });
          throw error;
        }
      },

      register: async (userData: RegisterRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          });

          if (!response.ok) {
            throw new Error('Registration failed');
          }

          await response.json();

          // After registration, automatically log in
          await get().login({
            email: userData.email,
            password: userData.password,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      logout: () => {
        // Stop automatic token refresh
        get().stopTokenRefreshTimer();

        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      refreshToken: async (retryCount = 0) => {
        const { tokens } = get();

        if (!tokens?.refresh_token) {
          console.warn('No refresh token available, skipping refresh');
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              refresh_token: tokens.refresh_token,
            }),
          });

          if (!response.ok) {
            // Only logout on 401/403, not on network errors
            if (response.status === 401 || response.status === 403) {
              throw new Error('Token refresh failed - invalid refresh token');
            }
            throw new Error(`Token refresh failed with status: ${response.status}`);
          }

          const newTokens: AuthTokens = await response.json();

          set({
            tokens: newTokens,
          });
          
          console.log('Token refresh successful');
        } catch (error) {
          console.error('Token refresh failed:', error);
          
          // Retry logic for network errors
          if (retryCount < 3 && error instanceof Error && !error.message.includes('invalid refresh token')) {
            console.log(`Retrying token refresh (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              get().refreshToken(retryCount + 1);
            }, 5000 * (retryCount + 1)); // Exponential backoff
            return;
          }
          
          // Only logout if it's an authentication error after all retries
          if (error instanceof Error && error.message.includes('invalid refresh token')) {
            console.log('Refresh token invalid, logging out');
            get().logout();
          } else {
            console.log('Token refresh failed but continuing with existing token');
          }
        }
      },

      clearError: () => {
        set({ error: null });
      },

      demoLogin: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Create demo user data
          const demoUser: User = {
            id: 'demo-user-1',
            email: 'demo@headwayhq.com',
            first_name: 'Demo',
            last_name: 'User',
            company_name: 'HeadwayHQ Demo',
            company_id: 'demo-company-1',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const demoTokens: AuthTokens = {
            access_token: 'demo-access-token',
            refresh_token: 'demo-refresh-token',
            token_type: 'bearer',
          };

          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));

          set({
            user: demoUser,
            tokens: demoTokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start automatic token refresh
          get().startTokenRefreshTimer();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Demo login failed',
          });
          throw error;
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      updateUserProfile: async (updates: Partial<User>) => {
        const { tokens, user } = get();

        if (!tokens?.access_token || !user) {
          throw new Error('Not authenticated');
        }

        try {
          const response = await fetch('/api/v1/auth/me', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.access_token}`,
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            throw new Error('Failed to update profile');
          }

          const updatedUser: User = await response.json();

          set({
            user: updatedUser,
          });
        } catch (error) {
          throw error;
        }
      },

      startTokenRefreshTimer: () => {
        // Clear existing timer if any
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
        }

        // Set up automatic token refresh every 12 hours to prevent token expiration issues
        // This helps maintain session continuity during long periods of inactivity
        refreshTimerId = setInterval(async () => {
          const currentState = get();
          if (currentState.isAuthenticated && currentState.tokens?.refresh_token) {
            try {
              console.log('Proactive token refresh triggered');
              await currentState.refreshToken();
              console.log('Token refresh successful');
            } catch (error) {
              console.error('Automatic token refresh failed:', error);
              // If refresh fails, logout user to prevent 401 errors
              console.log('Logging out due to token refresh failure');
              currentState.logout();
            }
          }
        }, 12 * 60 * 60 * 1000); // 12 hours

        console.log('Token refresh timer started (12 hour interval)');
      },

      stopTokenRefreshTimer: () => {
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
          refreshTimerId = undefined;
          console.log('Token refresh timer stopped');
        }
      },
    })),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selector hooks for easier component usage
export const useAuth = () => useAuthStore();
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthActions = () => useAuthStore((state) => ({
  login: state.login,
  googleLogin: state.googleLogin,
  register: state.register,
  logout: state.logout,
  refreshToken: state.refreshToken,
  clearError: state.clearError,
  demoLogin: state.demoLogin,
  setUser: state.setUser,
  updateUserProfile: state.updateUserProfile,
  startTokenRefreshTimer: state.startTokenRefreshTimer,
  stopTokenRefreshTimer: state.stopTokenRefreshTimer,
}));

// Handle token refresh timer on app load and store rehydration
const handleAuthStateChange = (state: AuthStore) => {
  if (state.isAuthenticated && state.tokens?.refresh_token) {
    // Only start if not already started
    if (!refreshTimerId) {
      state.startTokenRefreshTimer();
    }
  } else {
    // Stop timer if user logged out
    state.stopTokenRefreshTimer();
  }
};

// Session recovery function
const attemptSessionRecovery = async () => {
  const state = useAuthStore.getState();
  if (state.isAuthenticated && state.tokens?.refresh_token) {
    try {
      console.log('Attempting session recovery...');
      await state.refreshToken();
      console.log('Session recovery successful');
    } catch (error) {
      console.log('Session recovery failed, but continuing with existing session');
    }
  }
};

// Start on initial load
const initialState = useAuthStore.getState();
if (initialState.isAuthenticated && initialState.tokens?.refresh_token) {
  initialState.startTokenRefreshTimer();
  // Attempt session recovery on app load
  attemptSessionRecovery();
}

// Listen for authentication changes (including store hydration from localStorage)
useAuthStore.subscribe(
  (state) => ({ isAuthenticated: state.isAuthenticated, tokens: state.tokens }),
  (current, previous) => {
    const state = useAuthStore.getState();
    if (current.isAuthenticated !== previous?.isAuthenticated ||
        current.tokens?.access_token !== previous?.tokens?.access_token) {
      handleAuthStateChange(state);
    }
  }
);