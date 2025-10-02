/**
 * Theme toggle component for switching between light and dark modes
 */


import { IconButton, Tooltip } from '@mui/material';
import { LightMode, DarkMode } from '@mui/icons-material';
import { useThemeMode, useThemeActions } from '@/shared/store/theme-store';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

export function ThemeToggle({ 
  size = 'medium', 
  showTooltip = true 
}: ThemeToggleProps): JSX.Element {
  const mode = useThemeMode();
  const { toggleTheme } = useThemeActions();

  const handleToggle = () => {
    toggleTheme();
  };

  const icon = mode === 'light' ? <DarkMode /> : <LightMode />;
  const tooltipText = mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  const button = (
    <IconButton 
      onClick={handleToggle}
      size={size}
      color="inherit"
      aria-label={tooltipText}
    >
      {icon}
    </IconButton>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <Tooltip title={tooltipText} placement="bottom">
      {button}
    </Tooltip>
  );
}