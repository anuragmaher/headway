/**
 * CompetitorsStep Component
 * Step 4: Add competitors
 * Clean design for split-layout onboarding
 */

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';
import {
  useSelectedCompetitors,
  useOnboardingStore,
} from '../../store/onboardingStore';
import { useOnboardingColors } from '../../hooks/useOnboardingColors';

interface CompetitorSuggestion {
  name: string;
  website?: string;
  description?: string;
}

export function CompetitorsStep(): JSX.Element {
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = tokens?.workspace_id;
  const accessToken = tokens?.access_token;
  const colors = useOnboardingColors();

  const selectedCompetitors = useSelectedCompetitors();
  const { addCompetitor, removeCompetitor } = useOnboardingStore();

  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customInput, setCustomInput] = useState('');
  const hasFetched = useRef(false);

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: colors.background.input,
      borderRadius: 1.5,
      '& fieldset': {
        borderColor: colors.border.input,
      },
      '&:hover fieldset': {
        borderColor: colors.border.default,
      },
      '&.Mui-focused fieldset': {
        borderColor: colors.border.focused,
        borderWidth: 2,
      },
    },
    '& .MuiInputBase-input': {
      color: colors.text.primary,
    },
    '& .MuiInputLabel-root': {
      color: colors.text.secondary,
    },
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!workspaceId || !accessToken || hasFetched.current) return;

      hasFetched.current = true;
      setIsLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/generate-competitor-suggestions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Failed to fetch competitor suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [workspaceId, accessToken]);

  const handleRefresh = async () => {
    if (!workspaceId || !accessToken) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/generate-competitor-suggestions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            already_suggested: suggestions.map((s) => s.name),
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to refresh suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isSelected = (suggestion: CompetitorSuggestion) => {
    return selectedCompetitors.some(
      (c) => c.name.toLowerCase() === suggestion.name.toLowerCase()
    );
  };

  const handleToggleSuggestion = (suggestion: CompetitorSuggestion) => {
    if (isSelected(suggestion)) {
      removeCompetitor(suggestion.name);
    } else {
      addCompetitor({ name: suggestion.name, website: suggestion.website });
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (
      trimmed &&
      !selectedCompetitors.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      addCompetitor({ name: trimmed });
      setCustomInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: colors.text.secondary,
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            letterSpacing: '0.05em',
          }}
        >
          Suggested Competitors
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isLoading && suggestions.length > 0 && (
            <IconButton
              onClick={handleRefresh}
              size="small"
              sx={{
                color: colors.text.secondary,
                p: 0.5,
                '&:hover': { bgcolor: colors.background.hover },
              }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Chip
            label={`${selectedCompetitors.length} selected`}
            size="small"
            sx={{
              bgcolor: selectedCompetitors.length > 0 ? colors.chip.selected.bg : colors.background.hover,
              color: selectedCompetitors.length > 0 ? colors.chip.selected.text : colors.text.secondary,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Box>
      </Box>

      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
            px: 3,
            borderRadius: 2,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.input}`,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              mb: 2,
            }}
          >
            <CircularProgress
              size={40}
              thickness={3}
              sx={{ color: colors.primary.main }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <AutoAwesomeIcon sx={{ color: colors.primary.main, fontSize: 16 }} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: colors.text.primary,
              mb: 0.5,
            }}
          >
            Finding competitors
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: colors.text.secondary,
              textAlign: 'center',
            }}
          >
            AI is analyzing your industry to suggest relevant competitors...
          </Typography>
        </Box>
      ) : suggestions.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {suggestions.slice(0, 8).map((suggestion, index) => {
            const selected = isSelected(suggestion);

            return (
              <Box
                key={index}
                onClick={() => handleToggleSuggestion(suggestion)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 2,
                  py: 0.875,
                  borderRadius: 1,
                  bgcolor: selected ? colors.background.selected : colors.background.paper,
                  border: '1px solid',
                  borderColor: selected ? colors.primary.main : colors.border.input,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: colors.primary.main,
                    bgcolor: selected ? colors.background.selected : colors.background.subtle,
                  },
                }}
              >
                {selected && <CheckIcon sx={{ fontSize: 14, color: colors.primary.main }} />}
                <Typography
                  sx={{
                    fontWeight: selected ? 600 : 500,
                    color: selected ? colors.chip.selected.text : colors.text.primary,
                    fontSize: '0.8125rem',
                  }}
                >
                  {suggestion.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{
            py: 4,
            px: 3,
            borderRadius: 1.5,
            border: `2px dashed ${colors.border.input}`,
            bgcolor: colors.background.paper,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: colors.text.secondary, fontSize: '0.8125rem' }}>
            No suggestions available. Add competitors manually below.
          </Typography>
        </Box>
      )}

      <TextField
        fullWidth
        placeholder="Add competitor manually..."
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        onKeyPress={handleKeyPress}
        size="small"
        sx={{ ...inputSx, mt: 2.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AddIcon sx={{ color: colors.text.muted, fontSize: 18 }} />
            </InputAdornment>
          ),
        }}
      />

      {selectedCompetitors.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: colors.text.secondary,
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              letterSpacing: '0.05em',
              mb: 1.5,
            }}
          >
            Competitors to track
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedCompetitors.map((competitor, index) => (
              <Chip
                key={index}
                label={competitor.name}
                onDelete={() => removeCompetitor(competitor.name)}
                size="small"
                sx={{
                  bgcolor: colors.chip.selected.bg,
                  color: colors.chip.selected.text,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  '& .MuiChip-deleteIcon': {
                    color: colors.chip.selected.text,
                    '&:hover': {
                      color: colors.primary.darker,
                    },
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
