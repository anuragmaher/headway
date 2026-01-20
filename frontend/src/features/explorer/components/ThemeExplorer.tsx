/**
 * ThemeExplorer - Main container for the three-column explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 */
import React, { useEffect } from 'react';
import { Box, CircularProgress, Alert, AlertTitle, useTheme } from '@mui/material';
import { ThemesColumn } from './ThemesColumn';
import { SubThemesColumn } from './SubThemesColumn';
import { FeedbackColumn } from './FeedbackColumn';
import { FeedbackDetail } from './FeedbackColumn/FeedbackDetail';
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

  // Initialize on mount - always fetch themes if we have a workspace
  // This handles the case where the component mounts after workspace_id is recovered
  useEffect(() => {
    const workspaceId = getWorkspaceId();

    // If we have a workspace but no themes and not currently loading, initialize
    if (workspaceId && !isInitializing) {
      if (!isInitialized || themes.length === 0) {
        // Reset first to clear stale state, then initialize
        if (isInitialized && themes.length === 0) {
          reset();
        }
        initialize();
      }
    }
  }, [isInitialized, isInitializing, themes.length, initialize, reset, getWorkspaceId]);

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
      }}
    >
      {/* Left Column - Themes */}
      <ThemesColumn width={220} />

      {/* Middle Column - Features */}
      <SubThemesColumn width={280} />

      {/* Right Column - Messages */}
      <FeedbackColumn minWidth={400} />

      {/* Detail Drawer */}
      <FeedbackDetail width={480} />

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
