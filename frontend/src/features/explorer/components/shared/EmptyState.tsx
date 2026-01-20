/**
 * EmptyState - Reusable empty state component for explorer columns
 */
import React from 'react';
import { Box, Typography, Button, SxProps, Theme } from '@mui/material';
import {
  FolderOpen,
  Search as SearchIcon,
  ChatBubbleOutline,
  Add as AddIcon,
} from '@mui/icons-material';

type EmptyStateVariant = 'themes' | 'subThemes' | 'feedback' | 'search' | 'filter';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  sx?: SxProps<Theme>;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateVariant, {
  icon: React.ElementType;
  defaultTitle: string;
  defaultMessage: string;
  defaultAction?: string;
}> = {
  themes: {
    icon: FolderOpen,
    defaultTitle: 'No themes yet',
    defaultMessage: 'Create your first theme to start organizing feedback',
    defaultAction: 'Create Theme',
  },
  subThemes: {
    icon: FolderOpen,
    defaultTitle: 'No sub-themes',
    defaultMessage: 'This theme has no sub-themes. Create one to categorize feedback.',
    defaultAction: 'Add Sub-theme',
  },
  feedback: {
    icon: ChatBubbleOutline,
    defaultTitle: 'No feedback',
    defaultMessage: 'This category has no feedback items yet.',
  },
  search: {
    icon: SearchIcon,
    defaultTitle: 'No results',
    defaultMessage: 'No feedback matches your search. Try different keywords.',
  },
  filter: {
    icon: SearchIcon,
    defaultTitle: 'No matches',
    defaultMessage: 'No feedback matches your current filters.',
    defaultAction: 'Clear Filters',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  sx,
}) => {
  const config = EMPTY_STATE_CONFIG[variant];
  const Icon = config.icon;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 3,
        textAlign: 'center',
        ...sx,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <Icon sx={{ fontSize: 28, color: '#9E9E9E' }} />
      </Box>

      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          mb: 0.5,
        }}
      >
        {title || config.defaultTitle}
      </Typography>

      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          maxWidth: 240,
          lineHeight: 1.5,
        }}
      >
        {message || config.defaultMessage}
      </Typography>

      {(actionLabel || config.defaultAction) && onAction && (
        <Button
          variant="text"
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={onAction}
          sx={{
            mt: 2,
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          {actionLabel || config.defaultAction}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
