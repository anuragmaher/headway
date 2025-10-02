/**
 * Custom theme provider that wraps Material UI ThemeProvider
 */

import React, { useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useThemeStore } from '@/shared/store/theme-store';
import { lightTheme } from '@/styles/theme-light';
import { darkTheme } from '@/styles/theme-dark';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const { mode, initializeTheme } = useThemeStore();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Select theme based on current mode
  const theme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}