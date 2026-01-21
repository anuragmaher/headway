/**
 * ChecklistItem Component
 * Individual row in the onboarding checklist
 * Shows step title, description, and completion state
 */

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import type { ChecklistItemProps } from './types';

export function ChecklistItem({ step, onClick }: ChecklistItemProps): JSX.Element {
  const theme = useTheme();
  const { title, description, isComplete } = step;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
      }}
    >
      {/* Completion indicator */}
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
          backgroundColor: isComplete
            ? theme.palette.success.main
            : 'transparent',
          border: isComplete
            ? 'none'
            : 'none', // No border/circle for incomplete steps per requirements
          transition: 'all 0.2s ease',
        }}
      >
        {isComplete && (
          <CheckIcon
            sx={{
              fontSize: 14,
              color: '#fff',
            }}
          />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: isComplete
              ? theme.palette.text.secondary
              : theme.palette.text.primary,
            textDecoration: isComplete ? 'line-through' : 'none',
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.75rem',
            lineHeight: 1.4,
            display: 'block',
            mt: 0.25,
          }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
