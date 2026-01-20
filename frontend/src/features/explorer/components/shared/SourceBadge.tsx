/**
 * SourceBadge - Displays the source of feedback (Slack, Gmail, Gong, etc.)
 */
import React from 'react';
import { Box, Typography, SxProps, Theme } from '@mui/material';
import {
  Tag as SlackIcon,
  Email as GmailIcon,
  Headphones as GongIcon,
  Videocam as FathomIcon,
  Chat as IntercomIcon,
  Support as ZendeskIcon,
  Edit as ManualIcon,
} from '@mui/icons-material';
import type { FeedbackSource } from '../../types';
import { SOURCE_COLORS } from '../../types';

interface SourceBadgeProps {
  source: FeedbackSource;
  showLabel?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

const SOURCE_ICONS: Record<FeedbackSource, React.ElementType> = {
  slack: SlackIcon,
  gmail: GmailIcon,
  gong: GongIcon,
  fathom: FathomIcon,
  intercom: IntercomIcon,
  zendesk: ZendeskIcon,
  manual: ManualIcon,
};

const SOURCE_LABELS: Record<FeedbackSource, string> = {
  slack: 'Slack',
  gmail: 'Gmail',
  gong: 'Gong',
  fathom: 'Fathom',
  intercom: 'Intercom',
  zendesk: 'Zendesk',
  manual: 'Manual',
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  showLabel = true,
  size = 'small',
  sx,
}) => {
  const Icon = SOURCE_ICONS[source] || ManualIcon;
  const color = SOURCE_COLORS[source] || SOURCE_COLORS.manual;
  const label = SOURCE_LABELS[source] || 'Unknown';

  const iconSize = size === 'small' ? 14 : 16;
  const fontSize = size === 'small' ? '0.6875rem' : '0.75rem';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
        }}
      >
        <Icon sx={{ fontSize: iconSize }} />
      </Box>
      {showLabel && (
        <Typography
          component="span"
          sx={{
            fontSize,
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
};

export default SourceBadge;
