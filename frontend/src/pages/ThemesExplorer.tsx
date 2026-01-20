/**
 * ThemesExplorerPage - New three-column Theme Explorer interface
 * Enterprise-grade exploration and triage workspace for product managers
 */

import { useEffect, useState } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';
import { ThemeExplorer } from '@/features/explorer';
import { useExplorerStore } from '@/features/explorer/store';

export function ThemesExplorerPage(): JSX.Element {
  const { tokens, isAuthenticated } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  // Explorer store
  const { reset } = useExplorerStore();

  // Workspace ID recovery state
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  // Hydration check
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Reset explorer when component unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

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

  // Show loading state while fetching workspace ID
  if (isAuthenticated && !WORKSPACE_ID && (fetchingWorkspaceId || !attemptedFetch)) {
    return (
      <AdminLayout>
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}>
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

  // Don't render ThemeExplorer until workspace_id is available
  // This ensures initialize() has a valid workspace_id when it runs
  if (!WORKSPACE_ID) {
    return (
      <AdminLayout>
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ThemeExplorer />
      </Box>
    </AdminLayout>
  );
}

export default ThemesExplorerPage;
