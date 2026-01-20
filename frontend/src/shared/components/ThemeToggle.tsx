/**
 * Theme toggle component for switching between light and dark modes
 * Modern pill-style toggle with smooth animation
 */

import { Box, Tooltip, alpha, useTheme } from '@mui/material';
import { LightMode, DarkMode } from '@mui/icons-material';
import { useThemeMode, useThemeActions } from '@/shared/store/theme-store';

interface ThemeToggleProps {
  size?: 'small' | 'medium';
  showTooltip?: boolean;
}

export function ThemeToggle({
  size = 'small',
  showTooltip = true
}: ThemeToggleProps): JSX.Element {
  const mode = useThemeMode();
  const { toggleTheme } = useThemeActions();
  const theme = useTheme();
  const isDark = mode === 'dark';

  const handleToggle = () => {
    toggleTheme();
  };

  const tooltipText = isDark ? 'Light mode' : 'Dark mode';

  const dimensions = size === 'small'
    ? { width: 52, height: 26, iconSize: 14, thumbSize: 20 }
    : { width: 60, height: 30, iconSize: 16, thumbSize: 24 };

  const toggle = (
    <Box
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      aria-label={tooltipText}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      sx={{
        width: dimensions.width,
        height: dimensions.height,
        borderRadius: dimensions.height / 2,
        bgcolor: isDark
          ? alpha(theme.palette.primary.main, 0.2)
          : alpha('#000', 0.08),
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 0.5,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: `1px solid ${isDark ? alpha(theme.palette.primary.main, 0.3) : alpha('#000', 0.1)}`,
        '&:hover': {
          bgcolor: isDark
            ? alpha(theme.palette.primary.main, 0.3)
            : alpha('#000', 0.12),
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* Sun icon */}
      <LightMode
        sx={{
          fontSize: dimensions.iconSize,
          color: isDark ? alpha('#fff', 0.4) : '#f59e0b',
          transition: 'color 0.3s ease',
          zIndex: 1,
          ml: 0.25,
        }}
      />

      {/* Moon icon */}
      <DarkMode
        sx={{
          fontSize: dimensions.iconSize,
          color: isDark ? theme.palette.primary.light : alpha('#000', 0.3),
          transition: 'color 0.3s ease',
          zIndex: 1,
          mr: 0.25,
        }}
      />

      {/* Sliding thumb */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: isDark ? `calc(100% - ${dimensions.thumbSize + 3}px)` : '3px',
          transform: 'translateY(-50%)',
          width: dimensions.thumbSize,
          height: dimensions.thumbSize,
          borderRadius: '50%',
          bgcolor: isDark ? theme.palette.primary.main : '#fff',
          boxShadow: isDark
            ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.4)}`
            : '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </Box>
  );

  if (!showTooltip) {
    return toggle;
  }

  return (
    <Tooltip title={tooltipText} placement="bottom" arrow>
      {toggle}
    </Tooltip>
  );
}