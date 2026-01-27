/**
 * TaxonomyHeader Component
 * Action buttons for theme management
 * Note: Title/subtitle are rendered by parent OnboardingPage
 */

import { Box, Button } from '@mui/material';
import { Add as AddIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

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
  const colors = useTaxonomyColors();

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
          borderColor: colors.border.default,
          color: colors.text.primary,
          bgcolor: colors.background.card,
          borderRadius: 1.5,
          px: 2,
          py: 1,
          '&:hover': {
            borderColor: colors.text.secondary,
            bgcolor: colors.background.card,
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
          bgcolor: colors.purple.main,
          color: '#ffffff',
          borderRadius: 1.5,
          px: 2.5,
          py: 1,
          boxShadow: 'none',
          '&:hover': {
            bgcolor: colors.purple.hover,
            boxShadow: `0 4px 12px ${colors.purple.border}`,
          },
          '&:disabled': {
            bgcolor: colors.border.default,
            color: '#ffffff',
          },
        }}
      >
        {TAXONOMY_TEXT.buttons.suggestFromDocs}
      </Button>
    </Box>
  );
}
