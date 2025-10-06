import { useState } from 'react';
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
  Slider,
  FormHelperText,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Close as CloseIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';
import type { StartClusteringForm } from '../types/clustering.types';

interface StartClusteringModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

const StartClusteringModal: React.FC<StartClusteringModalProps> = ({
  open,
  onClose,
  workspaceId,
}) => {
  const { startClusteringRun, isLoading, error } = useClusteringStore();

  const [form, setForm] = useState<StartClusteringForm>({
    run_name: '',
    description: '',
    confidence_threshold: 0.7,
    max_messages: 1000,
  });

  const [formErrors, setFormErrors] = useState<Partial<StartClusteringForm>>({});

  const handleChange = (field: keyof StartClusteringForm) => (
    event: React.ChangeEvent<HTMLInputElement> | Event,
    value?: number | number[]
  ) => {
    if (field === 'confidence_threshold' && typeof value === 'number') {
      setForm(prev => ({ ...prev, [field]: value }));
    } else if (field === 'max_messages' && typeof value === 'number') {
      setForm(prev => ({ ...prev, [field]: value }));
    } else if (event && 'target' in event) {
      const target = event.target as HTMLInputElement;
      setForm(prev => ({ ...prev, [field]: target.value }));
    }

    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<StartClusteringForm> = {};

    if (!form.run_name.trim()) {
      errors.run_name = 'Run name is required';
    }

    if (!form.description.trim()) {
      errors.description = 'Description is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await startClusteringRun(workspaceId, form);
      onClose();
      // Reset form
      setForm({
        run_name: '',
        description: '',
        confidence_threshold: 0.7,
        max_messages: 1000,
      });
      setFormErrors({});
    } catch (error) {
      console.error('Failed to start clustering run:', error);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setFormErrors({});
    }
  };

  const generateRunName = () => {
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setForm(prev => ({
      ...prev,
      run_name: `Clustering Run - ${timestamp}`
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Start New Clustering Run
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Analyze your messages to discover patterns and generate feature clusters using AI.
          This process will examine message content and group similar feature requests together.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Run Name"
              value={form.run_name}
              onChange={handleChange('run_name')}
              error={!!formErrors.run_name}
              helperText={formErrors.run_name}
              placeholder="e.g., Mobile App Features Analysis"
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <Button size="small" onClick={generateRunName} disabled={isLoading}>
                    Auto-generate
                  </Button>
                )
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={form.description}
              onChange={handleChange('description')}
              error={!!formErrors.description}
              helperText={formErrors.description}
              placeholder="Describe the purpose of this clustering run..."
              disabled={isLoading}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Confidence Threshold: {Math.round(form.confidence_threshold * 100)}%
            </Typography>
            <Slider
              value={form.confidence_threshold}
              onChange={handleChange('confidence_threshold')}
              min={0.3}
              max={0.95}
              step={0.05}
              marks={[
                { value: 0.3, label: '30%' },
                { value: 0.5, label: '50%' },
                { value: 0.7, label: '70%' },
                { value: 0.9, label: '90%' },
              ]}
              disabled={isLoading}
            />
            <FormHelperText>
              Higher values create fewer, more confident clusters. Lower values discover more patterns but may include less certain matches.
            </FormHelperText>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Max Messages: {form.max_messages?.toLocaleString() || 'All'}
            </Typography>
            <Slider
              value={form.max_messages || 1000}
              onChange={handleChange('max_messages')}
              min={100}
              max={5000}
              step={100}
              marks={[
                { value: 100, label: '100' },
                { value: 1000, label: '1K' },
                { value: 3000, label: '3K' },
                { value: 5000, label: '5K' },
              ]}
              disabled={isLoading}
            />
            <FormHelperText>
              Limit the number of messages to analyze. More messages provide better insights but take longer to process.
            </FormHelperText>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Processing Time:</strong> Clustering typically takes 2-5 minutes depending on message count.
                You'll be notified when the analysis is complete and clusters are ready for review.
              </Typography>
            </Alert>
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
          startIcon={<StartIcon />}
        >
          {isLoading ? 'Starting Analysis...' : 'Start Clustering'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartClusteringModal;