/**
 * Competitors Step Component
 * Step 4: Add competitors to track
 * Shows AI-suggested competitors based on company info
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
  Business as BusinessIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '@/config/api.config';

export interface Competitor {
  name: string;
  website?: string;
}

interface CompetitorsStepProps {
  selectedCompetitors: Competitor[];
  setSelectedCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
  workspaceId: string;
  accessToken: string;
  setError: (error: string | null) => void;
}

interface CompetitorSuggestion {
  name: string;
  website?: string;
  description?: string;
}

export function CompetitorsStep({
  selectedCompetitors,
  setSelectedCompetitors,
  workspaceId,
  accessToken,
  setError,
}: CompetitorsStepProps): JSX.Element {
  const theme = useTheme();
  
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [customCompetitorName, setCustomCompetitorName] = useState('');
  
  // Guard against double fetching (React StrictMode)
  const hasFetched = useRef(false);

  // Fetch AI suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!workspaceId || !accessToken) {
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
        const response = await fetch(
          `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/generate-competitor-suggestions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch competitor suggestions');
        }

        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Failed to fetch competitor suggestions:', err);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [workspaceId, accessToken]);

  // Refresh suggestions
  const handleRefreshSuggestions = async () => {
    if (!workspaceId || !accessToken) return;

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/generate-competitor-suggestions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            already_suggested: suggestions.map(s => s.name),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh competitor suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Failed to refresh suggestions:', err);
      setError('Failed to refresh suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Check if a suggestion is selected
  const isSelected = (suggestion: CompetitorSuggestion) => {
    return selectedCompetitors.some(c => c.name.toLowerCase() === suggestion.name.toLowerCase());
  };

  // Toggle suggestion selection
  const handleToggleSuggestion = (suggestion: CompetitorSuggestion) => {
    if (isSelected(suggestion)) {
      setSelectedCompetitors(prev => prev.filter(c => c.name.toLowerCase() !== suggestion.name.toLowerCase()));
    } else {
      setSelectedCompetitors(prev => [...prev, { name: suggestion.name, website: suggestion.website }]);
    }
  };

  // Add custom competitor
  const handleAddCustomCompetitor = () => {
    const trimmedName = customCompetitorName.trim();
    if (trimmedName && !selectedCompetitors.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setSelectedCompetitors(prev => [...prev, { name: trimmedName }]);
      setCustomCompetitorName('');
    }
  };

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomCompetitor();
    }
  };

  // Remove competitor
  const handleRemoveCompetitor = (competitorName: string) => {
    setSelectedCompetitors(prev => prev.filter(c => c.name !== competitorName));
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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <BusinessIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Add Competitors
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
          label={`${selectedCompetitors.length} added`}
          size="small"
          color={selectedCompetitors.length > 0 ? 'primary' : 'default'}
          variant={selectedCompetitors.length > 0 ? 'filled' : 'outlined'}
          sx={{ fontWeight: 500, height: 22, fontSize: '0.75rem' }}
        />
      </Box>

      {/* Suggestions Grid */}
      {loadingSuggestions ? (
        renderSkeletons()
      ) : suggestions.length > 0 ? (
        <Grid container spacing={1}>
          {suggestions.slice(0, 4).map((suggestion, index) => {
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
                  {suggestion.description && (
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
                  )}
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
            No suggestions available. Add competitors manually below.
          </Typography>
        </Box>
      )}

      {/* Add Custom Competitor */}
      <TextField
        fullWidth
        size="small"
        placeholder="Add competitor..."
        value={customCompetitorName}
        onChange={(e) => setCustomCompetitorName(e.target.value)}
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

      {/* Selected Competitors Display */}
      {selectedCompetitors.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>
            COMPETITORS TO TRACK:
          </Typography>
          {selectedCompetitors.map((c, idx) => (
            <Chip
              key={idx}
              label={c.name}
              size="small"
              onDelete={() => handleRemoveCompetitor(c.name)}
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
