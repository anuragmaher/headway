/**
 * Responsive utilities for consistent breakpoints
 */

import { useTheme, useMediaQuery } from '@mui/material';
import { Breakpoint } from '@mui/material/styles';

export function useResponsive() {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isLarge = useMediaQuery(theme.breakpoints.up('lg'));
  const isXLarge = useMediaQuery(theme.breakpoints.up('xl'));

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLarge,
    isXLarge,
    // Compound checks
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrDesktop: isTablet || isDesktop,
  };
}

export function useBreakpoint(breakpoint: Breakpoint, direction: 'up' | 'down' | 'only' = 'up') {
  const theme = useTheme();
  
  const query = direction === 'up' 
    ? theme.breakpoints.up(breakpoint)
    : direction === 'down'
    ? theme.breakpoints.down(breakpoint)
    : theme.breakpoints.only(breakpoint);

  return useMediaQuery(query);
}

// Responsive values helper
export function getResponsiveValue<T>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  },
  defaultValue: T
): T {
  const { isMobile, isTablet, isDesktop, isLarge, isXLarge } = useResponsive();

  if (isXLarge && values.xl !== undefined) return values.xl;
  if (isLarge && values.lg !== undefined) return values.lg;
  if (isDesktop && values.md !== undefined) return values.md;
  if (isTablet && values.sm !== undefined) return values.sm;
  if (isMobile && values.xs !== undefined) return values.xs;

  return defaultValue;
}