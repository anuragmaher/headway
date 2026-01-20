/**
 * EditSubThemeDialog - Dialog for editing an existing sub-theme
 */
import React, { useState, useEffect } from 'react';
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
import { Edit as EditIcon } from '@mui/icons-material';
import {
  useIsEditSubThemeDialogOpen,
  useEditingSubThemeId,
  useSubThemes,
  useSelectedTheme,
  useExplorerActions,
} from '../../store';

export const EditSubThemeDialog: React.FC = () => {
  const isOpen = useIsEditSubThemeDialogOpen();
  const editingSubThemeId = useEditingSubThemeId();
  const subThemes = useSubThemes();
  const selectedTheme = useSelectedTheme();
  const { closeEditSubThemeDialog, updateSubTheme } = useExplorerActions();

  const editingSubTheme = subThemes.find((st) => st.id === editingSubThemeId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when sub-theme changes
  useEffect(() => {
    if (editingSubTheme) {
      setName(editingSubTheme.name);
      setDescription(editingSubTheme.description);
      setError(null);
    }
  }, [editingSubTheme]);

  const handleClose = () => {
    if (!isSubmitting) {
      closeEditSubThemeDialog();
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Sub-theme name is required');
      return;
    }

    if (!editingSubThemeId) {
      setError('No sub-theme selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateSubTheme(editingSubThemeId, {
        name: name.trim(),
        description: description.trim(),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sub-theme');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    editingSubTheme &&
    (name !== editingSubTheme.name || description !== editingSubTheme.description);

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
          <EditIcon sx={{ fontSize: 20, color: selectedTheme?.color || '#666' }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Edit Sub-theme
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
          disabled={isSubmitting || !name.trim() || !hasChanges}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: 'none', minWidth: 100 }}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditSubThemeDialog;
