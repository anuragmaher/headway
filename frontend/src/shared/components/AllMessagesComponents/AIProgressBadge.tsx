/**
 * AIProgressBadge - Inline AI processing progress indicator
 */

import {
  Box,
  CircularProgress,
  Typography,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';

interface AIProgressBadgeProps {
  progress: number;
  isProcessing: boolean;
}

export function AIProgressBadge({ progress, isProcessing }: AIProgressBadgeProps): JSX.Element | null {
  const theme = useTheme();

  // Only show when processing and not 100% complete
  if (!isProcessing || progress >= 100) {
    return null;
  }

  return (
    <Tooltip title={`AI processing: ${progress}% complete`}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <CircularProgress
          size={14}
          thickness={4}
          variant="determinate"
          value={progress}
          sx={{ color: theme.palette.primary.main }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 500,
            fontSize: '0.7rem',
            color: theme.palette.primary.main,
          }}
        >
          AI {progress}%
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default AIProgressBadge;
