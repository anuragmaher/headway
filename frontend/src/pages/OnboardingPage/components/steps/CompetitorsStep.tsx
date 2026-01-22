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

interface CompetitorSuggestion {
  name: string;
  website?: string;
  description?: string;
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: 1.5,
    '& fieldset': {
      borderColor: '#e2e8f0',
    },
    '&:hover fieldset': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2563eb',
      borderWidth: 2,
    },
  },
  '& .MuiInputLabel-root': {
    color: '#64748b',
  },
};

export function CompetitorsStep(): JSX.Element {
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = tokens?.workspace_id;
  const accessToken = tokens?.access_token;

  const selectedCompetitors = useSelectedCompetitors();
  const { addCompetitor, removeCompetitor } = useOnboardingStore();

  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customInput, setCustomInput] = useState('');
  const hasFetched = useRef(false);

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
            color: '#64748b',
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
                color: '#64748b',
                p: 0.5,
                '&:hover': { bgcolor: '#f1f5f9' },
              }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Chip
            label={`${selectedCompetitors.length} selected`}
            size="small"
            sx={{
              bgcolor: selectedCompetitors.length > 0 ? '#dbeafe' : '#f1f5f9',
              color: selectedCompetitors.length > 0 ? '#1d4ed8' : '#64748b',
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
            bgcolor: 'white',
            border: '1px solid #e2e8f0',
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
              sx={{ color: '#2563eb' }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#2563eb', fontSize: 16 }} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#1e293b',
              mb: 0.5,
            }}
          >
            Finding competitors
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: '#64748b',
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
                  bgcolor: selected ? '#dbeafe' : 'white',
                  border: '1px solid',
                  borderColor: selected ? '#2563eb' : '#e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#2563eb',
                    bgcolor: selected ? '#dbeafe' : '#f8fafc',
                  },
                }}
              >
                {selected && <CheckIcon sx={{ fontSize: 14, color: '#2563eb' }} />}
                <Typography
                  sx={{
                    fontWeight: selected ? 600 : 500,
                    color: selected ? '#1d4ed8' : '#1e293b',
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
            border: '2px dashed #e2e8f0',
            bgcolor: 'white',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
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
              <AddIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
            </InputAdornment>
          ),
        }}
      />

      {selectedCompetitors.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#64748b',
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
                  bgcolor: '#dbeafe',
                  color: '#1d4ed8',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  '& .MuiChip-deleteIcon': {
                    color: '#1d4ed8',
                    '&:hover': {
                      color: '#1e40af',
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
