/**
 * DeleteConfirmDialogs - Delete confirmation dialogs for features and mentions
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useThemesPageStore } from '../store';
import { formatDate } from '../utils';

export const FeatureDeleteDialog: React.FC = () => {
  const theme = useTheme();
  const {
    deleteConfirmOpen,
    featureToDelete,
    deletingFeature,
    closeDeleteConfirm,
    confirmDeleteFeature,
  } = useThemesPageStore();

  return (
    <Dialog
      open={deleteConfirmOpen}
      onClose={closeDeleteConfirm}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>Delete Feature</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
          Are you sure you want to delete this feature? This action cannot be undone.
        </Typography>
        {featureToDelete && (
          <Typography
            variant="body2"
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              color: theme.palette.error.main,
            }}
          >
            <strong>Feature:</strong> {featureToDelete.name}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={closeDeleteConfirm}
          disabled={deletingFeature}
        >
          Cancel
        </Button>
        <Button
          onClick={confirmDeleteFeature}
          variant="contained"
          color="error"
          disabled={deletingFeature}
        >
          {deletingFeature ? 'Deleting...' : 'Delete Feature'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const MentionDeleteDialog: React.FC = () => {
  const theme = useTheme();
  const {
    deleteMentionConfirmOpen,
    mentionToDelete,
    deletingMention,
    closeDeleteMentionConfirm,
    confirmDeleteMention,
  } = useThemesPageStore();

  return (
    <Dialog
      open={deleteMentionConfirmOpen}
      onClose={closeDeleteMentionConfirm}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>Delete Mention</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
          Are you sure you want to remove this mention from the feature? This action cannot be undone.
        </Typography>
        {mentionToDelete && (
          <Typography
            variant="body2"
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              color: theme.palette.error.main,
            }}
          >
            <strong>From:</strong> {mentionToDelete.customer_name || mentionToDelete.sender_name || 'Unknown'}
            <br />
            <strong>Date:</strong> {formatDate(mentionToDelete.sent_at)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={closeDeleteMentionConfirm}
          disabled={deletingMention}
        >
          Cancel
        </Button>
        <Button
          onClick={confirmDeleteMention}
          variant="contained"
          color="error"
          disabled={deletingMention}
        >
          {deletingMention ? 'Deleting...' : 'Delete Mention'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
