/**
 * DeleteConfirmDialog - Confirmation dialog for deleting themes/sub-themes
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useExplorerStore, useExplorerActions } from '../../store';

export const DeleteConfirmDialog: React.FC = () => {
  const {
    isDeleteConfirmOpen,
    deletingItemId,
    deletingItemType,
    themes,
    subThemes,
  } = useExplorerStore();
  const { closeDeleteConfirm, deleteTheme, deleteSubTheme } = useExplorerActions();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get item details
  const itemName = deletingItemType === 'theme'
    ? themes.find((t) => t.id === deletingItemId)?.name
    : deletingItemType === 'subTheme'
      ? subThemes.find((st) => st.id === deletingItemId)?.name
      : 'this item';

  const itemCount = deletingItemType === 'theme'
    ? themes.find((t) => t.id === deletingItemId)?.feedbackCount || 0
    : deletingItemType === 'subTheme'
      ? subThemes.find((st) => st.id === deletingItemId)?.feedbackCount || 0
      : 0;

  const handleClose = () => {
    if (!isDeleting) {
      closeDeleteConfirm();
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingItemId || !deletingItemType) return;

    setIsDeleting(true);
    setError(null);

    try {
      if (deletingItemType === 'theme') {
        await deleteTheme(deletingItemId);
      } else if (deletingItemType === 'subTheme') {
        await deleteSubTheme(deletingItemId);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${deletingItemType}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const typeLabel = deletingItemType === 'theme' ? 'theme' : 'sub-theme';

  return (
    <Dialog
      open={isDeleteConfirmOpen}
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
            bgcolor: 'error.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DeleteIcon sx={{ fontSize: 20, color: '#D32F2F' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Delete {typeLabel}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Are you sure you want to delete <strong>{itemName}</strong>?
        </Typography>

        {itemCount > 0 && (
          <Alert
            severity="warning"
            icon={<WarningIcon sx={{ fontSize: 20 }} />}
            sx={{ mb: 2 }}
          >
            This {typeLabel} contains <strong>{itemCount}</strong> feedback item
            {itemCount !== 1 ? 's' : ''}. Deleting it will remove all associated feedback.
          </Alert>
        )}

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          This action cannot be undone.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={handleClose}
          disabled={isDeleting}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', minWidth: 100 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
