/**
 * ThemeExplorer - Main container for the three-column explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 *
 * Structure: Themes -> SubThemes -> CustomerAsks -> Mentions (slide-in panel)
 */
import React, { useEffect, useRef } from 'react';
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
import { useExplorerStore, useIsMentionsPanelOpen } from '../store';
import { useExplorerKeyboard } from '../hooks/useExplorerKeyboard';

interface ThemeExplorerProps {
  className?: string;
}

export const ThemeExplorer: React.FC<ThemeExplorerProps> = ({ className }) => {
  const theme = useTheme();
  const isPanelOpen = useIsMentionsPanelOpen();
  const {
    isInitializing,
    isInitialized,
    themesError,
    initialize,
    clearThemesError,
    getWorkspaceId,
  } = useExplorerStore();

  // Ref to prevent duplicate initialization calls
  const initCalledRef = useRef(false);

  // Initialize keyboard navigation
  useExplorerKeyboard();

  // Initialize on mount - fetch themes if we have a workspace
  // Uses ref to ensure we only call initialize() ONCE per mount
  useEffect(() => {
    // Skip if already called or already initialized/initializing
    if (initCalledRef.current || isInitialized || isInitializing) {
      return;
    }

    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      return;
    }

    // Mark as called immediately to prevent race conditions
    initCalledRef.current = true;
    console.log('[ThemeExplorer] Initializing (one-time call)');
    initialize();
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

      {/* Right Section - CustomerAsks + Mentions Panel (split-screen) */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* CustomerAsks Column - shrinks when panel is open */}
        <CustomerAsksColumn isPanelOpen={isPanelOpen} />

        {/* Slide-in Panel - Mentions */}
        <MentionsPanel />
      </Box>

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
