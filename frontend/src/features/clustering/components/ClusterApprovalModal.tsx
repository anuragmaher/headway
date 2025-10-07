import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  LinearProgress,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ThumbUp as ApproveIcon,
  ThumbDown as RejectIcon,
  Edit as ModifyIcon,
  Close as CloseIcon,
  Category as CategoryIcon,
  Style as ThemeIcon,
  TrendingUp as ConfidenceIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';
import type { ApprovalForm } from '../types/clustering.types';

interface ClusterApprovalModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

const ClusterApprovalModal: React.FC<ClusterApprovalModalProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const {
    selectedClusterForApproval,
    approveCluster,
    rejectCluster,
    isLoading,
    error
  } = useClusteringStore();

  const [form, setForm] = useState<ApprovalForm>({
    decision: 'approve',
    customer_feedback: '',
    modifications: {
      cluster_name: '',
      description: '',
      category: '',
      theme: '',
    },
  });

  const [formErrors, setFormErrors] = useState<{
    customer_feedback?: string;
    modifications?: Record<string, string>;
  }>({});

  useEffect(() => {
    if (selectedClusterForApproval && open) {
      setForm({
        decision: 'approve',
        customer_feedback: '',
        modifications: {
          cluster_name: selectedClusterForApproval.cluster_name,
          description: selectedClusterForApproval.description,
          category: selectedClusterForApproval.category,
          theme: selectedClusterForApproval.theme,
        },
      });
      setFormErrors({});
    }
  }, [selectedClusterForApproval, open]);

  const handleDecisionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const decision = event.target.value as ApprovalForm['decision'];
    setForm(prev => ({ ...prev, decision }));
  };

  const handleFeedbackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, customer_feedback: event.target.value }));
    if (formErrors.customer_feedback) {
      setFormErrors(prev => ({ ...prev, customer_feedback: undefined }));
    }
  };

  const handleModificationChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({
      ...prev,
      modifications: {
        ...prev.modifications,
        [field]: event.target.value,
      },
    }));
    if (formErrors.modifications?.[field]) {
      setFormErrors(prev => ({
        ...prev,
        modifications: {
          ...prev.modifications,
          [field]: '',
        },
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!form.customer_feedback.trim()) {
      errors.customer_feedback = 'Feedback is required to explain your decision';
    }

    if (form.decision === 'modify') {
      const modErrors: Record<string, string> = {};
      if (!form.modifications?.cluster_name?.trim()) {
        modErrors.cluster_name = 'Cluster name is required';
      }
      if (!form.modifications?.description?.trim()) {
        modErrors.description = 'Description is required';
      }
      if (!form.modifications?.category?.trim()) {
        modErrors.category = 'Category is required';
      }
      if (!form.modifications?.theme?.trim()) {
        modErrors.theme = 'Theme is required';
      }
      if (Object.keys(modErrors).length > 0) {
        errors.modifications = modErrors;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0 &&
           (!errors.modifications || Object.keys(errors.modifications).length === 0);
  };

  const handleSubmit = async () => {
    if (!selectedClusterForApproval || !validateForm()) return;

    try {
      if (form.decision === 'approve') {
        await approveCluster(selectedClusterForApproval.id, form);
      } else if (form.decision === 'reject') {
        await rejectCluster(selectedClusterForApproval.id, form);
      } else {
        // For modify, we approve with modifications
        await approveCluster(selectedClusterForApproval.id, form);
      }
      onClose();
    } catch (error) {
      console.error('Failed to process cluster approval:', error);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setFormErrors({});
    }
  };

  if (!selectedClusterForApproval) return null;

  const cluster = selectedClusterForApproval;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Review Cluster: {cluster.cluster_name}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Cluster Information */}
          <Grid item xs={12} lg={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Cluster Details
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {cluster.description}
                  </Typography>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CategoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Chip label={cluster.category} variant="outlined" />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ThemeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Chip label={cluster.theme} variant="outlined" />
                    </Box>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ConfidenceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={600}>
                        {Math.round(cluster.confidence_score * 100)}% confidence
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MessageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={600}>
                        {cluster.message_count} messages
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {cluster.business_impact && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Business Impact
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {cluster.business_impact}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Example Messages */}
            {cluster.example_messages && cluster.example_messages.sample_content && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Example Messages
                  </Typography>
                  <List dense>
                    {cluster.example_messages.sample_content.slice(0, 4).map((message, index) => (
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
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Approval Form */}
          <Grid item xs={12} lg={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Your Decision
                </Typography>

                <FormControl component="fieldset" sx={{ mb: 3 }}>
                  <FormLabel component="legend">Decision</FormLabel>
                  <RadioGroup
                    value={form.decision}
                    onChange={handleDecisionChange}
                  >
                    <FormControlLabel
                      value="approve"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ApproveIcon color="success" />
                          <Typography>Approve as-is</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="modify"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ModifyIcon color="info" />
                          <Typography>Approve with modifications</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="reject"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <RejectIcon color="error" />
                          <Typography>Reject this cluster</Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Feedback & Reasoning"
                  value={form.customer_feedback}
                  onChange={handleFeedbackChange}
                  error={!!formErrors.customer_feedback}
                  helperText={formErrors.customer_feedback || 'Explain why you made this decision'}
                  placeholder="e.g., This cluster accurately represents mobile app feature requests..."
                  disabled={isLoading}
                  sx={{ mb: 3 }}
                />

                {form.decision === 'modify' && (
                  <Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      Modifications
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Cluster Name"
                          value={form.modifications?.cluster_name || ''}
                          onChange={handleModificationChange('cluster_name')}
                          error={!!formErrors.modifications?.cluster_name}
                          helperText={formErrors.modifications?.cluster_name}
                          disabled={isLoading}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Description"
                          value={form.modifications?.description || ''}
                          onChange={handleModificationChange('description')}
                          error={!!formErrors.modifications?.description}
                          helperText={formErrors.modifications?.description}
                          disabled={isLoading}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Category"
                          value={form.modifications?.category || ''}
                          onChange={handleModificationChange('category')}
                          error={!!formErrors.modifications?.category}
                          helperText={formErrors.modifications?.category}
                          disabled={isLoading}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Theme"
                          value={form.modifications?.theme || ''}
                          onChange={handleModificationChange('theme')}
                          error={!!formErrors.modifications?.theme}
                          helperText={formErrors.modifications?.theme}
                          disabled={isLoading}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          startIcon={<CloseIcon />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading}
          color={form.decision === 'reject' ? 'error' : 'primary'}
          startIcon={
            form.decision === 'reject' ? <RejectIcon /> :
            form.decision === 'modify' ? <ModifyIcon /> : <ApproveIcon />
          }
        >
          {isLoading ? 'Processing...' :
           form.decision === 'reject' ? 'Reject Cluster' :
           form.decision === 'modify' ? 'Approve with Changes' : 'Approve Cluster'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClusterApprovalModal;