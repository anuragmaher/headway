/**
 * Hook for theme-aware onboarding colors
 * Provides colors that adapt to light/dark mode for the entire onboarding flow
 */

import { useTheme } from '@mui/material/styles';

export function useOnboardingColors() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return {
    // Primary brand colors
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      darker: '#1e40af',
      light: isDark ? 'rgba(37, 99, 235, 0.15)' : '#dbeafe',
      lighter: isDark ? 'rgba(37, 99, 235, 0.08)' : '#eff6ff',
      contrastText: '#ffffff',
    },

    // Success/green colors
    success: {
      main: '#22c55e',
      dark: '#166534',
      light: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
    },

    // Error/red colors
    error: {
      main: '#b91c1c',
      light: isDark ? 'rgba(185, 28, 28, 0.15)' : '#fef2f2',
      border: isDark ? 'rgba(254, 202, 202, 0.3)' : '#fecaca',
    },

    // Warning/amber colors
    warning: {
      main: '#92400e',
      light: isDark ? 'rgba(254, 243, 199, 0.15)' : '#fef3c7',
    },

    // Text colors
    text: {
      primary: theme.palette.text.primary,
      secondary: theme.palette.text.secondary,
      muted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#94a3b8',
      disabled: isDark ? 'rgba(255, 255, 255, 0.38)' : '#94a3b8',
    },

    // Background colors
    background: {
      page: isDark ? theme.palette.background.default : '#f1f5f9',
      paper: theme.palette.background.paper,
      subtle: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
      hover: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
      input: theme.palette.background.paper,
      sidebar: isDark ? theme.palette.background.paper : '#f8fafc',
      selected: isDark ? 'rgba(37, 99, 235, 0.15)' : '#f0f9ff',
      selectedHover: isDark ? 'rgba(37, 99, 235, 0.2)' : '#e0f2fe',
    },

    // Border colors
    border: {
      light: theme.palette.divider,
      default: isDark ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
      input: isDark ? 'rgba(255, 255, 255, 0.23)' : '#e2e8f0',
      focused: '#2563eb',
    },

    // Button colors
    button: {
      primary: {
        bg: '#1e293b',
        hover: '#0f172a',
        disabled: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
        disabledText: isDark ? 'rgba(255, 255, 255, 0.38)' : '#94a3b8',
      },
      secondary: {
        bg: 'transparent',
        hover: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        text: theme.palette.text.secondary,
      },
    },

    // Sidebar specific
    sidebar: {
      stepComplete: '#22c55e',
      stepActive: '#2563eb',
      stepInactive: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
      stepTextActive: '#2563eb',
      stepTextComplete: '#22c55e',
      stepTextInactive: theme.palette.text.secondary,
      substepActive: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
      logoGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      logoShadow: 'rgba(37, 99, 235, 0.25)',
    },

    // Data source specific colors (brand colors, keep consistent)
    sources: {
      gong: '#7C3AED',
      fathom: '#059669',
      gmail: '#EA4335',
      slack: '#4A154B',
    },

    // Chip colors
    chip: {
      selected: {
        bg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#dbeafe',
        text: isDark ? '#60a5fa' : '#1d4ed8',
      },
      success: {
        bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
        text: isDark ? '#4ade80' : '#166534',
      },
    },

    // Illustration colors (decorative - can stay bright)
    illustration: {
      doc1: isDark ? 'rgba(219, 234, 254, 0.2)' : '#dbeafe',
      doc1Border: isDark ? 'rgba(147, 197, 253, 0.3)' : '#93c5fd',
      doc2: isDark ? 'rgba(191, 219, 254, 0.2)' : '#bfdbfe',
      doc2Border: isDark ? 'rgba(96, 165, 250, 0.3)' : '#60a5fa',
      doc3: '#2563eb',
      docLines: 'rgba(255, 255, 255, 0.3)',
    },

    // Action colors (delete, etc.)
    action: {
      delete: '#ef4444',
      deleteHover: 'rgba(239, 68, 68, 0.08)',
    },

    // Link colors
    link: {
      default: '#2563eb',
      hover: '#1d4ed8',
    },

    // Shadow
    shadow: {
      card: isDark ? 'none' : 'rgba(0, 0, 0, 0.04)',
      hover: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
  };
}

export type OnboardingColors = ReturnType<typeof useOnboardingColors>;
