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
          // This will be implemented when we create the API client
          // For now, we'll simulate the API call
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            throw new Error('Login failed');
          }

          const tokens: AuthTokens = await response.json();

          // Get user info
          const userResponse = await fetch('/api/v1/auth/me', {
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

          const user: User = await response.json();

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
          const response = await fetch('/api/v1/auth/refresh', {
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
  setUser: state.setUser,
  updateUserProfile: state.updateUserProfile,
}));