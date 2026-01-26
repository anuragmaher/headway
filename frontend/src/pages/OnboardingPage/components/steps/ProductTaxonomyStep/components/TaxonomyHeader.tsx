/**
 * TaxonomyHeader Component
 * Action buttons for theme management
 * Note: Title/subtitle are rendered by parent OnboardingPage
 */

import { Box, Button } from '@mui/material';
import { Add as AddIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { TAXONOMY_COLORS, TAXONOMY_TEXT } from '../constants';

interface TaxonomyHeaderProps {
  onAddTheme: () => void;
  onSuggestFromDocs: () => void;
  isAddDisabled?: boolean;
  isSuggestDisabled?: boolean;
}

export function TaxonomyHeader({
  onAddTheme,
  onSuggestFromDocs,
  isAddDisabled = false,
  isSuggestDisabled = false,
}: TaxonomyHeaderProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onAddTheme}
        disabled={isAddDisabled}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          borderColor: TAXONOMY_COLORS.border.default,
          color: TAXONOMY_COLORS.text.primary,
          bgcolor: '#ffffff',
          borderRadius: 1.5,
          px: 2,
          py: 1,
          '&:hover': {
            borderColor: TAXONOMY_COLORS.text.secondary,
            bgcolor: '#ffffff',
          },
        }}
      >
        {TAXONOMY_TEXT.buttons.addTheme}
      </Button>

      <Button
        variant="contained"
        startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
        onClick={onSuggestFromDocs}
        disabled={isSuggestDisabled}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          bgcolor: TAXONOMY_COLORS.purple.main,
          color: '#ffffff',
          borderRadius: 1.5,
          px: 2.5,
          py: 1,
          boxShadow: 'none',
          '&:hover': {
            bgcolor: TAXONOMY_COLORS.purple.hover,
            boxShadow: `0 4px 12px ${TAXONOMY_COLORS.purple.border}`,
          },
          '&:disabled': {
            bgcolor: TAXONOMY_COLORS.border.default,
            color: '#ffffff',
          },
        }}
      >
        {TAXONOMY_TEXT.buttons.suggestFromDocs}
      </Button>
    </Box>
  );
}
