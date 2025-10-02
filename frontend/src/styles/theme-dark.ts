/**
 * Dark theme configuration for Material UI
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { COLORS, TYPOGRAPHY, COMPONENT_OVERRIDES } from '@/lib/constants/theme.constants';

// Dark theme color palette
const darkColors = {
  background: {
    default: '#0a0a0a',
    paper: '#1a1a1a',
    surface: '#2a2a2a',
  },
  text: {
    primary: '#ffffff',
    secondary: '#b3b3b3',
    disabled: '#666666',
  },
  divider: '#333333',
  border: '#404040',
};

export const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: COLORS.primary[400],
      light: COLORS.primary[300],
      dark: COLORS.primary[600],
      contrastText: '#000000',
    },
    secondary: {
      main: COLORS.secondary[400],
      light: COLORS.secondary[300],
      dark: COLORS.secondary[600],
      contrastText: '#000000',
    },
    background: darkColors.background,
    text: darkColors.text,
    divider: darkColors.divider,
    success: {
      main: COLORS.success.light,
      light: '#a5d6a7',
      dark: COLORS.success.main,
    },
    warning: {
      main: COLORS.warning.light,
      light: '#ffcc02',
      dark: COLORS.warning.main,
    },
    error: {
      main: COLORS.error.light,
      light: '#ef5350',
      dark: COLORS.error.main,
    },
    info: {
      main: COLORS.info.light,
      light: '#81d4fa',
      dark: COLORS.info.main,
    },
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSize,
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
      color: darkColors.text.primary,
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
      color: darkColors.text.primary,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.4,
      color: darkColors.text.primary,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
      color: darkColors.text.primary,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.5,
      color: darkColors.text.primary,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.5,
      color: darkColors.text.primary,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: darkColors.text.secondary,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: darkColors.text.secondary,
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
          backgroundColor: darkColors.background.default,
          color: darkColors.text.primary,
          '&::-webkit-scrollbar-thumb': {
            ...COMPONENT_OVERRIDES.MuiCssBaseline.styleOverrides.body['&::-webkit-scrollbar-thumb'],
            backgroundColor: '#555555',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#777777',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: darkColors.background.paper,
          color: darkColors.text.primary,
          boxShadow: '0 1px 3px rgba(255, 255, 255, 0.1)',
          borderBottom: `1px solid ${darkColors.divider}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...COMPONENT_OVERRIDES.MuiCard.styleOverrides.root,
          backgroundColor: darkColors.background.paper,
          border: `1px solid ${darkColors.divider}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          ...COMPONENT_OVERRIDES.MuiPaper.styleOverrides.root,
          backgroundColor: darkColors.background.paper,
          color: darkColors.text.primary,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: darkColors.divider,
            },
            '&:hover fieldset': {
              borderColor: darkColors.border,
            },
            '&.Mui-focused fieldset': {
              borderColor: COLORS.primary[400],
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          ...COMPONENT_OVERRIDES.MuiButton.styleOverrides.root,
        },
        outlined: {
          borderColor: darkColors.divider,
          color: darkColors.text.primary,
          '&:hover': {
            borderColor: darkColors.border,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: darkColors.text.secondary,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: darkColors.divider,
        },
      },
    },
  },
};

export const darkTheme = createTheme(darkThemeOptions);