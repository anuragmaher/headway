import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { Theme, ThemeFormData } from '../../types';
import { ThemeSuggestion } from '@/services/theme';

interface ThemeFormDialogProps {
  open: boolean;
  editingTheme: Theme | null;
  formData: ThemeFormData;
  flattenedThemes: Theme[];
  suggestions: ThemeSuggestion[];
  loadingSuggestions: boolean;
  loadingMoreSuggestions: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormDataChange: (data: Partial<ThemeFormData>) => void;
  onUseSuggestion: (suggestion: ThemeSuggestion) => void;
  onLoadMoreSuggestions: () => void;
}

export const ThemeFormDialog: React.FC<ThemeFormDialogProps> = ({
  open,
  editingTheme,
  formData,
  flattenedThemes,
  suggestions,
  loadingSuggestions,
  loadingMoreSuggestions,
  onClose,
  onSubmit,
  onFormDataChange,
  onUseSuggestion,
  onLoadMoreSuggestions,
}) => {
  const theme = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        {editingTheme ? 'Edit Theme' : 'Create New Theme'}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Theme Name"
            value={formData.name}
            onChange={(e) => onFormDataChange({ name: e.target.value })}
            fullWidth
            required
            autoFocus
          />
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => onFormDataChange({ description: e.target.value })}
            fullWidth
            multiline
            rows={3}
            required
          />
          
          <FormControl fullWidth>
            <InputLabel>Parent Theme (Optional)</InputLabel>
            <Select
              value={formData.parent_theme_id || ''}
              onChange={(e) => onFormDataChange({ parent_theme_id: e.target.value || null })}
              label="Parent Theme (Optional)"
            >
              <MenuItem value="">
                <em>None (Root Theme)</em>
              </MenuItem>
              {flattenedThemes
                .filter(t => !editingTheme || t.id !== editingTheme.id)
                .map((theme) => (
                  <MenuItem key={theme.id} value={theme.id}>
                    {theme.parent_theme_id ? `└─ ${theme.name}` : theme.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {!editingTheme && suggestions.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                AI Suggestions ({suggestions.length})
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
                {suggestions.map((suggestion, index) => (
                  <Card 
                    key={index}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      }
                    }}
                    onClick={() => onUseSuggestion(suggestion)}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {suggestion.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            {suggestion.description}
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          color={suggestion.confidence > 0.7 ? 'success' : 'default'}
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
              
              <Button
                onClick={onLoadMoreSuggestions}
                disabled={loadingMoreSuggestions}
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
              >
                {loadingMoreSuggestions ? (
                  <>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    Loading More...
                  </>
                ) : (
                  'Load More Suggestions'
                )}
              </Button>
            </Box>
          )}

          {!editingTheme && loadingSuggestions && suggestions.length === 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography variant="body2" color="textSecondary">
                Loading AI suggestions...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit"
          variant="contained"
          disabled={!formData.name.trim() || !formData.description.trim()}
        >
          {editingTheme ? 'Update Theme' : 'Create Theme'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};









