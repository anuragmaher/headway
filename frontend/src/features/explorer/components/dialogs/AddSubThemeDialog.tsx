/**
 * AddSubThemeDialog - Dialog for creating a new sub-theme
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { CreateNewFolder as CreateNewFolderIcon } from '@mui/icons-material';
import {
  useIsAddSubThemeDialogOpen,
  useSelectedTheme,
  useExplorerActions,
} from '../../store';

export const AddSubThemeDialog: React.FC = () => {
  const isOpen = useIsAddSubThemeDialogOpen();
  const selectedTheme = useSelectedTheme();
  const { closeAddSubThemeDialog, createSubTheme, selectSubTheme } = useExplorerActions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isSubmitting) {
      closeAddSubThemeDialog();
      resetForm();
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Sub-theme name is required');
      return;
    }

    if (!selectedTheme) {
      setError('No theme selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newSubTheme = await createSubTheme({
        themeId: selectedTheme.id,
        name: name.trim(),
        description: description.trim(),
      });
      handleClose();
      selectSubTheme(newSubTheme.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sub-theme');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: 2 },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: selectedTheme ? `${selectedTheme.color}15` : 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CreateNewFolderIcon
            sx={{ fontSize: 20, color: selectedTheme?.color || '#666' }}
          />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Add Sub-theme
          </Typography>
          {selectedTheme && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
              in {selectedTheme.name}
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus
          fullWidth
          label="Sub-theme Name"
          placeholder="e.g., Feature Requests, UX Issues, Integrations"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!error}
          helperText={error}
          disabled={isSubmitting}
          sx={{ mb: 2.5 }}
        />

        <TextField
          fullWidth
          label="Description (Optional)"
          placeholder="What kind of feedback belongs in this sub-theme?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          disabled={isSubmitting}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim()}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: 'none', minWidth: 120 }}
        >
          {isSubmitting ? 'Creating...' : 'Add Sub-theme'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSubThemeDialog;
