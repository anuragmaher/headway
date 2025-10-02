/**
 * Zustand store for theme management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ThemeState, ThemeMode } from '@/shared/types/theme.types';
import { THEME_STORAGE_KEY, DEFAULT_THEME_MODE } from '@/lib/constants/theme.constants';

// Helper function to get initial theme from localStorage
const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'light' || stored === 'dark')) {
      return stored as ThemeMode;
    }
  } catch (error) {
    console.warn('Error reading theme from localStorage:', error);
  }

  // Check system preference as fallback
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return DEFAULT_THEME_MODE;
};

// Helper function to save theme to localStorage
const saveThemeToStorage = (mode: ThemeMode): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('Error saving theme to localStorage:', error);
  }
};

export const useThemeStore = create<ThemeState>()(
  subscribeWithSelector((set, get) => ({
    mode: getInitialTheme(),

    setTheme: (mode: ThemeMode) => {
      set({ mode });
      saveThemeToStorage(mode);
    },

    toggleTheme: () => {
      const currentMode = get().mode;
      const newMode: ThemeMode = currentMode === 'light' ? 'dark' : 'light';
      get().setTheme(newMode);
    },

    initializeTheme: () => {
      const initialTheme = getInitialTheme();
      set({ mode: initialTheme });
      saveThemeToStorage(initialTheme);
    },
  }))
);

// Subscribe to system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    // Only auto-switch if user hasn't manually set a preference
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!storedTheme) {
      useThemeStore.getState().setTheme(e.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleSystemThemeChange);
}

// Selector hooks for easier component usage
export const useThemeMode = () => useThemeStore((state) => state.mode);
export const useThemeActions = () => useThemeStore((state) => ({
  setTheme: state.setTheme,
  toggleTheme: state.toggleTheme,
  initializeTheme: state.initializeTheme,
}));