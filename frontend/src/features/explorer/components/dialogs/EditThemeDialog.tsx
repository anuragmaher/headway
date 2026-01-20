/**
 * EditThemeDialog - Dialog for editing an existing theme
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
  useIsEditThemeDialogOpen,
  useEditingThemeId,
  useThemes,
  useExplorerActions,
} from '../../store';

// Predefined theme colors
const THEME_COLORS = [
  '#1976D2', // Blue
  '#388E3C', // Green
  '#F57C00', // Orange
  '#7B1FA2', // Purple
  '#D32F2F', // Red
  '#00838F', // Cyan
  '#5D4037', // Brown
  '#455A64', // Blue Grey
];

export const EditThemeDialog: React.FC = () => {
  const isOpen = useIsEditThemeDialogOpen();
  const editingThemeId = useEditingThemeId();
  const themes = useThemes();
  const { closeEditThemeDialog, updateTheme } = useExplorerActions();

  const editingTheme = themes.find((t) => t.id === editingThemeId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(THEME_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when theme changes
  useEffect(() => {
    if (editingTheme) {
      setName(editingTheme.name);
      setDescription(editingTheme.description);
      setColor(editingTheme.color || THEME_COLORS[0]);
      setError(null);
    }
  }, [editingTheme]);

  const handleClose = () => {
    if (!isSubmitting) {
      closeEditThemeDialog();
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Theme name is required');
      return;
    }

    if (!editingThemeId) {
      setError('No theme selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateTheme(editingThemeId, {
        name: name.trim(),
        description: description.trim(),
        color,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update theme');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    editingTheme &&
    (name !== editingTheme.name ||
      description !== editingTheme.description ||
      color !== editingTheme.color);

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
            bgcolor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EditIcon sx={{ fontSize: 20, color: color }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Edit Theme
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus
          fullWidth
          label="Theme Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!error}
          helperText={error}
          disabled={isSubmitting}
          sx={{ mb: 2.5 }}
        />

        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          disabled={isSubmitting}
          sx={{ mb: 2.5 }}
        />

        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mb: 1.5, fontWeight: 500 }}
        >
          Theme Color
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {THEME_COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => !isSubmitting && setColor(c)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: c,
                cursor: isSubmitting ? 'default' : 'pointer',
                border: color === c ? '2px solid' : '2px solid transparent',
                borderColor: color === c ? 'text.primary' : 'transparent',
                opacity: isSubmitting ? 0.5 : 1,
                transition: 'all 0.15s ease',
                '&:hover': {
                  transform: isSubmitting ? 'none' : 'scale(1.1)',
                },
              }}
            />
          ))}
        </Box>
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

export default EditThemeDialog;
