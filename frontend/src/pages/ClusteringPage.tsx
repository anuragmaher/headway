/**
 * Main Clustering Management Page
 * Provides interface for AI-powered feature clustering and approval workflow
 */

import { useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Tab,
  Tabs,
  alpha,
  useTheme,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Psychology as AIIcon,
  PlayArrow as StartIcon,
  Assignment as ApprovalIcon,
  Timeline as SignalsIcon,
  Dashboard as OverviewIcon,
  AutoFixHigh as MagicIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useClusteringStore } from '@/features/clustering/store/clustering-store';
import ClusteringOverview from '@/features/clustering/components/ClusteringOverview';
import ClusteringRunsView from '@/features/clustering/components/ClusteringRunsView';
import ClusterApprovalView from '@/features/clustering/components/ClusterApprovalView';
import ClassificationSignalsView from '@/features/clustering/components/ClassificationSignalsView';
import StartClusteringModal from '@/features/clustering/components/StartClusteringModal';
import ClusterApprovalModal from '@/features/clustering/components/ClusterApprovalModal';

export function ClusteringPage(): JSX.Element {
  const theme = useTheme();
  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  const {
    currentView,
    setCurrentView,
    isLoading,
    error,
    runs,
    pendingClusters,
    signals,
    showStartModal,
    showApprovalModal,
    loadClusteringRuns,
    loadPendingClusters,
    loadClassificationSignals,
    setShowStartModal,
  } = useClusteringStore();

  if (!WORKSPACE_ID) {
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

  // Load initial data
  useEffect(() => {
    loadClusteringRuns(WORKSPACE_ID);
    loadPendingClusters(WORKSPACE_ID);
    loadClassificationSignals(WORKSPACE_ID);
  }, [WORKSPACE_ID, loadClusteringRuns, loadPendingClusters, loadClassificationSignals]);

  const handleTabChange = (_: any, newValue: string) => {
    setCurrentView(newValue as any);
  };

  const getTabColor = (tab: string) => {
    switch (tab) {
      case 'clustering': return theme.palette.info.main;
      case 'approval': return theme.palette.warning.main;
      case 'signals': return theme.palette.success.main;
      default: return theme.palette.primary.main;
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <ClusteringOverview workspaceId={WORKSPACE_ID} />;
      case 'clustering':
        return <ClusteringRunsView workspaceId={WORKSPACE_ID} />;
      case 'approval':
        return <ClusterApprovalView workspaceId={WORKSPACE_ID} />;
      case 'signals':
        return <ClassificationSignalsView workspaceId={WORKSPACE_ID} />;
      default:
        return <ClusteringOverview workspaceId={WORKSPACE_ID} />;
    }
  };

  return (
    <AdminLayout>
      <Box>
        {/* Header */}
        <Box sx={{
          mb: 3,
          p: 2,
          borderRadius: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <MagicIcon sx={{ color: theme.palette.primary.main }} />
                AI Feature Intelligence
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                Discover patterns, approve clusters, and automate classification
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<StartIcon />}
                onClick={() => setShowStartModal(true)}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                Start Clustering
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => useClusteringStore.getState().setError()}>
            {error}
          </Alert>
        )}

        {/* Navigation Tabs */}
        <Card sx={{ mb: 2, borderRadius: 1 }}>
          <CardContent sx={{ p: 0 }}>
            <Tabs
              value={currentView}
              onChange={handleTabChange}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  minHeight: 64,
                  fontWeight: 600,
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                },
              }}
            >
              <Tab
                value="overview"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <OverviewIcon />
                    Overview
                  </Box>
                }
              />
              <Tab
                value="clustering"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AIIcon />
                    Clustering Runs
                    {runs.length > 0 && (
                      <Chip
                        label={runs.length}
                        size="small"
                        sx={{
                          bgcolor: alpha(getTabColor('clustering'), 0.1),
                          color: getTabColor('clustering'),
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    )}
                  </Box>
                }
              />
              <Tab
                value="approval"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ApprovalIcon />
                    Pending Approval
                    {pendingClusters.length > 0 && (
                      <Chip
                        label={pendingClusters.length}
                        size="small"
                        sx={{
                          bgcolor: alpha(getTabColor('approval'), 0.1),
                          color: getTabColor('approval'),
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    )}
                  </Box>
                }
              />
              <Tab
                value="signals"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SignalsIcon />
                    Classification Signals
                    {signals.filter(s => s.is_active).length > 0 && (
                      <Chip
                        label={signals.filter(s => s.is_active).length}
                        size="small"
                        sx={{
                          bgcolor: alpha(getTabColor('signals'), 0.1),
                          color: getTabColor('signals'),
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    )}
                  </Box>
                }
              />
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Box sx={{ position: 'relative' }}>
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                zIndex: 1,
                borderRadius: 1,
              }}
            >
              <CircularProgress />
            </Box>
          )}
          {renderCurrentView()}
        </Box>

        {/* Modals */}
        <StartClusteringModal
          open={showStartModal}
          onClose={() => setShowStartModal(false)}
          workspaceId={WORKSPACE_ID}
        />

        <ClusterApprovalModal
          open={showApprovalModal}
          onClose={() => useClusteringStore.getState().setShowApprovalModal(false)}
          workspaceId={WORKSPACE_ID}
        />
      </Box>
    </AdminLayout>
  );
}

export default ClusteringPage;