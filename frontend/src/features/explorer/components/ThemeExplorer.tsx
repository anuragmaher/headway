/**
 * ThemeExplorer - Main container for the three-column explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 *
 * Structure: Themes -> SubThemes -> CustomerAsks -> Mentions (slide-in panel)
 */
import React, { useEffect } from 'react';
import { Box, CircularProgress, Alert, AlertTitle, useTheme } from '@mui/material';
import { ThemesColumn } from './ThemesColumn';
import { SubThemesColumn } from './SubThemesColumn';
import { CustomerAsksColumn } from './CustomerAsksColumn';
import { MentionsPanel } from './MentionsPanel';
import { AddThemeDialog } from './dialogs/AddThemeDialog';
import { AddSubThemeDialog } from './dialogs/AddSubThemeDialog';
import { EditThemeDialog } from './dialogs/EditThemeDialog';
import { EditSubThemeDialog } from './dialogs/EditSubThemeDialog';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { MergeSubThemeDialog } from './dialogs/MergeSubThemeDialog';
import { useExplorerStore } from '../store';
import { useExplorerKeyboard } from '../hooks/useExplorerKeyboard';

interface ThemeExplorerProps {
  className?: string;
}

export const ThemeExplorer: React.FC<ThemeExplorerProps> = ({ className }) => {
  const theme = useTheme();
  const {
    isInitializing,
    isInitialized,
    themes,
    themesError,
    initialize,
    reset,
    clearThemesError,
    getWorkspaceId,
  } = useExplorerStore();

  // Initialize keyboard navigation
  useExplorerKeyboard();

  // Initialize on mount - fetch themes if we have a workspace and haven't initialized yet
  // Only runs once per mount cycle to prevent infinite loops on API errors
  useEffect(() => {
    const workspaceId = getWorkspaceId();

    // If we have a workspace and not currently loading/initialized, initialize
    if (workspaceId && !isInitializing && !isInitialized) {
      initialize();
    }
  }, [isInitialized, isInitializing, initialize, getWorkspaceId]);

  // Loading state
  if (isInitializing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  // Error state
  if (themesError) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
          p: 4,
        }}
      >
        <Alert
          severity="error"
          onClose={clearThemesError}
          sx={{ maxWidth: 400, borderRadius: 2 }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Failed to load themes</AlertTitle>
          {themesError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        position: 'relative',
      }}
    >
      {/* Left Column - Themes */}
      <ThemesColumn width={220} />

      {/* Middle Column - SubThemes */}
      <SubThemesColumn width={280} />

      {/* Right Column - CustomerAsks */}
      <CustomerAsksColumn minWidth={400} />

      {/* Slide-in Panel - Mentions */}
      <MentionsPanel width={420} />

      {/* Dialogs */}
      <AddThemeDialog />
      <AddSubThemeDialog />
      <EditThemeDialog />
      <EditSubThemeDialog />
      <DeleteConfirmDialog />
      <MergeSubThemeDialog />
    </Box>
  );
};

export default ThemeExplorer;
