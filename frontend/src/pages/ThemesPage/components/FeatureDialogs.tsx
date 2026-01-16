/**
 * FeatureDialogs - Edit and Add feature dialogs
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
  Card,
  Checkbox,
  Alert,
  LinearProgress,
  CircularProgress,
  IconButton,
  Divider,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { 
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useThemesPageStore } from '../store';

export const FeatureEditDialog: React.FC = () => {
  const theme = useTheme();
  const {
    editModalOpen,
    editFormData,
    savingEdit,
    editError,
    closeEditModal,
    setEditFormData,
    saveFeatureEdit,
  } = useThemesPageStore();

  return (
    <Dialog
      open={editModalOpen}
      onClose={closeEditModal}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
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
          Edit Feature
        </Typography>
        <IconButton 
          onClick={closeEditModal} 
          size="small"
          disabled={savingEdit}
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
      <DialogContent sx={{ 
        p: 0,
        bgcolor: theme.palette.background.default,
      }}>
        {editError && (
          <Alert 
            severity="error" 
            sx={{ 
              mx: 4,
              mt: 3,
              mb: 0,
              borderRadius: 2,
            }}
          >
            {editError}
          </Alert>
        )}
        {savingEdit && (
          <LinearProgress 
            sx={{ 
              mt: editError ? 2 : 3,
              mx: 4,
              mb: 0,
              borderRadius: 1,
            }} 
          />
        )}
        <Box sx={{ px: 4, py: 3 }}>
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
                Feature Details
              </Typography>
              <TextField
                autoFocus
                label="Feature Title"
                fullWidth
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                disabled={savingEdit}
                variant="outlined"
                required
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
                fullWidth
                multiline
                rows={4}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                disabled={savingEdit}
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
          </Box>
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
          onClick={closeEditModal}
          disabled={savingEdit}
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
          onClick={saveFeatureEdit}
          variant="contained"
          disabled={savingEdit || !editFormData.name.trim()}
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
          {savingEdit ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const FeatureAddDialog: React.FC = () => {
  const theme = useTheme();
  const {
    addModalOpen,
    addFormData,
    savingAdd,
    addError,
    featureSuggestions,
    selectedSuggestions,
    loadingFeatureSuggestions,
    loadingMoreFeatureSuggestions,
    closeAddModal,
    setAddFormData,
    toggleSuggestionSelection,
    loadMoreFeatureSuggestions,
    saveFeatureAdd,
  } = useThemesPageStore();

  const hasSelections = selectedSuggestions.size > 0;
  const canSubmit = hasSelections || addFormData.name.trim();

  return (
    <Dialog
      open={addModalOpen}
      onClose={closeAddModal}
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
          Add New Feature
        </Typography>
        <IconButton 
          onClick={closeAddModal} 
          size="small"
          disabled={savingAdd}
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
        {addError && (
          <Alert 
            severity="error" 
            sx={{ 
              mx: 4,
              mt: 3,
              mb: 0,
              borderRadius: 2,
            }}
          >
            {addError}
          </Alert>
        )}
        {savingAdd && (
          <LinearProgress 
            sx={{ 
              mt: addError ? 2 : 3,
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
            borderRight: featureSuggestions.length > 0 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
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
                  Feature Details
                </Typography>
                <TextField
                  autoFocus
                  label="Feature Title"
                  fullWidth
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  disabled={savingAdd || hasSelections}
                  variant="outlined"
                  required
                  placeholder="e.g., Advanced Analytics Dashboard"
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
                  fullWidth
                  multiline
                  rows={4}
                  value={addFormData.description}
                  onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
                  disabled={savingAdd || hasSelections}
                  variant="outlined"
                  placeholder="Describe what this feature does..."
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
            </Box>
          </Box>

          {/* Right Section - AI Suggestions */}
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
                  label={`${selectedSuggestions.size} selected`}
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
              {loadingFeatureSuggestions ? (
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
              ) : featureSuggestions.length > 0 ? (
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
                    {featureSuggestions.map((suggestion, index) => {
                      const isSelected = selectedSuggestions.has(index);
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
                          onClick={() => toggleSuggestionSelection(index)}
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
                    onClick={loadMoreFeatureSuggestions}
                    disabled={loadingMoreFeatureSuggestions || savingAdd}
                    startIcon={loadingMoreFeatureSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
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
                    {loadingMoreFeatureSuggestions ? 'Generating...' : 'Suggest More'}
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
          onClick={closeAddModal}
          disabled={savingAdd}
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
          onClick={saveFeatureAdd}
          variant="contained"
          disabled={savingAdd || !canSubmit}
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
          {savingAdd
            ? 'Creating...'
            : hasSelections
              ? `Create ${selectedSuggestions.size} Feature${selectedSuggestions.size > 1 ? 's' : ''}`
              : 'Create Feature'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};
