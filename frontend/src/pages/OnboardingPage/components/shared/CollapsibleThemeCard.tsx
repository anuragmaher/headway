/**
 * CollapsibleThemeCard Component
 * Expandable theme card for taxonomy display
 * Supports light and dark mode
 */

import { useState } from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { Theme } from '../../types';
import { ConfidenceScore } from './ConfidenceScore';
import { useOnboardingColors } from '../../hooks/useOnboardingColors';

interface CollapsibleThemeCardProps {
  theme: Theme;
  selected: boolean;
  onToggle: () => void;
}

export function CollapsibleThemeCard({
  theme,
  selected,
  onToggle,
}: CollapsibleThemeCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasSubThemes = theme.sub_themes && theme.sub_themes.length > 0;
  const colors = useOnboardingColors();

  return (
    <Box
      sx={{
        mb: 1,
        borderRadius: 1,
        bgcolor: colors.background.paper,
        border: '1px solid',
        borderColor: selected ? colors.primary.main : colors.border.input,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: selected ? colors.primary.main : colors.border.default,
          boxShadow: colors.shadow.card,
        },
      }}
    >
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
        }}
      >
        <Checkbox
          checked={selected}
          size="small"
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          sx={{
            p: 0,
            color: colors.border.default,
            '&.Mui-checked': {
              color: colors.primary.main,
            },
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: selected ? colors.chip.selected.text : colors.text.primary,
              }}
              noWrap
            >
              {theme.name}
            </Typography>
            <ConfidenceScore score={theme.confidence} size="small" />
          </Box>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: colors.text.secondary,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {theme.description}
          </Typography>
        </Box>

        {hasSubThemes && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              p: 0.25,
              color: colors.text.muted,
              '&:hover': {
                bgcolor: colors.background.hover,
              },
            }}
          >
            {expanded ? (
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            px: 1.5,
            py: 1,
            pl: 5,
            bgcolor: colors.background.subtle,
            borderTop: `1px solid ${colors.border.input}`,
          }}
        >
          {theme.sub_themes?.map((sub, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
                borderBottom: idx < theme.sub_themes.length - 1 ? `1px solid ${colors.border.input}` : 'none',
              }}
            >
              <Typography sx={{ fontWeight: 500, fontSize: '0.7rem', color: colors.text.primary }}>
                {sub.name}
              </Typography>
              <ConfidenceScore score={sub.confidence} size="small" />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
