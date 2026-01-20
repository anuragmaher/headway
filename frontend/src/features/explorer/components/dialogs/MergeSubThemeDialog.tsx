/**
 * MergeSubThemeDialog - Dialog for merging one sub-theme into another
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
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Alert,
} from '@mui/material';
import { MergeType as MergeTypeIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useExplorerStore, useExplorerActions } from '../../store';

export const MergeSubThemeDialog: React.FC = () => {
  const {
    isMergeDialogOpen,
    mergeSourceId,
    subThemes,
    selectedThemeId,
  } = useExplorerStore();
  const { closeMergeDialog, mergeSubThemes } = useExplorerActions();

  const [targetId, setTargetId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceSubTheme = subThemes.find((st) => st.id === mergeSourceId);
  const availableTargets = subThemes.filter((st) => st.id !== mergeSourceId);
  const targetSubTheme = subThemes.find((st) => st.id === targetId);

  const handleClose = () => {
    if (!isMerging) {
      closeMergeDialog();
      setTargetId(null);
      setError(null);
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !targetId) return;

    setIsMerging(true);
    setError(null);

    try {
      await mergeSubThemes({ sourceId: mergeSourceId, targetId });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge sub-themes');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog
      open={isMergeDialogOpen}
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
            bgcolor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MergeTypeIcon sx={{ fontSize: 20, color: '#1976D2' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Merge Sub-theme
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Source Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Merging:
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {sourceSubTheme?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
              {sourceSubTheme?.feedbackCount} feedback item{sourceSubTheme?.feedbackCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {/* Arrow */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
          <ArrowForwardIcon sx={{ fontSize: 24, color: '#9E9E9E' }} />
        </Box>

        {/* Target Selection */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Merge into:
          </Typography>

          {availableTargets.length === 0 ? (
            <Alert severity="info">
              No other sub-themes available. Create another sub-theme first.
            </Alert>
          ) : (
            <List
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                maxHeight: 240,
                overflow: 'auto',
              }}
            >
              {availableTargets.map((subTheme) => (
                <ListItemButton
                  key={subTheme.id}
                  selected={targetId === subTheme.id}
                  onClick={() => setTargetId(subTheme.id)}
                  sx={{
                    borderRadius: 1,
                    mx: 0.5,
                    my: 0.25,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Radio
                      checked={targetId === subTheme.id}
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={subTheme.name}
                    secondary={`${subTheme.feedbackCount} items`}
                    primaryTypographyProps={{ fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        {/* Preview */}
        {targetSubTheme && sourceSubTheme && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This will move all <strong>{sourceSubTheme.feedbackCount}</strong> items
            from "{sourceSubTheme.name}" to "{targetSubTheme.name}" and delete
            the source sub-theme.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={handleClose}
          disabled={isMerging}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleMerge}
          disabled={isMerging || !targetId || availableTargets.length === 0}
          startIcon={isMerging ? <CircularProgress size={16} color="inherit" /> : <MergeTypeIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', minWidth: 100 }}
        >
          {isMerging ? 'Merging...' : 'Merge'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeSubThemeDialog;
