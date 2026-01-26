/**
 * SuggestedThemeRow Component
 * Single AI suggestion row with Add button
 */

import { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import type { Theme } from '../../../types';
import { TAXONOMY_COLORS, TAXONOMY_TEXT } from '../constants';

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
        borderBottom: `1px solid ${TAXONOMY_COLORS.border.light}`,
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
            color: TAXONOMY_COLORS.text.primary,
            lineHeight: 1.4,
          }}
        >
          {theme.name}
        </Typography>
        {theme.description && (
          <Typography
            sx={{
              fontSize: '0.8125rem',
              color: TAXONOMY_COLORS.text.secondary,
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
              color: TAXONOMY_COLORS.purple.main,
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
            bgcolor: isAdded ? TAXONOMY_COLORS.border.default : TAXONOMY_COLORS.purple.main,
            borderRadius: 1.5,
            px: 2,
            py: 0.5,
            minWidth: 70,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: isAdded ? TAXONOMY_COLORS.border.default : TAXONOMY_COLORS.purple.hover,
            },
            '&:disabled': {
              bgcolor: TAXONOMY_COLORS.background.hover,
              color: TAXONOMY_COLORS.text.muted,
            },
          }}
        >
          {isAdded ? TAXONOMY_TEXT.aiSuggestions.addedButton : TAXONOMY_TEXT.aiSuggestions.addButton}
        </Button>
      )}
    </Box>
  );
}
