import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Assignment as ClusterIcon,
  Timeline as SignalIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';

interface ClusteringOverviewProps {
  workspaceId: string;
}

const ClusteringOverview: React.FC<ClusteringOverviewProps> = ({ workspaceId }) => {
  const theme = useTheme();
  const { runs, pendingClusters, signals, isLoading } = useClusteringStore();

  const stats = {
    totalRuns: runs.length,
    completedRuns: runs.filter(r => r.status === 'completed').length,
    runningRuns: runs.filter(r => r.status === 'running').length,
    failedRuns: runs.filter(r => r.status === 'failed').length,
    totalClusters: runs.reduce((sum, run) => sum + run.clusters_discovered, 0),
    pendingApprovals: pendingClusters.filter(c => c.approval_status === 'pending').length,
    approvedClusters: pendingClusters.filter(c => c.approval_status === 'approved').length,
    activeSignals: signals.filter(s => s.is_active).length,
    totalSignals: signals.length,
    averageConfidence: pendingClusters.length > 0
      ? pendingClusters.reduce((sum, c) => sum + c.confidence_score, 0) / pendingClusters.length
      : 0,
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'success': return <SuccessIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const recentActivity = [
    ...runs.slice(0, 3).map(run => ({
      id: run.id,
      type: run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'info',
      title: `Clustering run "${run.run_name}" ${run.status}`,
      subtitle: `${run.clusters_discovered} clusters discovered`,
      timestamp: new Date(run.created_at).toLocaleDateString(),
    })),
    ...pendingClusters.slice(0, 2).map(cluster => ({
      id: cluster.id,
      type: cluster.approval_status === 'approved' ? 'success' : 'warning',
      title: `Cluster "${cluster.cluster_name}" ${cluster.approval_status}`,
      subtitle: `${cluster.message_count} messages, ${Math.round(cluster.confidence_score * 100)}% confidence`,
      timestamp: new Date(cluster.created_at).toLocaleDateString(),
    })),
  ].slice(0, 5);

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6" fontWeight={600}>
                  Clustering Runs
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} color="primary">
                {stats.totalRuns}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Completed: {stats.completedRuns}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Running: {stats.runningRuns}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalRuns > 0 ? (stats.completedRuns / stats.totalRuns) * 100 : 0}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ClusterIcon sx={{ color: theme.palette.warning.main, mr: 1 }} />
                <Typography variant="h6" fontWeight={600}>
                  Discovered Clusters
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} color="warning.main">
                {stats.totalClusters}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Pending: {stats.pendingApprovals}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Approved: {stats.approvedClusters}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalClusters > 0 ? (stats.approvedClusters / stats.totalClusters) * 100 : 0}
                  color="warning"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SignalIcon sx={{ color: theme.palette.success.main, mr: 1 }} />
                <Typography variant="h6" fontWeight={600}>
                  Classification Signals
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} color="success.main">
                {stats.activeSignals}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Active: {stats.activeSignals}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total: {stats.totalSignals}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalSignals > 0 ? (stats.activeSignals / stats.totalSignals) * 100 : 0}
                  color="success"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ color: theme.palette.info.main, mr: 1 }} />
                <Typography variant="h6" fontWeight={600}>
                  Avg Confidence
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} color="info.main">
                {Math.round(stats.averageConfidence * 100)}%
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={stats.averageConfidence * 100}
                  color="info"
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Across all discovered clusters
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Recent Activity
              </Typography>
              {recentActivity.length > 0 ? (
                <List>
                  {recentActivity.map((activity, index) => (
                    <ListItem key={activity.id} divider={index < recentActivity.length - 1}>
                      <ListItemIcon>
                        {getStatusIcon(activity.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.title}
                        secondary={activity.subtitle}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {activity.timestamp}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 4,
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="body1">
                    No recent activity. Start your first clustering run to see results here.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                System Performance
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Classification Accuracy</Typography>
                  <Typography variant="body2" fontWeight={600}>95%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={95}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Processing Speed</Typography>
                  <Typography variant="body2" fontWeight={600}>~250ms</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={85}
                  color="success"
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Signal Types
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Keyword" size="small" variant="outlined" />
                  <Chip label="Pattern" size="small" variant="outlined" />
                  <Chip label="Semantic" size="small" variant="outlined" />
                  <Chip label="Business Rule" size="small" variant="outlined" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClusteringOverview;