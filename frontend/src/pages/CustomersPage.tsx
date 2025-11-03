/**
 * Customers Page
 *
 * Responsive layout:
 * - Desktop: Two-column layout (list + detail)
 * - Mobile: Single view that toggles between list and detail
 */

import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, useTheme, alpha, IconButton, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts/AdminLayout';
import { CustomerList } from '@/features/customers/components/CustomerList';
import { CustomerDetailView } from '@/features/customers/components/CustomerDetailView';
import { CustomerFilters, CustomerFilterValues } from '@/features/customers/components/CustomerFilters';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

export function CustomersPage(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { tokens, isAuthenticated } = useAuthStore();
  const workspaceId = tokens?.workspace_id;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);
  const [filters, setFilters] = useState<CustomerFilterValues>({});
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);

  // On mobile, determine which view to show
  const showList = !isMobile || !selectedCustomerId;
  const showDetail = !isMobile || selectedCustomerId;

  // Handler for mobile back button
  const handleBackToList = () => {
    setSelectedCustomerId(null);
  };

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
      <Container
        maxWidth={false}
        sx={{
          py: { xs: 1, sm: 2, md: 3 },
          px: { xs: 1, sm: 2, md: 3 },
          height: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 0, md: 3 },
            height: { xs: 'calc(100vh - 80px)', md: 'calc(100vh - 120px)' },
            overflow: 'hidden',
          }}
        >
          {/* Left Column - Customer List (hidden on mobile when detail is showing) */}
          {showList && (
            <Paper
              elevation={0}
              sx={{
                flex: { xs: '1 1 auto', md: '0 0 400px' },
                display: showList ? 'flex' : 'none',
                flexDirection: 'column',
                borderRadius: { xs: 0, sm: 2 },
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: '100%',
              }}
            >
              <CustomerList
                workspaceId={workspaceId}
                selectedCustomerId={selectedCustomerId}
                onCustomerSelect={setSelectedCustomerId}
                filters={filters}
                onFiltersChange={setFilters}
                onIndustriesLoad={setAvailableIndustries}
              />
            </Paper>
          )}

          {/* Right Column - Customer Detail View (hidden on mobile when list is showing) */}
          {showDetail && (
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                display: showDetail ? 'flex' : 'none',
                flexDirection: 'column',
                borderRadius: { xs: 0, sm: 2 },
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: '100%',
              }}
            >
              {/* Mobile Back Button */}
              {isMobile && selectedCustomerId && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    gap: 1,
                  }}
                >
                  <IconButton
                    onClick={handleBackToList}
                    sx={{
                      color: 'primary.main',
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    Back to customers
                  </Box>
                </Box>
              )}

              {/* Filters Section */}
              {!isMobile && (
                <Box
                  sx={{
                    p: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <CustomerFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    availableIndustries={availableIndustries}
                  />
                </Box>
              )}

              {/* Detail Content */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
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
                      px: 2,
                      textAlign: 'center',
                    }}
                  >
                    Select a customer to view details
                  </Box>
                )}
              </Box>
            </Paper>
          )}
        </Box>
      </Container>
    </AdminLayout>
  );
}
