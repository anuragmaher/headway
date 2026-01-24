/**
 * ThemeExplorer - Main container for the explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 *
 * Structure: Theme Selection -> Split View (SubThemes + CustomerAsks) -> Mentions (slide-in panel)
 */
import React, { useEffect, useRef } from 'react';
import { Box, CircularProgress, Alert, AlertTitle, useTheme, useMediaQuery, Slide, Typography, Fade, Button, alpha } from '@mui/material';
import { SubThemesColumn } from './SubThemesColumn';
import { CustomerAsksColumn } from './CustomerAsksColumn';
import { MentionsPanel } from './MentionsPanel';
import { MobileNavigationHeader } from './MobileNavigationHeader';
import { MobileMentionsDrawer } from './MobileMentionsDrawer';
import { MentionsBottomPanel } from './MentionsBottomPanel';
import { ThemeSelectionView } from './ThemeSelectionView';
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
  const [bottomPanelHeight, setBottomPanelHeight] = React.useState(50); // percentage
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
    // Selection state
    selectedThemeId,
    selectedSubThemeId,
    // Mobile-specific state
    setIsMobile,
    mobileActiveView,
    mobileNavigationStack,
    selectedFeedbackId,
    selectedCustomerAskId,
    // Actions
    selectTheme,
    selectSubTheme,
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
    // Mobile Step 1: No theme selected - Show theme widgets
    if (!selectedThemeId) {
      return (
        <Fade in timeout={300}>
          <Box
            className={className}
            sx={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
            }}
          >
            <ThemeSelectionView onThemeSelect={selectTheme} />

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

    // Mobile Progressive Flow (when theme is selected)
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
          {/* Step 1: Sub-Themes (shown when theme is selected) */}
          <Slide direction="left" in={mobileActiveView === 'subThemes'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <SubThemesColumn width="100%" />
            </Box>
          </Slide>

          {/* Step 2: Customer Asks */}
          <Slide direction="left" in={mobileActiveView === 'customerAsks'} mountOnEnter unmountOnExit>
            <Box sx={{ height: '100%', width: '100%', position: 'absolute' }}>
              <CustomerAsksColumn isPanelOpen={false} />
            </Box>
          </Slide>
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

  // Desktop Progressive Layout
  
  // Step 1: No theme selected - Show theme widgets
  if (!selectedThemeId) {
    return (
      <Fade in timeout={300}>
        <Box
          className={className}
          sx={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
          }}
        >
          <ThemeSelectionView onThemeSelect={selectTheme} />

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

  // Step 2: Theme selected - Show two-column split view (SubThemes + CustomerAsks) with draggable bottom panel
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
          position: 'relative',
        }}
      >
        {/* Header with Back Button */}
        <Box 
          sx={{ 
            px: 3, 
            py: 1.5, 
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Button
            variant="text"
            size="small"
            startIcon={<Box component="span" sx={{ fontSize: 18 }}>←</Box>}
            onClick={() => selectTheme(null)}
            sx={{ 
              textTransform: 'none',
              color: 'text.primary',
              '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.08) }
            }}
          >
            Back to Themes
          </Button>
        </Box>

        {/* Main Content Area - Two Columns (SubThemes + CustomerAsks) */}
        <Box 
          sx={{ 
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Left Column - SubThemes */}
          <SubThemesColumn width={280} />

          {/* Right Column - Customer Asks with Bottom Panel Container */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* Customer Asks Column */}
            <Box
              sx={{
                flex: 1,
                height: isPanelOpen ? `${100 - bottomPanelHeight}%` : '100%',
                transition: 'height 0.3s ease-in-out',
                overflow: 'hidden',
              }}
            >
              <CustomerAsksColumn isPanelOpen={false} />
            </Box>

            {/* Bottom Panel for Mentions - Only in this column */}
            <MentionsBottomPanel
              open={isPanelOpen}
              onClose={() => closeMentionsPanel()}
              height={`${bottomPanelHeight}%`}
              onHeightChange={setBottomPanelHeight}
            />
          </Box>
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
