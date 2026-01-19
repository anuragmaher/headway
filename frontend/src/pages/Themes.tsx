/**
 * ThemesPage - Refactored page for managing and organizing feature request themes
 * Uses Zustand for state management and modular components
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { API_BASE_URL } from '@/config/api.config';
import { useThemesPageStore } from '../shared/store/ThemesStore';
import {
  FeaturesPanel,
  MentionsDrawer,
  ThemesLoadingSkeleton,
  ThemeDialog,
  FeatureEditDialog,
  FeatureAddDialog,
  FeatureDeleteDialog,
  MentionDeleteDialog,
  ThemeActionsMenu,
  ThemeSelector,
  ThemeSlackConnectDialog,
} from '@/shared/components/ThemeComponents';

export function ThemesPage(): JSX.Element {
  const { tokens, isAuthenticated } = useAuthStore();
  
  const WORKSPACE_ID = tokens?.workspace_id;

  // Store state
  const {
    loading,
    error,
    snackbarOpen,
    snackbarMessage,
    slackConnectDialogOpen,
    selectedThemeForSlack,
    setError,
    closeSnackbar,
    closeSlackConnectDialog,
    fetchThemes,
    handleAllThemesClick,
  } = useThemesPageStore();

  // Layout header
  const setHeaderContent = useLayoutStore((state) => state.setHeaderContent);

  // Set custom header content (ThemeSelector) on mount
  useEffect(() => {
    setHeaderContent(<ThemeSelector />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  // Workspace ID recovery state
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  // Hydration check
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    if (!hydrated || !isAuthenticated || WORKSPACE_ID || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.workspace_id && tokens) {
          useAuthStore.setState({
            tokens: {
              ...tokens,
              workspace_id: data.workspace_id
            }
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch workspace_id:', err);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, WORKSPACE_ID, fetchingWorkspaceId, attemptedFetch, tokens]);

  // Fetch themes when workspace is available
  useEffect(() => {
    if (!WORKSPACE_ID) {
      return;
    }

    fetchThemes();
    handleAllThemesClick();
  }, [WORKSPACE_ID]);

  // Listen for onboarding completion to refresh themes
  useEffect(() => {
    if (!WORKSPACE_ID) {
      return;
    }

    const handleOnboardingComplete = () => {
      // Refresh themes when onboarding completes (themes were created during onboarding)
      fetchThemes();
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete);
    
    return () => {
      window.removeEventListener('onboarding-complete', handleOnboardingComplete);
    };
  }, [WORKSPACE_ID, fetchThemes]);

  // Show loading state while fetching workspace ID
  if (isAuthenticated && !WORKSPACE_ID && (fetchingWorkspaceId || !attemptedFetch)) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  // Show error if we can't get workspace ID after attempting to fetch it
  if (isAuthenticated && !WORKSPACE_ID && attemptedFetch && !fetchingWorkspaceId) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Workspace ID not found. Please log in again.
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  // Loading state
  if (loading) {
    return <ThemesLoadingSkeleton />;
  }

  return (
    <AdminLayout>
      <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mx: 2, mt: 1, borderRadius: 2 }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Main Layout - Single Panel Design */}
        <Box sx={{ 
          flex: 1,
          display: 'flex', 
          overflow: 'hidden',
        }}>
          {/* Features Panel with integrated theme navigation */}
          <FeaturesPanel />

          {/* Mentions Drawer */}
          <MentionsDrawer />
        </Box>

        {/* Dialogs */}
        <ThemeDialog />
        <FeatureEditDialog />
        <FeatureAddDialog />
        <FeatureDeleteDialog />
        <MentionDeleteDialog />
        <ThemeSlackConnectDialog
          open={slackConnectDialogOpen}
          onClose={closeSlackConnectDialog}
          theme={selectedThemeForSlack}
        />

        {/* Theme Actions Menu */}
        <ThemeActionsMenu />

        {/* Success Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={closeSnackbar} 
            severity="success" 
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </AdminLayout>
  );
}

export default ThemesPage;
