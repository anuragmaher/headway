/**
 * AIInsightsTab component - Shows AI-extracted insights from the message
 *
 * On-Demand Architecture:
 * - AI insights are fetched when user clicks on a message
 * - Insights are cached in Redis (5 min TTL) and persisted to database
 * - Uses store-based state management for loading/error states
 */

import { Box, Typography, alpha, useTheme, Chip, CircularProgress, Button, Alert } from '@mui/material';
import {
  AutoAwesome as AIIcon,
  LocalOffer as ThemeIcon,
  Psychology as ReasoningIcon,
  Refresh as RefreshIcon,
  Memory as ExtractedIcon,
} from '@mui/icons-material';
import { MessageDetailsResponse, AIInsights, ClassifiedTheme, FeatureRequest, PainPoint } from '@/services/sources';
import { useMessageDetailsStore, AIInsightsStatus, AIInsightsSource } from '../../store';
import { FeatureRequestCard } from './FeatureRequestCard';
import { PainPointCard } from './PainPointCard';

interface AIInsightsTabProps {
  message: MessageDetailsResponse;
}

/**
 * Format confidence percentage
 */
const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
};

/**
 * Get source indicator icon and label
 * Note: 'cache' source is treated the same as 'database' - no need to show cache status to users
 */
const getSourceIndicator = (source: AIInsightsSource): { icon: React.ReactNode; label: string; color: string } | null => {
  switch (source) {
    case 'cache':
    case 'database':
      // Don't show indicator for cached/persisted data - it's expected behavior
      return null;
    case 'extracted':
      return { icon: <ExtractedIcon sx={{ fontSize: 12 }} />, label: 'Just Analyzed', color: 'primary.main' };
    default:
      return null;
  }
};

/**
 * Section Header Component
 */
function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
      <Box sx={{ color: theme.palette.text.disabled, display: 'flex' }}>{icon}</Box>
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: theme.palette.text.disabled,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Loading State Component
 */
function LoadingState(): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 6,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={32} thickness={4} sx={{ color: theme.palette.primary.main }} />
      <Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: '0.85rem', fontWeight: 500 }}
        >
          Analyzing message...
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
          Extracting AI insights
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Error State Component
 */
function ErrorState({
  error,
  onRetry
}: {
  error: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Alert
        severity="error"
        sx={{ mb: 2, fontSize: '0.8rem' }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={onRetry}
            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    </Box>
  );
}

/**
 * No Insights State Component
 */
function NoInsightsState(): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 6,
        textAlign: 'center',
      }}
    >
      <AIIcon
        sx={{
          fontSize: 40,
          color: alpha(theme.palette.text.secondary, 0.15),
          mb: 1.5,
        }}
      />
      <Typography
        variant="body2"
        color="text.disabled"
        sx={{ fontSize: '0.85rem', fontWeight: 500 }}
      >
        No actionable insights found
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
        This message doesn't contain feature requests or pain points
      </Typography>
    </Box>
  );
}

/**
 * Classified Themes Section
 */
function ClassifiedThemesSection({ themes }: { themes: ClassifiedTheme[] }): JSX.Element | null {
  const theme = useTheme();

  if (!themes || themes.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader icon={<ThemeIcon sx={{ fontSize: 14 }} />} label="Classified Themes" />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {themes.map((themeItem, index) => (
          <Chip
            key={index}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span style={{ color: theme.palette.primary.main, fontWeight: 500 }}>
                  {themeItem.name}
                </span>
                <span
                  style={{
                    color: theme.palette.text.disabled,
                    fontSize: '0.7rem',
                  }}
                >
                  {formatConfidence(themeItem.confidence)}
                </span>
              </Box>
            }
            size="small"
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              '& .MuiChip-label': {
                px: 1.5,
              },
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.12),
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * Classification Reasoning Section
 */
function ReasoningSection({ reasoning }: { reasoning: string }): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader icon={<ReasoningIcon sx={{ fontSize: 14 }} />} label="Why This Classification?" />
      <Box
        sx={{
          p: 1.5,
          bgcolor: alpha(theme.palette.info.main, 0.04),
          borderRadius: 1.5,
          borderLeft: `2px solid ${alpha(theme.palette.info.main, 0.3)}`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.7,
          }}
        >
          {reasoning}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Summary Section
 */
function SummarySection({ summary }: { summary: string }): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader icon={<AIIcon sx={{ fontSize: 14 }} />} label="Summary" />
      <Box
        sx={{
          p: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          borderRadius: 1.5,
          borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.7,
          }}
        >
          {summary}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Source Indicator Badge - Only shown for newly extracted insights
 */
function SourceBadge({ source }: { source: AIInsightsSource }): JSX.Element | null {
  const theme = useTheme();

  if (!source || source === 'error') return null;

  const indicator = getSourceIndicator(source);

  // Don't show badge for cached/database sources
  if (!indicator) return null;

  const { icon, label, color } = indicator;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: alpha(theme.palette[color.split('.')[0] as 'success' | 'info' | 'warning' | 'primary'].main, 0.08),
        color: theme.palette[color.split('.')[0] as 'success' | 'info' | 'warning' | 'primary'].main,
        fontSize: '0.65rem',
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/**
 * Insights Content Component - Renders the actual insights
 */
function InsightsContent({
  insights,
  source
}: {
  insights: AIInsights;
  source: AIInsightsSource;
}): JSX.Element {
  const classifiedThemes = insights.classified_themes || [];
  const featureRequests = insights.feature_requests || [];
  const painPoints = insights.pain_points || [];
  const reasoning = insights.classification_reasoning || insights.summary;

  const hasAnyInsights =
    classifiedThemes.length > 0 ||
    featureRequests.length > 0 ||
    painPoints.length > 0 ||
    reasoning;

  // Check if insights were skipped (e.g., content too short)
  const wasSkipped = insights.extraction_metadata?.skipped;
  const skipReason = insights.extraction_metadata?.skip_reason;

  if (wasSkipped) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem' }}>
          Analysis skipped: {skipReason === 'content_too_short'
            ? 'Message content is too short'
            : skipReason || 'Not enough content to analyze'}
        </Typography>
      </Box>
    );
  }

  if (!hasAnyInsights) {
    return <NoInsightsState />;
  }

  return (
    <Box>
      {/* Source Badge */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <SourceBadge source={source} />
      </Box>

      {/* Summary */}
      {insights.summary && <SummarySection summary={insights.summary} />}

      {/* Classified Themes */}
      <ClassifiedThemesSection themes={classifiedThemes} />

      {/* Why This Classification */}
      {reasoning && !insights.summary && <ReasoningSection reasoning={reasoning} />}

      {/* Feature Requests */}
      {featureRequests.map((feature, index) => (
        <Box key={`feature-${index}`} sx={{ mb: 3 }}>
          <FeatureRequestCard
            title={feature.title}
            description={feature.description}
            urgency={feature.urgency}
            quote={feature.quote}
          />
        </Box>
      ))}

      {/* Pain Points */}
      {painPoints.map((painPoint, index) => (
        <Box key={`pain-${index}`} sx={{ mb: 3 }}>
          <PainPointCard
            title={painPoint.description?.split('.')[0]}
            description={painPoint.description}
            severity={painPoint.severity}
            quote={painPoint.quote}
          />
        </Box>
      ))}
    </Box>
  );
}

export function AIInsightsTab({ message }: AIInsightsTabProps): JSX.Element {
  const {
    aiInsights,
    aiInsightsStatus,
    aiInsightsSource,
    aiInsightsError,
    fetchAIInsights,
  } = useMessageDetailsStore();

  // Handle retry with force refresh
  const handleRetry = () => {
    // We need the workspace ID to retry - get it from somewhere
    // For now, we'll use the message's workspace context
    const workspaceId = localStorage.getItem('selectedWorkspaceId') || '';
    if (workspaceId && message.id) {
      fetchAIInsights(workspaceId, message.id, true);
    }
  };

  // Loading state
  if (aiInsightsStatus === 'loading') {
    return <LoadingState />;
  }

  // Error state
  if (aiInsightsStatus === 'error') {
    return <ErrorState error={aiInsightsError || 'Failed to load AI insights'} onRetry={handleRetry} />;
  }

  // Success state with insights
  if (aiInsightsStatus === 'success' && aiInsights) {
    return <InsightsContent insights={aiInsights} source={aiInsightsSource} />;
  }

  // Idle state (shouldn't normally happen, but fallback to legacy behavior)
  // This handles the case where message.ai_insights exists from the database
  if (message.ai_insights) {
    const legacyInsights = message.ai_insights as AIInsights;
    return <InsightsContent insights={legacyInsights} source="database" />;
  }

  // No insights available
  return <NoInsightsState />;
}

export default AIInsightsTab;
