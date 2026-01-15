/**
 * GmailLabelSelectionScreen - Standalone screen for selecting Gmail labels during onboarding
 * This is shown instead of the wizard to avoid overlap
 */

import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import { useGmailStore } from '@/shared/store/gmailStore';

export function GmailLabelSelectionScreen(): JSX.Element | null {
  const theme = useTheme();
  const {
    step,
    labels,
    selected,
    loading,
    error,
    loadLabels,
    toggleLabel,
    saveLabels,
  } = useGmailStore();

  // Check if we should show this screen
  // This screen is shown when AdminLayout detects OAuth completion
  // We check localStorage for the onboarding flag
  const isFromOnboarding = localStorage.getItem('onboarding-gmail-connect') === 'true';
  const shouldShow = isFromOnboarding;

  // Load labels when screen should be shown
  useEffect(() => {
    if (shouldShow) {
      // Reset and load labels
      useGmailStore.setState({ 
        step: 'labels', 
        error: null,
        selected: [],
        labels: [],
      });
      loadLabels();
    }
  }, [shouldShow, loadLabels]);

  const handleSave = async () => {
    try {
      await saveLabels();
      
      // Close the Gmail store modal state
      useGmailStore.setState({ 
        open: false,
        step: 'idle',
        labels: [],
        selected: [],
      });
      
      // Trigger a custom event to notify AdminLayout to hide label screen and show wizard
      window.dispatchEvent(new CustomEvent('gmail-label-selection-complete'));
    } catch (err) {
      console.error('Failed to save labels:', err);
    }
  };

  const handleSkip = () => {
    // Close the Gmail store modal state
    useGmailStore.setState({ 
      open: false,
      step: 'idle',
      labels: [],
      selected: [],
    });
    
    // Trigger a custom event to notify AdminLayout to hide label screen and show wizard
    window.dispatchEvent(new CustomEvent('gmail-label-selection-complete'));
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog
      open={true}
      onClose={handleSkip}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.background.paper,
            0.98
          )} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem', pb: 1, pt: 3 }}>
        📧 Select Gmail Labels
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Gmail has been connected successfully! Select the labels you want to monitor for customer feedback and feature requests.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress size={48} />
            <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary' }}>
              Loading your Gmail labels...
            </Typography>
          </Box>
        ) : labels.length === 0 ? (
          <Box textAlign="center" py={6}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No labels found in your Gmail account.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              You can configure labels later from Workspace Settings.
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Available Labels ({labels.length})
            </Typography>
            <Box
              sx={{
                maxHeight: 400,
                overflowY: 'auto',
                pr: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2,
                p: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              {labels.map((label) => (
                <FormControlLabel
                  key={label.id}
                  control={
                    <Checkbox
                      checked={selected.some((l) => l.id === label.id)}
                      onChange={() => toggleLabel(label)}
                      sx={{
                        '&.Mui-checked': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {label.name}
                    </Typography>
                  }
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1.5,
                    p: 1,
                    borderRadius: 1,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                />
              ))}
            </Box>
            {selected.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                {selected.length} label{selected.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
        <Button 
          onClick={handleSkip} 
          sx={{ borderRadius: 2 }}
          disabled={loading || step === 'saving'}
        >
          Skip for Now
        </Button>

        {step !== 'idle' && (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={selected.length === 0 || loading || step === 'saving'}
            sx={{
              borderRadius: 2,
              px: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {loading || step === 'saving' ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
                Saving...
              </>
            ) : (
              `Save ${selected.length > 0 ? `(${selected.length})` : ''}`
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
