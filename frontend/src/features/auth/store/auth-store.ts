/**
 * Authentication store using Zustand
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { AuthState, AuthActions, LoginRequest, RegisterRequest, User, AuthTokens } from '../types/auth.types';

const AUTH_STORAGE_KEY = 'headway-auth';

interface AuthStore extends AuthState, AuthActions {}

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

          const response = await fetch('http://localhost:8000/api/v1/auth/login', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Login failed');
          }

          const tokens: AuthTokens = await response.json();

          // Get user info
          const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
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

      refreshToken: async () => {
        const { tokens } = get();

        if (!tokens?.refresh_token) {
          get().logout();
          return;
        }

        try {
          const response = await fetch('http://localhost:8000/api/v1/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              refresh_token: tokens.refresh_token,
            }),
          });

          if (!response.ok) {
            throw new Error('Token refresh failed');
          }

          const newTokens: AuthTokens = await response.json();

          set({
            tokens: newTokens,
          });
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
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
            onboarding_completed: true,
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
        const state = get();
        if ((state as any).refreshTimerId) {
          clearInterval((state as any).refreshTimerId);
        }

        // Set up automatic token refresh every 15 minutes
        const timerId = setInterval(async () => {
          const currentState = get();
          if (currentState.isAuthenticated && currentState.tokens?.refresh_token) {
            try {
              await currentState.refreshToken();
            } catch (error) {
              console.error('Automatic token refresh failed:', error);
            }
          }
        }, 15 * 60 * 1000); // 15 minutes

        // Store timer ID in state for cleanup
        (get() as any).refreshTimerId = timerId;
      },

      stopTokenRefreshTimer: () => {
        const state = get();
        if ((state as any).refreshTimerId) {
          clearInterval((state as any).refreshTimerId);
          delete (state as any).refreshTimerId;
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

// Start token refresh timer on app load if user is authenticated
const state = useAuthStore.getState();
if (state.isAuthenticated && state.tokens?.refresh_token) {
  state.startTokenRefreshTimer();
}