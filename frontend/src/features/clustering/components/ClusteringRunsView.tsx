import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  useTheme,
  alpha,
  Button,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PlayArrow as RunningIcon,
  CheckCircle as CompletedIcon,
  Error as FailedIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';
import type { ClusteringRun } from '../types/clustering.types';

interface ClusteringRunsViewProps {
  workspaceId: string;
}

const ClusteringRunsView: React.FC<ClusteringRunsViewProps> = () => {
  const theme = useTheme();
  const { runs, isLoading, setSelectedRun, setCurrentView } = useClusteringStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, runId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedRunId(runId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRunId(null);
  };

  const handleViewRun = (run: ClusteringRun) => {
    setSelectedRun(run);
    setCurrentView('approval');
    handleMenuClose();
  };

  const getStatusIcon = (status: ClusteringRun['status']) => {
    switch (status) {
      case 'running':
        return <RunningIcon sx={{ color: theme.palette.info.main }} />;
      case 'completed':
        return <CompletedIcon sx={{ color: theme.palette.success.main }} />;
      case 'failed':
        return <FailedIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return null;
    }
  };

  const getStatusChip = (status: ClusteringRun['status']) => {
    const colors = {
      running: 'info',
      completed: 'success',
      failed: 'error',
    } as const;

    const statusIcon = getStatusIcon(status);

    return (
      <Chip
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={colors[status]}
        size="small"
        icon={statusIcon || undefined}
        sx={{ fontWeight: 600 }}
      />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (createdAt: string, completedAt?: string) => {
    const start = new Date(createdAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading clustering runs...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight={600}>
              Clustering Runs ({runs.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<RunningIcon />}
              onClick={() => useClusteringStore.getState().setShowStartModal(true)}
            >
              Start New Run
            </Button>
          </Box>

          {runs.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                color: 'text.secondary',
              }}
            >
              <RunningIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No clustering runs yet
              </Typography>
              <Typography variant="body2">
                Start your first clustering run to discover feature patterns in your messages.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Run Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Messages</TableCell>
                    <TableCell align="right">Clusters</TableCell>
                    <TableCell align="right">Confidence</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        },
                        cursor: 'pointer',
                      }}
                      onClick={() => handleViewRun(run)}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {run.run_name}
                          </Typography>
                          {run.description && (
                            <Typography variant="caption" color="text.secondary">
                              {run.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {getStatusChip(run.status)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {run.messages_analyzed.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color="primary">
                          {run.clusters_discovered}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {Math.round(run.confidence_threshold * 100)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {calculateDuration(run.created_at, run.completed_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(run.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, run.id);
                          }}
                        >
                          <MoreIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            const run = runs.find(r => r.id === selectedRunId);
            if (run) handleViewRun(run);
          }}
        >
          <ViewIcon sx={{ mr: 1 }} />
          View Clusters
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Run
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ClusteringRunsView;