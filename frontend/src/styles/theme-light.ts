/**
 * Light theme configuration for Material UI
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { COLORS, TYPOGRAPHY, COMPONENT_OVERRIDES } from '@/lib/constants/theme.constants';

export const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: COLORS.primary[700],
      light: COLORS.primary[400],
      dark: COLORS.primary[800],
      contrastText: '#ffffff',
    },
    secondary: {
      main: COLORS.secondary[500],
      light: COLORS.secondary[300],
      dark: COLORS.secondary[700],
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: COLORS.grey[900],
      secondary: COLORS.grey[600],
      disabled: COLORS.grey[400],
    },
    divider: COLORS.grey[200],
    success: {
      main: COLORS.success.main,
      light: COLORS.success.light,
      dark: COLORS.success.dark,
    },
    warning: {
      main: COLORS.warning.main,
      light: COLORS.warning.light,
      dark: COLORS.warning.dark,
    },
    error: {
      main: COLORS.error.main,
      light: COLORS.error.light,
      dark: COLORS.error.dark,
    },
    info: {
      main: COLORS.info.main,
      light: COLORS.info.light,
      dark: COLORS.info.dark,
    },
    grey: COLORS.grey,
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSize,
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
      color: COLORS.grey[900],
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
      color: COLORS.grey[900],
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.4,
      color: COLORS.grey[900],
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
      color: COLORS.grey[900],
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.5,
      color: COLORS.grey[900],
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.5,
      color: COLORS.grey[900],
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: COLORS.grey[700],
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: COLORS.grey[600],
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    ...COMPONENT_OVERRIDES,
    MuiCssBaseline: {
      styleOverrides: {
        ...COMPONENT_OVERRIDES.MuiCssBaseline.styleOverrides,
        body: {
          ...COMPONENT_OVERRIDES.MuiCssBaseline.styleOverrides.body,
          '&::-webkit-scrollbar-thumb': {
            ...COMPONENT_OVERRIDES.MuiCssBaseline.styleOverrides.body['&::-webkit-scrollbar-thumb'],
            backgroundColor: COLORS.grey[300],
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: COLORS.grey[400],
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: COLORS.grey[900],
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...COMPONENT_OVERRIDES.MuiCard.styleOverrides.root,
          backgroundColor: '#ffffff',
          border: `1px solid ${COLORS.grey[200]}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          ...COMPONENT_OVERRIDES.MuiPaper.styleOverrides.root,
          backgroundColor: '#ffffff',
        },
      },
    },
  },
};

export const lightTheme = createTheme(lightThemeOptions);