/**
 * Create Theme Step Component
 * Step 3: Select themes to organize feedback
 * Shows AI-suggested themes - user can select multiple
 */

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  alpha,
  useTheme,
  Skeleton,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { themeService, type ThemeSuggestion } from '@/services/theme';

export interface SelectedTheme {
  name: string;
  description: string;
}

interface CreateThemeStepProps {
  selectedThemes: SelectedTheme[];
  setSelectedThemes: React.Dispatch<React.SetStateAction<SelectedTheme[]>>;
  workspaceId: string;
  setError: (error: string | null) => void;
}

export function CreateThemeStep({
  selectedThemes,
  setSelectedThemes,
  workspaceId,
  setError,
}: CreateThemeStepProps): JSX.Element {
  const theme = useTheme();
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [customThemeName, setCustomThemeName] = useState('');
  
  // Guard against double fetching (React StrictMode)
  const hasFetched = useRef(false);

  // Fetch AI suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!workspaceId) {
        setLoadingSuggestions(false);
        return;
      }

      // Prevent double fetch in React StrictMode
      if (hasFetched.current) {
        return;
      }
      hasFetched.current = true;

      setLoadingSuggestions(true);
      try {
        const themeSuggestions = await themeService.generateThemeSuggestions(workspaceId);
        setSuggestions(themeSuggestions.slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch theme suggestions:', err);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [workspaceId]);

  // Refresh suggestions
  const handleRefreshSuggestions = async () => {
    if (!workspaceId) return;

    setLoadingSuggestions(true);
    try {
      const themeSuggestions = await themeService.generateThemeSuggestions(
        workspaceId,
        [],
        suggestions
      );
      setSuggestions(themeSuggestions.slice(0, 4));
    } catch (err) {
      console.error('Failed to refresh suggestions:', err);
      setError('Failed to refresh suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Check if a suggestion is selected
  const isSelected = (suggestion: ThemeSuggestion) => {
    return selectedThemes.some(t => t.name === suggestion.name);
  };

  // Toggle suggestion selection
  const handleToggleSuggestion = (suggestion: ThemeSuggestion) => {
    if (isSelected(suggestion)) {
      setSelectedThemes(prev => prev.filter(t => t.name !== suggestion.name));
    } else {
      setSelectedThemes(prev => [...prev, { name: suggestion.name, description: suggestion.description }]);
    }
  };

  // Add custom theme
  const handleAddCustomTheme = () => {
    const trimmedName = customThemeName.trim();
    if (trimmedName && !selectedThemes.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      setSelectedThemes(prev => [...prev, { name: trimmedName, description: '' }]);
      setCustomThemeName('');
    }
  };

  // Handle enter key for custom theme
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomTheme();
    }
  };

  // Remove selected theme
  const handleRemoveTheme = (themeName: string) => {
    setSelectedThemes(prev => prev.filter(t => t.name !== themeName));
  };

  // Render skeleton
  const renderSkeletons = () => (
    <Grid container spacing={1}>
      {[0, 1, 2, 3].map((index) => (
        <Grid item xs={6} key={index}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Skeleton variant="circular" width={18} height={18} />
              <Skeleton variant="text" width="70%" height={18} />
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box>
      {/* Header - Combined with description */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <AutoAwesomeIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Select Themes
          </Typography>
          {!loadingSuggestions && suggestions.length > 0 && (
            <IconButton
              onClick={handleRefreshSuggestions}
              size="small"
              sx={{ p: 0.5 }}
              title="Get new suggestions"
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
        <Chip
          label={`${selectedThemes.length} selected`}
          size="small"
          color={selectedThemes.length > 0 ? 'primary' : 'default'}
          variant={selectedThemes.length > 0 ? 'filled' : 'outlined'}
          sx={{ fontWeight: 500, height: 22, fontSize: '0.75rem' }}
        />
      </Box>

      {/* Suggestions Grid - Compact 2x2 */}
      {loadingSuggestions ? (
        renderSkeletons()
      ) : suggestions.length > 0 ? (
        <Grid container spacing={1}>
          {suggestions.map((suggestion, index) => {
            const selected = isSelected(suggestion);

            return (
              <Grid item xs={6} key={index}>
                <Box
                  onClick={() => handleToggleSuggestion(suggestion)}
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    border: `2px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
                    backgroundColor: selected 
                      ? alpha(theme.palette.primary.main, 0.08) 
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.3)}`,
                        backgroundColor: selected ? theme.palette.primary.main : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {selected && <CheckIcon sx={{ color: '#fff', fontSize: 12 }} />}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: selected ? theme.palette.primary.main : 'text.primary',
                        lineHeight: 1.2,
                      }}
                      noWrap
                    >
                      {suggestion.name}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                      fontSize: '0.7rem',
                      pl: 3.25,
                      mt: 0.25,
                    }}
                  >
                    {suggestion.description}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            border: `1px dashed ${alpha(theme.palette.divider, 0.5)}`,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
            No AI suggestions available. Add custom themes below.
          </Typography>
        </Box>
      )}

      {/* Add Custom Theme */}
      <TextField
        fullWidth
        size="small"
        placeholder="Add custom theme..."
        value={customThemeName}
        onChange={(e) => setCustomThemeName(e.target.value)}
        onKeyPress={handleKeyPress}
        sx={{ mt: 1.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AddIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </InputAdornment>
          ),
          sx: { 
            borderRadius: 1.5, 
            '& input': { py: 0.75, fontSize: '0.85rem' },
          },
        }}
      />

      {/* Selected Themes Display - Inline */}
      {selectedThemes.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>
            THEMES TO CREATE:
          </Typography>
          {selectedThemes.map((t, idx) => (
            <Chip
              key={idx}
              label={t.name}
              size="small"
              onDelete={() => handleRemoveTheme(t.name)}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiChip-deleteIcon': {
                  fontSize: 14,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    color: theme.palette.primary.dark,
                  },
                },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
