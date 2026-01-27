/**
 * AISuggestionsPanel Component
 * Displays AI suggestions with loading and results states
 */

import { Box, Typography, IconButton, CircularProgress, Chip } from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { Theme } from '../../../types';
import { SuggestedThemeRow } from './SuggestedThemeRow';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface AISuggestionsPanelProps {
  url: string;
  isLoading: boolean;
  suggestions: Theme[];
  addedThemeNames: string[];
  onAddTheme: (theme: Theme) => void;
  onClose: () => void;
}

export function AISuggestionsPanel({
  url,
  isLoading,
  suggestions,
  addedThemeNames,
  onAddTheme,
  onClose,
}: AISuggestionsPanelProps): JSX.Element {
  const colors = useTaxonomyColors();

  return (
    <Box
      sx={{
        bgcolor: colors.purple.light,
        borderRadius: 2,
        border: `1px solid ${colors.purple.main}`,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: isLoading || suggestions.length > 0 ? `1px solid ${colors.purple.border}` : 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeIcon
            sx={{
              fontSize: 20,
              color: colors.purple.main,
            }}
          />
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: colors.purple.main,
            }}
          >
            {TAXONOMY_TEXT.aiSuggestions.title}
          </Typography>
          {!isLoading && url && (
            <Chip
              label={url}
              size="small"
              sx={{
                fontSize: '0.75rem',
                bgcolor: colors.background.card,
                border: `1px solid ${colors.border.light}`,
                color: colors.text.secondary,
                maxWidth: 200,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          )}
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            p: 0.5,
            color: colors.text.secondary,
            '&:hover': {
              color: colors.text.primary,
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 5,
          }}
        >
          <CircularProgress
            size={36}
            sx={{
              color: colors.purple.main,
              mb: 2,
            }}
          />
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: '0.9375rem',
              color: colors.purple.main,
              mb: 0.5,
            }}
          >
            {TAXONOMY_TEXT.aiSuggestions.loadingText}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LinkIcon sx={{ fontSize: 14, color: colors.text.muted }} />
            <Typography
              sx={{
                fontSize: '0.8125rem',
                color: colors.purple.main,
              }}
            >
              {url}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Results */}
      {!isLoading && suggestions.length > 0 && (
        <Box sx={{ bgcolor: colors.background.card }}>
          {suggestions.map((theme, index) => (
            <SuggestedThemeRow
              key={`${theme.name}-${index}`}
              theme={theme}
              onAdd={() => onAddTheme(theme)}
              isAdded={addedThemeNames.includes(theme.name)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
