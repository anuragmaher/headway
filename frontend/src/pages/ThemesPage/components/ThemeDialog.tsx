/**
 * ThemeDialog - Create/Edit theme dialog
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  MenuItem,
  Card,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useThemesPageStore } from '../store';

export const ThemeDialog: React.FC = () => {
  const theme = useTheme();
  const {
    dialogOpen,
    editingTheme,
    formData,
    themes,
    suggestions,
    loadingSuggestions,
    loadingMoreSuggestions,
    closeThemeDialog,
    setFormData,
    createTheme,
    updateTheme,
    loadMoreThemeSuggestions,
  } = useThemesPageStore();

  const handleSubmit = async () => {
    try {
      if (editingTheme) {
        await updateTheme(editingTheme.id, formData);
      } else {
        await createTheme(formData);
      }
      closeThemeDialog();
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={closeThemeDialog}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        }
      }}
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        px: 3,
        pt: 2.5,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {editingTheme ? 'Edit Theme' : 'Create New Theme'}
        </Typography>
        <IconButton onClick={closeThemeDialog} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 2, p: 0 }}>
        <Box sx={{ display: 'flex', height: '100%', minHeight: editingTheme ? 'auto' : '400px' }}>
          {/* Left Column - Form */}
          <Box sx={{ flex: 1, p: 3, pr: 2, borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Theme Name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                fullWidth
                required
                placeholder="e.g., User Interface"
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                required
                placeholder="Describe what this theme is about..."
              />

              <TextField
                select
                label="Parent Theme (Optional)"
                value={formData.parent_theme_id || ''}
                onChange={(e) => setFormData({ parent_theme_id: e.target.value || null })}
                fullWidth
                helperText="Select a parent theme to create a sub-theme"
              >
                <MenuItem value="">None (Root Theme)</MenuItem>
                {themes
                  .filter(t => !t.parent_theme_id && t.id !== editingTheme?.id)
                  .map((parentTheme) => (
                    <MenuItem key={parentTheme.id} value={parentTheme.id}>
                      {parentTheme.name}
                    </MenuItem>
                  ))}
              </TextField>
            </Box>
          </Box>

          {/* Right Column - Suggestions */}
          {!editingTheme && (
            <Box sx={{ flex: 0.9, p: 3, pl: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                AI Suggestions
              </Typography>

              {loadingSuggestions ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flex: 1 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : suggestions.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, overflow: 'auto', mb: 2 }}>
                    {suggestions.map((suggestion, index) => (
                      <Card
                        key={index}
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            borderColor: theme.palette.primary.main,
                            transform: 'translateX(4px)',
                          }
                        }}
                        onClick={() => {
                          setFormData({
                            name: suggestion.name,
                            description: suggestion.description
                          });
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {suggestion.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                          {suggestion.description}
                        </Typography>
                      </Card>
                    ))}
                  </Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={loadMoreThemeSuggestions}
                    disabled={loadingMoreSuggestions}
                    startIcon={loadingMoreSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
                    sx={{ mt: 'auto' }}
                  >
                    {loadingMoreSuggestions ? 'Generating...' : 'Suggest More'}
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No suggestions available. Please set up company details first.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1.5 }}>
        <Button onClick={closeThemeDialog}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!formData.name || !formData.description}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }}
        >
          {editingTheme ? 'Update Theme' : 'Create Theme'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
