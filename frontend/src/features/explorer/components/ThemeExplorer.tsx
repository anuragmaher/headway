/**
 * ThemeExplorer - Main container for the three-column explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 *
 * Structure: Themes -> SubThemes -> CustomerAsks -> Mentions (slide-in panel)
 */
import React, { useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert, AlertTitle, useTheme, useMediaQuery, Slide, Typography, Fade } from '@mui/material';
import { ThemesColumn } from './ThemesColumn';
import { SubThemesColumn } from './SubThemesColumn';
import { CustomerAsksColumn } from './CustomerAsksColumn';
import { MentionsPanel } from './MentionsPanel';
import { MobileNavigationHeader } from './MobileNavigationHeader';
import { MobileMentionsDrawer } from './MobileMentionsDrawer';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPanelOpen = useIsMentionsPanelOpen();
  const {
    isInitializing,
    isInitialized,
    themesError,
    initialize,
    clearThemesError,
    getWorkspaceId,
    // Additional loading states
    isLoadingThemes,
    themes,
    // Mobile-specific state
    setIsMobile,
    mobileActiveView,
    mobileNavigationStack,
    selectedFeedbackId,
    selectedCustomerAskId,
    // Actions
    selectFeedback,
    selectCustomerAsk,
    closeMentionsPanel,
  } = useExplorerStore();

  // Ref to prevent duplicate initialization calls
  const initCalledRef = useRef(false);

  // Initialize keyboard navigation
  useExplorerKeyboard();

  // Handle mobile breakpoint changes
  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

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

  // Loading state - show loading for both desktop and mobile during initialization
  const isLoading = isInitializing || (isInitialized && isLoadingThemes && themes.length === 0);
  
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 3,
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
          px: 2,
        }}
      >
        {isMobile && (
          // Mobile Navigation Header placeholder during loading
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            p: 2, 
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
          }}>
            <Typography variant="h6" sx={{ textAlign: 'center' }}>
              Themes
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', display: 'block' }}>
              Step 1 of 3: Select Theme
            </Typography>
          </Box>
        )}
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 2,
          mt: isMobile ? 8 : 0,
        }}>
          <CircularProgress 
            size={isMobile ? 48 : 32} 
            thickness={4}
            sx={{
              color: theme.palette.primary.main,
            }}
          />
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant={isMobile ? "h6" : "body1"} 
              color="textPrimary"
              sx={{ fontWeight: 500 }}
            >
              {isInitializing ? 'Setting up your workspace...' : 'Loading themes...'}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {isInitializing ? 'Please wait a moment' : 'Fetching your product themes'}
            </Typography>
          </Box>
        </Box>
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

  if (isMobile) {
    // Mobile Progressive Flow
    return (
      <Fade in timeout={300}>
        <Box
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        }}
      >
        {/* Mobile Navigation Header */}
        <MobileNavigationHeader />

        {/* Mobile Content - Only show current step */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {/* Step 1: Themes */}
          <Slide direction="right" in={mobileActiveView === 'themes'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <ThemesColumn width="100%" />
            </Box>
          </Slide>

          {/* Step 2: Sub-Themes */}
          <Slide direction="left" in={mobileActiveView === 'subThemes'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <SubThemesColumn width="100%" />
            </Box>
          </Slide>

          {/* Step 3: Customer Asks */}
          <Slide direction="left" in={mobileActiveView === 'customerAsks'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <CustomerAsksColumn isPanelOpen={false} />
            </Box>
          </Slide>

          {/* Step 4: Mentions (Full Screen) - Disabled in favor of drawer approach */}
          {/* 
          <Slide direction="left" in={mobileActiveView === 'mentions'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <MentionsPanel isMobileFullScreen />
            </Box>
          </Slide>
          */}
        </Box>

        {/* Mobile Mentions Drawer - Alternative approach */}
        <MobileMentionsDrawer
          open={!!selectedCustomerAskId}
          onClose={() => closeMentionsPanel()}
        />

        {/* Dialogs */}
        <AddThemeDialog />
        <AddSubThemeDialog />
        <EditThemeDialog />
        <EditSubThemeDialog />
        <DeleteConfirmDialog />
        <MergeSubThemeDialog />
        </Box>
      </Fade>
    );
  }

  // Desktop Three-Column Layout (existing)
  return (
    <Fade in timeout={300}>
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
    </Fade>
  );
};

export default ThemeExplorer;
