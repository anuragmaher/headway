/**
 * FeatureDialogs - Edit and Add feature dialogs
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
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
  alpha,
  useTheme,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
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
          borderRadius: 2,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
        Edit Feature
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {editError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {editError}
          </Alert>
        )}
        {savingEdit && (
          <LinearProgress sx={{ mb: 2 }} />
        )}
        <TextField
          autoFocus
          label="Feature Title"
          fullWidth
          value={editFormData.name}
          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
          disabled={savingEdit}
          margin="normal"
          variant="outlined"
          required
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            }
          }}
        />
        <TextField
          label="Description"
          fullWidth
          multiline
          rows={4}
          value={editFormData.description}
          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
          disabled={savingEdit}
          margin="normal"
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={closeEditModal}
          disabled={savingEdit}
        >
          Cancel
        </Button>
        <Button
          onClick={saveFeatureEdit}
          variant="contained"
          disabled={savingEdit || !editFormData.name.trim()}
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

  return (
    <Dialog
      open={addModalOpen}
      onClose={closeAddModal}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
        Add New Feature
      </DialogTitle>
      <DialogContent sx={{ pt: 2, p: 0 }}>
        <Box sx={{ display: 'flex', height: '100%', minHeight: '400px' }}>
          {/* Left Column - Form */}
          <Box sx={{ flex: 1, p: 3, pr: 2, borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            {addError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {addError}
              </Alert>
            )}
            {savingAdd && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
            <TextField
              autoFocus
              label="Feature Title"
              fullWidth
              value={addFormData.name}
              onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
              disabled={savingAdd}
              margin="normal"
              variant="outlined"
              required
              placeholder="e.g., Advanced Analytics Dashboard"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={addFormData.description}
              onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
              disabled={savingAdd}
              margin="normal"
              variant="outlined"
              placeholder="Describe what this feature does..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
          </Box>

          {/* Right Column - Suggestions */}
          <Box sx={{ flex: 0.9, p: 3, pl: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
              AI Suggestions
            </Typography>

            {loadingFeatureSuggestions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flex: 1 }}>
                <CircularProgress size={32} />
              </Box>
            ) : featureSuggestions.length > 0 ? (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, overflow: 'auto', mb: 2 }}>
                  {featureSuggestions.map((suggestion, index) => {
                    const isSelected = selectedSuggestions.has(index);
                    return (
                      <Card
                        key={index}
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          border: `2px solid ${isSelected ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.2)}`,
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                          '&:hover': {
                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.05),
                            borderColor: theme.palette.primary.main,
                          }
                        }}
                        onClick={() => toggleSuggestionSelection(index)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Checkbox
                            checked={isSelected}
                            sx={{ p: 0, mt: 0.25 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {suggestion.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
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
                  disabled={loadingMoreFeatureSuggestions}
                  startIcon={loadingMoreFeatureSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
                  sx={{ mt: 'auto' }}
                >
                  {loadingMoreFeatureSuggestions ? 'Generating...' : '+ Suggest More'}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No suggestions available. Please set up company details first.
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={closeAddModal}
          disabled={savingAdd}
        >
          Cancel
        </Button>
        <Button
          onClick={saveFeatureAdd}
          variant="contained"
          disabled={savingAdd || (selectedSuggestions.size === 0 && !addFormData.name.trim())}
        >
          {savingAdd
            ? 'Creating...'
            : selectedSuggestions.size > 0
              ? `Create ${selectedSuggestions.size} Feature${selectedSuggestions.size > 1 ? 's' : ''}`
              : 'Create Feature'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};
