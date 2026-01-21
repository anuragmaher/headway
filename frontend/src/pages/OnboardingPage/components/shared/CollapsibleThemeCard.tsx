/**
 * CollapsibleThemeCard Component
 * Expandable theme card for taxonomy display
 * Light mode design for split-layout onboarding
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

  return (
    <Box
      sx={{
        mb: 1,
        borderRadius: 1,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: selected ? '#2563eb' : '#e2e8f0',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: selected ? '#2563eb' : '#cbd5e1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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
            color: '#cbd5e1',
            '&.Mui-checked': {
              color: '#2563eb',
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
                color: selected ? '#1d4ed8' : '#1e293b',
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
              color: '#64748b',
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
              color: '#94a3b8',
              '&:hover': {
                bgcolor: '#f1f5f9',
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
            bgcolor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
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
                borderBottom: idx < theme.sub_themes.length - 1 ? '1px solid #e2e8f0' : 'none',
              }}
            >
              <Typography sx={{ fontWeight: 500, fontSize: '0.7rem', color: '#1e293b' }}>
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
