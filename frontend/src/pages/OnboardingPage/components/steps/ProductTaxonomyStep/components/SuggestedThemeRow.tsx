/**
 * SuggestedThemeRow Component
 * Single AI suggestion row with Add button
 */

import { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import type { Theme } from '../../../types';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface SuggestedThemeRowProps {
  theme: Theme;
  onAdd: () => void;
  isAdded: boolean;
}

export function SuggestedThemeRow({
  theme,
  onAdd,
  isAdded,
}: SuggestedThemeRowProps): JSX.Element {
  const colors = useTaxonomyColors();
  const [isHovered, setIsHovered] = useState(false);

  const subthemeCount = theme.sub_themes?.length || 0;

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        px: 2,
        borderBottom: `1px solid ${colors.border.light}`,
        transition: 'background-color 0.15s ease',
        '&:last-child': {
          borderBottom: 'none',
        },
        '&:hover': {
          bgcolor: 'rgba(124, 58, 237, 0.04)',
        },
      }}
    >
      <Box sx={{ flex: 1, mr: 2 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '0.9375rem',
            color: colors.text.primary,
            lineHeight: 1.4,
          }}
        >
          {theme.name}
        </Typography>
        {theme.description && (
          <Typography
            sx={{
              fontSize: '0.8125rem',
              color: colors.text.secondary,
              lineHeight: 1.4,
              mt: 0.25,
            }}
          >
            {theme.description}
          </Typography>
        )}
        {subthemeCount > 0 && (
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: colors.purple.main,
              fontWeight: 500,
              mt: 0.5,
            }}
          >
            {subthemeCount} {TAXONOMY_TEXT.aiSuggestions.subthemesIncluded}
          </Typography>
        )}
      </Box>

      {(isHovered || isAdded) && (
        <Button
          variant="contained"
          size="small"
          onClick={onAdd}
          disabled={isAdded}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
            bgcolor: isAdded ? colors.border.default : colors.purple.main,
            borderRadius: 1.5,
            px: 2,
            py: 0.5,
            minWidth: 70,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: isAdded ? colors.border.default : colors.purple.hover,
            },
            '&:disabled': {
              bgcolor: colors.background.hover,
              color: colors.text.muted,
            },
          }}
        >
          {isAdded ? TAXONOMY_TEXT.aiSuggestions.addedButton : TAXONOMY_TEXT.aiSuggestions.addButton}
        </Button>
      )}
    </Box>
  );
}
