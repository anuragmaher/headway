import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  LinearProgress,
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ThumbUp as ApproveIcon,
  ThumbDown as RejectIcon,
  Visibility as ViewIcon,
  TrendingUp as ConfidenceIcon,
  Category as CategoryIcon,
  Style as ThemeIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';
import type { DiscoveredCluster } from '../types/clustering.types';

interface ClusterApprovalViewProps {
  workspaceId: string;
}

const ClusterApprovalView: React.FC<ClusterApprovalViewProps> = ({ workspaceId }) => {
  const theme = useTheme();
  const {
    pendingClusters,
    isLoading,
    setShowApprovalModal,
    approveCluster,
    rejectCluster
  } = useClusteringStore();

  const [expandedCluster, setExpandedCluster] = useState<string | false>(false);

  const handleAccordionChange = (clusterId: string) => (_: any, isExpanded: boolean) => {
    setExpandedCluster(isExpanded ? clusterId : false);
  };

  const handleApprove = async (cluster: DiscoveredCluster) => {
    try {
      await approveCluster(cluster.id, {
        decision: 'approve',
        customer_feedback: 'Approved from cluster view',
      });
    } catch (error) {
      console.error('Failed to approve cluster:', error);
    }
  };

  const handleReject = async (cluster: DiscoveredCluster) => {
    try {
      await rejectCluster(cluster.id, {
        decision: 'reject',
        customer_feedback: 'Rejected from cluster view',
      });
    } catch (error) {
      console.error('Failed to reject cluster:', error);
    }
  };

  const handleOpenModal = (cluster: DiscoveredCluster) => {
    setShowApprovalModal(true, cluster);
  };

  const getStatusColor = (status: DiscoveredCluster['approval_status']) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'modified': return 'info';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return theme.palette.success.main;
    if (confidence >= 0.6) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading clusters for approval...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const pendingForApproval = pendingClusters.filter(c => c.approval_status === 'pending');

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>
              Clusters Pending Approval ({pendingForApproval.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={`${pendingClusters.filter(c => c.approval_status === 'approved').length} Approved`}
                color="success"
                size="small"
              />
              <Chip
                label={`${pendingClusters.filter(c => c.approval_status === 'rejected').length} Rejected`}
                color="error"
                size="small"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {pendingForApproval.length === 0 ? (
        <Card>
          <CardContent>
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                color: 'text.secondary',
              }}
            >
              <ApproveIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No clusters pending approval
              </Typography>
              <Typography variant="body2">
                All discovered clusters have been reviewed. Start a new clustering run to discover more patterns.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pendingForApproval.map((cluster) => (
            <Card
              key={cluster.id}
              sx={{
                border: `2px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                '&:hover': {
                  borderColor: alpha(theme.palette.warning.main, 0.4),
                },
              }}
            >
              <Accordion
                expanded={expandedCluster === cluster.id}
                onChange={handleAccordionChange(cluster.id)}
                sx={{ boxShadow: 'none' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <Typography variant="h6" fontWeight={600}>
                        {cluster.cluster_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {cluster.description}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CategoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Chip label={cluster.category} size="small" variant="outlined" />
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ThemeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Chip label={cluster.theme} size="small" variant="outlined" />
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ConfidenceIcon
                          sx={{
                            fontSize: 16,
                            color: getConfidenceColor(cluster.confidence_score)
                          }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={getConfidenceColor(cluster.confidence_score)}
                        >
                          {formatConfidence(cluster.confidence_score)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MessageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={600}>
                          {cluster.message_count} messages
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ pt: 2 }}>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                      {/* Business Impact */}
                      {cluster.business_impact && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Business Impact
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {cluster.business_impact}
                          </Typography>
                        </Grid>
                      )}

                      {/* Example Messages */}
                      {cluster.example_messages && cluster.example_messages.sample_content && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                            Example Messages
                          </Typography>
                          <List dense>
                            {cluster.example_messages.sample_content.slice(0, 3).map((message, index) => (
                              <ListItem
                                key={index}
                                sx={{
                                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                                  borderRadius: 1,
                                  mb: 1,
                                }}
                              >
                                <ListItemText
                                  primary={message}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    sx: { fontStyle: 'italic' }
                                  }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Grid>
                      )}

                      {/* Action Buttons */}
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<ViewIcon />}
                            onClick={() => handleOpenModal(cluster)}
                          >
                            Review Details
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<RejectIcon />}
                            onClick={() => handleReject(cluster)}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={<ApproveIcon />}
                            onClick={() => handleApprove(cluster)}
                          >
                            Approve
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ClusterApprovalView;