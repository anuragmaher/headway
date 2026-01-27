/**
 * EmptyState Component
 * Displayed when no themes have been added yet
 */

import { Box, Typography } from '@mui/material';
import { Description as DescriptionIcon } from '@mui/icons-material';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

export function EmptyState(): JSX.Element {
  const colors = useTaxonomyColors();

  return (
    <Box
      sx={{
        bgcolor: colors.background.card,
        borderRadius: 2,
        border: `1px solid ${colors.border.light}`,
        py: 6,
        px: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 2,
          bgcolor: colors.background.hover,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <DescriptionIcon
          sx={{
            fontSize: 28,
            color: colors.text.muted,
          }}
        />
      </Box>

      <Typography
        sx={{
          fontWeight: 600,
          fontSize: '1rem',
          color: colors.text.primary,
          mb: 0.5,
        }}
      >
        {TAXONOMY_TEXT.emptyState.title}
      </Typography>

      <Typography
        sx={{
          fontSize: '0.875rem',
          color: colors.text.secondary,
          textAlign: 'center',
        }}
      >
        {TAXONOMY_TEXT.emptyState.description}
      </Typography>
    </Box>
  );
}
