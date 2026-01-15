/**
 * GmailLabelSelectionModal - Modal for selecting Gmail labels during onboarding
 */

import { useEffect, useState } from 'react';
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

interface GmailLabelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function GmailLabelSelectionModal({
  open,
  onClose,
  onComplete,
}: GmailLabelSelectionModalProps): JSX.Element {
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

  // Load labels when modal opens
  useEffect(() => {
    if (open && step === 'idle') {
      useGmailStore.setState({ step: 'labels' });
      loadLabels();
    }
  }, [open, step, loadLabels]);

  const handleSave = async () => {
    try {
      await saveLabels();
      onComplete();
    } catch (err) {
      // Error is handled in the store
      console.error('Failed to save labels:', err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.background.paper,
            0.95
          )} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.3rem', pb: 1 }}>
        📧 Select Gmail Labels
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the Gmail labels you want to monitor for customer feedback.
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Box textAlign="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Loading labels...
            </Typography>
          </Box>
        ) : labels.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              No labels found. You can skip this step and configure labels later.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              maxHeight: 300,
              overflowY: 'auto',
              pr: 1,
            }}
          >
            {labels.map((label) => (
              <FormControlLabel
                key={label.id}
                control={
                  <Checkbox
                    checked={selected.some((l) => l.id === label.id)}
                    onChange={() => toggleLabel(label)}
                  />
                }
                label={label.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                }}
              />
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Skip
        </Button>

        {step === 'labels' && (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={selected.length === 0 || loading}
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            {loading ? 'Saving...' : 'Save Labels'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
