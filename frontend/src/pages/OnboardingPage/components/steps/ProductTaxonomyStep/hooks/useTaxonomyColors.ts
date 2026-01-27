/**
 * Hook for theme-aware taxonomy colors
 * Provides colors that adapt to light/dark mode
 */

import { useTheme } from '@mui/material/styles';

export function useTaxonomyColors() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return {
    purple: {
      main: '#7C3AED',
      light: isDark ? 'rgba(124, 58, 237, 0.15)' : '#EDE9FE',
      border: 'rgba(124, 58, 237, 0.3)',
      hover: '#6D28D9',
    },
    text: {
      primary: theme.palette.text.primary,
      secondary: theme.palette.text.secondary,
      muted: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8',
    },
    border: {
      light: theme.palette.divider,
      default: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
    },
    background: {
      card: theme.palette.background.paper,
      subtle: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
      hover: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
      input: theme.palette.background.paper,
    },
    action: {
      delete: '#ef4444',
      deleteHover: 'rgba(239, 68, 68, 0.08)',
    },
  };
}

export type TaxonomyColors = ReturnType<typeof useTaxonomyColors>;
