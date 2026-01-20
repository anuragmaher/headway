/**
 * TagChip - Styled chip component for feedback tags (FR, Bug, UX, etc.)
 */
import React from 'react';
import { Chip, SxProps, Theme } from '@mui/material';
import type { FeedbackTag, UrgencyLevel } from '../../types';
import { TAG_STYLES, URGENCY_COLORS } from '../../types';

interface TagChipProps {
  tag: FeedbackTag;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

interface UrgencyChipProps {
  urgency: UrgencyLevel;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

const TAG_LABELS: Record<FeedbackTag, string> = {
  FR: 'Feature',
  Bug: 'Bug',
  UX: 'UX',
  Integration: 'Integration',
  Performance: 'Perf',
  Security: 'Security',
  Pricing: 'Pricing',
  Support: 'Support',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  size = 'small',
  sx,
}) => {
  const style = TAG_STYLES[tag] || { bg: '#EEEEEE', text: '#666666' };

  return (
    <Chip
      label={TAG_LABELS[tag] || tag}
      size={size}
      sx={{
        height: size === 'small' ? 20 : 24,
        fontSize: size === 'small' ? '0.625rem' : '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        bgcolor: style.bg,
        color: style.text,
        border: 'none',
        borderRadius: 1,
        '& .MuiChip-label': {
          px: size === 'small' ? 1 : 1.25,
        },
        ...sx,
      }}
    />
  );
};

export const UrgencyChip: React.FC<UrgencyChipProps> = ({
  urgency,
  size = 'small',
  sx,
}) => {
  const color = URGENCY_COLORS[urgency] || URGENCY_COLORS.medium;

  return (
    <Chip
      label={URGENCY_LABELS[urgency] || urgency}
      size={size}
      sx={{
        height: size === 'small' ? 20 : 24,
        fontSize: size === 'small' ? '0.625rem' : '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        bgcolor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        borderRadius: 1,
        '& .MuiChip-label': {
          px: size === 'small' ? 1 : 1.25,
        },
        ...sx,
      }}
    />
  );
};

export default TagChip;
