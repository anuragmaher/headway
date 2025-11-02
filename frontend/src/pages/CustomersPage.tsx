/**
 * Customers Page
 *
 * Two-column layout:
 * - Left: Customer list with search
 * - Right: Consolidated customer view (features, pain points, summary, highlights)
 */

import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, useTheme, alpha } from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts/AdminLayout';
import { CustomerList } from '@/features/customers/components/CustomerList';
import { CustomerDetailView } from '@/features/customers/components/CustomerDetailView';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

export function CustomersPage(): JSX.Element {
  const theme = useTheme();
  const { tokens, isAuthenticated } = useAuthStore();
  const workspaceId = tokens?.workspace_id;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  // Hydration: Check if store is ready
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    console.log('CustomersPage recovery check:', {
      hydrated,
      isAuthenticated,
      workspaceId,
      fetchingWorkspaceId,
      attemptedFetch,
      hasAccessToken: !!tokens?.access_token
    });

    if (!hydrated || !isAuthenticated || workspaceId || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    console.log('Attempting to fetch workspace_id...');
    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        console.log('Workspace fetch response:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Workspace data:', data);
        if (data.workspace_id) {
          console.log('Setting workspace_id:', data.workspace_id);
          useAuthStore.setState({
            tokens: { ...tokens!, workspace_id: data.workspace_id }
          });
        }
      })
      .catch(error => {
        console.error('Failed to fetch workspace:', error);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, workspaceId, tokens, fetchingWorkspaceId, attemptedFetch]);

  // Show loading if workspace isn't loaded yet
  if (!workspaceId) {
    return (
      <AdminLayout>
        <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            Loading workspace...
          </Box>
        </Container>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            height: 'calc(100vh - 120px)',
            overflow: 'hidden',
          }}
        >
          {/* Left Column - Customer List */}
          <Paper
            elevation={0}
            sx={{
              flex: '0 0 400px',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <CustomerList
              workspaceId={workspaceId}
              selectedCustomerId={selectedCustomerId}
              onCustomerSelect={setSelectedCustomerId}
            />
          </Paper>

          {/* Right Column - Customer Detail View */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              borderRadius: 2,
              overflow: 'auto',
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            {selectedCustomerId ? (
              <CustomerDetailView
                customerId={selectedCustomerId}
                workspaceId={workspaceId}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                }}
              >
                Select a customer to view details
              </Box>
            )}
          </Paper>
        </Box>
      </Container>
    </AdminLayout>
  );
}
