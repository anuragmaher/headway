/**
 * Custom hook for theme operations with backend sync
 */

import { useEffect } from 'react';
import { useThemeStore } from '@/shared/store/theme-store';
import { ThemeMode } from '@/shared/types/theme.types';

interface UseThemeReturn {
  mode: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  syncWithUser: (userTheme: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const mode = useThemeStore((state) => state.mode);
  const setTheme = useThemeStore((state) => state.setTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const initializeTheme = useThemeStore((state) => state.initializeTheme);

  // Initialize theme on first load
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Sync theme preference with user profile
  const syncWithUser = (userTheme: ThemeMode) => {
    if (userTheme !== mode) {
      setTheme(userTheme);
    }
  };

  return {
    mode,
    isDark: mode === 'dark',
    isLight: mode === 'light',
    setTheme,
    toggleTheme,
    syncWithUser,
  };
}

// Hook for components that only need to read theme mode
export function useThemeMode(): ThemeMode {
  return useThemeStore((state) => state.mode);
}

// Hook for components that only need theme actions
export function useThemeActions() {
  return useThemeStore((state) => ({
    setTheme: state.setTheme,
    toggleTheme: state.toggleTheme,
    initializeTheme: state.initializeTheme,
  }));
}