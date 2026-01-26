/**
 * EmptyState Component
 * Displayed when no themes have been added yet
 */

import { Box, Typography } from '@mui/material';
import { Description as DescriptionIcon } from '@mui/icons-material';
import { TAXONOMY_COLORS, TAXONOMY_TEXT } from '../constants';

export function EmptyState(): JSX.Element {
  return (
    <Box
      sx={{
        bgcolor: TAXONOMY_COLORS.background.card,
        borderRadius: 2,
        border: `1px solid ${TAXONOMY_COLORS.border.light}`,
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
          bgcolor: TAXONOMY_COLORS.background.hover,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <DescriptionIcon
          sx={{
            fontSize: 28,
            color: TAXONOMY_COLORS.text.muted,
          }}
        />
      </Box>

      <Typography
        sx={{
          fontWeight: 600,
          fontSize: '1rem',
          color: TAXONOMY_COLORS.text.primary,
          mb: 0.5,
        }}
      >
        {TAXONOMY_TEXT.emptyState.title}
      </Typography>

      <Typography
        sx={{
          fontSize: '0.875rem',
          color: TAXONOMY_COLORS.text.secondary,
          textAlign: 'center',
        }}
      >
        {TAXONOMY_TEXT.emptyState.description}
      </Typography>
    </Box>
  );
}
