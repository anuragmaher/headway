/**
 * AIInsightsProgressIndicator - Global floating progress indicator
 *
 * Displays workspace-level AI insights processing progress.
 * Positioned in bottom-right corner, dismissible by user.
 *
 * UX Copy Rules (per spec):
 * - Allowed: "Analyzing messages...", "Processing feedback...", "Insights ready"
 * - Forbidden: Never use "AI is thinking", "Learning from your data", "Training"
 */

import { Box, Paper, Typography, IconButton, LinearProgress, alpha, useTheme, Fade } from '@mui/material';
import { Close as CloseIcon, AutoAwesome as InsightsIcon, CheckCircle as DoneIcon } from '@mui/icons-material';
import { useAIInsightsStore, selectShouldShowProgress, selectProgressPercent, selectIsProcessing } from '@/shared/store/AllMessagesStore';

interface AIInsightsProgressIndicatorProps {
  /** Custom position offset from bottom-right */
  offsetBottom?: number;
  offsetRight?: number;
}

/**
 * Get display text based on progress state
 * Uses approved UX copy only
 */
function getProgressText(
  percentComplete: number,
  pendingCount: number,
  processingCount: number,
  completedCount: number
): string {
  if (percentComplete === 100 && pendingCount === 0 && processingCount === 0) {
    return 'Insights ready';
  }

  if (processingCount > 0) {
    return 'Analyzing messages...';
  }

  if (pendingCount > 0) {
    return 'Processing feedback...';
  }

  return `${completedCount} messages analyzed`;
}

/**
 * Get subtitle text with counts
 */
function getSubtitleText(
  completedCount: number,
  totalEligible: number,
  percentComplete: number
): string {
  if (percentComplete === 100) {
    return `All ${completedCount} messages complete`;
  }

  return `${completedCount} of ${totalEligible} messages`;
}

export function AIInsightsProgressIndicator({
  offsetBottom = 24,
  offsetRight = 24,
}: AIInsightsProgressIndicatorProps): JSX.Element | null {
  const theme = useTheme();

  // Get state from store
  const progress = useAIInsightsStore((state) => state.progress);
  const shouldShow = useAIInsightsStore(selectShouldShowProgress);
  const percentComplete = useAIInsightsStore(selectProgressPercent);
  const isProcessing = useAIInsightsStore(selectIsProcessing);
  const dismissProgressIndicator = useAIInsightsStore((state) => state.dismissProgressIndicator);

  // Don't render if nothing to show
  if (!progress || !shouldShow) {
    return null;
  }

  const {
    completed_count: completedCount,
    pending_count: pendingCount,
    processing_count: processingCount,
    total_eligible: totalEligible,
  } = progress;

  const progressText = getProgressText(percentComplete, pendingCount, processingCount, completedCount);
  const subtitleText = getSubtitleText(completedCount, totalEligible, percentComplete);
  const isComplete = percentComplete === 100 && pendingCount === 0 && processingCount === 0;

  return (
    <Fade in={shouldShow} timeout={300}>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: offsetBottom,
          right: offsetRight,
          zIndex: theme.zIndex.snackbar,
          minWidth: 280,
          maxWidth: 320,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: isComplete
                ? alpha(theme.palette.success.main, 0.1)
                : alpha(theme.palette.primary.main, 0.1),
              color: isComplete ? theme.palette.success.main : theme.palette.primary.main,
              flexShrink: 0,
            }}
          >
            {isComplete ? (
              <DoneIcon sx={{ fontSize: 18 }} />
            ) : (
              <InsightsIcon sx={{ fontSize: 18 }} />
            )}
          </Box>

          {/* Text */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              {progressText}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: theme.palette.text.secondary,
                lineHeight: 1.3,
              }}
            >
              {subtitleText}
            </Typography>
          </Box>

          {/* Dismiss Button */}
          <IconButton
            onClick={dismissProgressIndicator}
            size="small"
            sx={{
              color: theme.palette.text.disabled,
              p: 0.5,
              '&:hover': {
                color: theme.palette.text.secondary,
                bgcolor: alpha(theme.palette.action.hover, 0.04),
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <LinearProgress
            variant={isProcessing ? 'indeterminate' : 'determinate'}
            value={percentComplete}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: isComplete ? theme.palette.success.main : theme.palette.primary.main,
              },
            }}
          />

          {/* Percentage */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 0.75,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: theme.palette.text.disabled,
              }}
            >
              {isProcessing ? 'In progress' : isComplete ? 'Complete' : 'Queued'}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: isComplete ? theme.palette.success.main : theme.palette.primary.main,
              }}
            >
              {Math.round(percentComplete)}%
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Fade>
  );
}

export default AIInsightsProgressIndicator;
