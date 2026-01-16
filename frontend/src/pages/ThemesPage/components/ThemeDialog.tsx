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
  Checkbox,
  Alert,
  LinearProgress,
  alpha,
  useTheme,
  Divider,
  Chip,
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
    selectedThemeSuggestions,
    loadingSuggestions,
    loadingMoreSuggestions,
    savingTheme,
    themeError,
    closeThemeDialog,
    setFormData,
    createTheme,
    createMultipleThemes,
    updateTheme,
    loadMoreThemeSuggestions,
    toggleThemeSuggestionSelection,
    showSnackbar,
  } = useThemesPageStore();

  const handleSubmit = async () => {
    try {
      if (editingTheme) {
        await updateTheme(editingTheme.id, formData);
        showSnackbar('Theme updated successfully');
        closeThemeDialog();
      } else {
        const hasSelections = selectedThemeSuggestions.size > 0;
        
        if (hasSelections) {
          const selectedThemes = Array.from(selectedThemeSuggestions).map(index => ({
            name: suggestions[index].name,
            description: suggestions[index].description,
            parent_theme_id: formData.parent_theme_id || null,
          }));
          await createMultipleThemes(selectedThemes);
          showSnackbar(`Successfully created ${selectedThemes.length} theme${selectedThemes.length > 1 ? 's' : ''}`);
          closeThemeDialog();
        } else if (formData.name.trim() && formData.description.trim()) {
          await createTheme(formData);
          showSnackbar('Theme created successfully');
          closeThemeDialog();
        }
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to save theme');
    }
  };

  const hasSelections = selectedThemeSuggestions.size > 0;
  const canSubmit = editingTheme 
    ? formData.name.trim() && formData.description.trim()
    : hasSelections || (formData.name.trim() && formData.description.trim());

  return (
    <Dialog
      open={dialogOpen}
      onClose={closeThemeDialog}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 4,
        py: 3,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: theme.palette.background.paper,
      }}>
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 700,
            fontSize: '1.5rem',
            color: 'text.primary',
            letterSpacing: '-0.02em',
          }}
        >
          {editingTheme ? 'Edit Theme' : 'Create New Theme'}
        </Typography>
        <IconButton 
          onClick={closeThemeDialog} 
          size="small"
          disabled={savingTheme}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.text.secondary, 0.1),
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <DialogContent 
        sx={{ 
          p: 0,
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: theme.palette.background.default,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        {themeError && (
          <Alert 
            severity="error" 
            sx={{ 
              mx: 4,
              mt: 3,
              mb: 0,
              borderRadius: 2,
            }}
          >
            {themeError}
          </Alert>
        )}
        {savingTheme && (
          <LinearProgress 
            sx={{ 
              mt: themeError ? 2 : 3,
              mx: 4,
              mb: 0,
              borderRadius: 1,
            }} 
          />
        )}

        <Box sx={{ 
          display: 'flex', 
          flex: 1,
          overflow: 'hidden',
          mt: 3,
        }}>
          {/* Left Section - Form */}
          <Box sx={{ 
            flex: 1, 
            px: 4,
            pb: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: !editingTheme && suggestions.length > 0 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 3,
              maxWidth: 500,
            }}>
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    mb: 1.5,
                    color: 'text.primary',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Theme Details
                </Typography>
                <TextField
                  label="Theme Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  fullWidth
                  required
                  disabled={savingTheme || hasSelections}
                  placeholder="e.g., User Interface"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: theme.palette.background.paper,
                      '&:hover': {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                        }
                      }
                    },
                    '& .MuiInputLabel-root': {
                      fontWeight: 500,
                    }
                  }}
                />
              </Box>

              <Box>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ description: e.target.value })}
                  fullWidth
                  multiline
                  rows={4}
                  required
                  disabled={savingTheme || hasSelections}
                  placeholder="Describe what this theme is about..."
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: theme.palette.background.paper,
                      '&:hover': {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                        }
                      }
                    },
                    '& .MuiInputLabel-root': {
                      fontWeight: 500,
                    }
                  }}
                />
              </Box>

              <Box>
                <TextField
                  select
                  label="Parent Theme"
                  value={formData.parent_theme_id || ''}
                  onChange={(e) => setFormData({ parent_theme_id: e.target.value || null })}
                  fullWidth
                  disabled={savingTheme}
                  helperText="Optional: Create as a sub-theme under an existing theme"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: theme.palette.background.paper,
                    },
                    '& .MuiInputLabel-root': {
                      fontWeight: 500,
                    }
                  }}
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
          </Box>

          {/* Right Section - AI Suggestions */}
          {!editingTheme && (
            <Box sx={{ 
              width: 420,
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    mb: 2,
                    color: 'text.secondary',
                    fontSize: '0.85rem',
                  }}
                >
                  AI Suggestions
                </Typography>
                {hasSelections && (
                  <Chip
                    label={`${selectedThemeSuggestions.size} selected`}
                    size="small"
                    sx={{
                      height: 24,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                )}
              </Box>

              <Box sx={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                px: 3,
                pb: 3,
              }}>
                {loadingSuggestions ? (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    flex: 1,
                    gap: 2,
                  }}>
                    <CircularProgress size={32} />
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: '0.875rem' }}
                    >
                      Generating suggestions...
                    </Typography>
                  </Box>
                ) : suggestions.length > 0 ? (
                  <>
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      flex: 1,
                      mb: 2,
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      '&::-webkit-scrollbar': {
                        display: 'none',
                      },
                    }}>
                      {suggestions.map((suggestion, index) => {
                        const isSelected = selectedThemeSuggestions.has(index);
                        return (
                          <Card
                            key={index}
                            sx={{
                              p: 1.5,
                              cursor: 'pointer',
                              borderRadius: 2,
                              border: `1px solid ${isSelected ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.2)}`,
                              bgcolor: isSelected 
                                ? alpha(theme.palette.primary.main, 0.08) 
                                : 'transparent',
                              transition: 'all 0.2s ease',
                              flexShrink: 0,
                              '&:hover': {
                                bgcolor: isSelected 
                                  ? alpha(theme.palette.primary.main, 0.12) 
                                  : alpha(theme.palette.primary.main, 0.05),
                                borderColor: theme.palette.primary.main,
                                transform: 'translateX(4px)',
                              }
                            }}
                            onClick={() => toggleThemeSuggestionSelection(index)}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Checkbox
                                checked={isSelected}
                                sx={{ 
                                  p: 0,
                                  mt: 0.25,
                                  color: theme.palette.primary.main,
                                  '&.Mui-checked': {
                                    color: theme.palette.primary.main,
                                  }
                                }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography 
                                  variant="subtitle2" 
                                  sx={{ 
                                    fontWeight: 600,
                                    mb: 0.5,
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  {suggestion.name}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary" 
                                  sx={{ 
                                    display: 'block',
                                    lineHeight: 1.4,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {suggestion.description}
                                </Typography>
                              </Box>
                            </Box>
                          </Card>
                        );
                      })}
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={loadMoreThemeSuggestions}
                      disabled={loadingMoreSuggestions || savingTheme}
                      startIcon={loadingMoreSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
                      sx={{ 
                        mt: 'auto',
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                        '&:hover': {
                          borderColor: theme.palette.primary.main,
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        }
                      }}
                    >
                      {loadingMoreSuggestions ? 'Generating...' : 'Suggest More'}
                    </Button>
                  </>
                ) : (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      textAlign: 'center',
                      py: 3,
                      fontSize: '0.8rem',
                    }}
                  >
                    No suggestions available. Please set up company details first.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Footer */}
      <Divider />
      <DialogActions sx={{ 
        px: 4,
        py: 3,
        bgcolor: theme.palette.background.paper,
      }}>
        <Button 
          onClick={closeThemeDialog}
          disabled={savingTheme}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
            px: 3,
            py: 1,
            '&:hover': {
              bgcolor: alpha(theme.palette.text.secondary, 0.08),
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={savingTheme || !canSubmit}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            px: 4,
            py: 1,
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            '&:hover': {
              boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
              transform: 'translateY(-1px)',
            },
            '&:disabled': {
              background: alpha(theme.palette.primary.main, 0.3),
              transform: 'none',
            }
          }}
        >
          {savingTheme
            ? 'Saving...'
            : editingTheme
              ? 'Save Changes'
              : hasSelections
                ? `Create ${selectedThemeSuggestions.size} Theme${selectedThemeSuggestions.size > 1 ? 's' : ''}`
                : 'Create Theme'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};
