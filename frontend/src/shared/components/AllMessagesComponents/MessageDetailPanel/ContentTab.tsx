/**
 * ContentTab component - Shows source-specific content
 *
 * Displays different content layouts based on source type:
 * - Email: Subject, from/to, content
 * - Gong/Fathom: Call info, transcript
 * - Slack: Channel, message content
 */

import { Box, Typography, alpha, useTheme, Chip, Divider, Link, CircularProgress, Theme } from '@mui/material';
import {
  Email as EmailIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Folder as FolderIcon,
  AccessTime as DurationIcon,
  Group as ParticipantsIcon,
  Business as CustomerIcon,
  Link as LinkIcon,
  Videocam as GongIcon,
  Headphones as FathomIcon,
  Tag as SlackIcon,
  AutoAwesome as InsightsIcon,
  Lightbulb as FeatureIcon,
  ReportProblem as PainPointIcon,
  SentimentSatisfied as PositiveIcon,
  SentimentNeutral as NeutralIcon,
  SentimentDissatisfied as NegativeIcon,
  FormatQuote as QuoteIcon,
  WorkOutline as UseCaseIcon,
} from '@mui/icons-material';
import { MessageDetailsResponse, PartyInfo } from '@/services/sources';
import { useMessageDetailsStore } from '@/shared/store/AllMessagesStore';

interface ContentTabProps {
  message: MessageDetailsResponse;
}

/**
 * Format date/time for display
 */
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Unknown date';
  }
};

/**
 * Info row component for metadata display
 */
function InfoRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  color?: string;
}): JSX.Element | null {
  const theme = useTheme();

  if (!value) return null;

  const isStringValue = typeof value === 'string';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Box
        sx={{
          color: color || theme.palette.text.secondary,
          display: 'flex',
          alignItems: 'center',
          mt: 0.25,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            display: 'block',
          }}
        >
          {label}
        </Typography>
        {isStringValue ? (
          <Typography
            variant="body2"
            component="span"
            sx={{ fontSize: '0.8rem', mt: 0.25, display: 'block', wordBreak: 'break-word' }}
          >
            {value}
          </Typography>
        ) : (
          <Box sx={{ fontSize: '0.8rem', mt: 0.25 }}>{value}</Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Get source icon based on source type
 */
const getSourceIcon = (source: string) => {
  switch (source) {
    case 'gmail':
    case 'outlook':
      return <EmailIcon sx={{ fontSize: 16 }} />;
    case 'gong':
      return <GongIcon sx={{ fontSize: 16 }} />;
    case 'fathom':
      return <FathomIcon sx={{ fontSize: 16 }} />;
    case 'slack':
      return <SlackIcon sx={{ fontSize: 16 }} />;
    default:
      return <EmailIcon sx={{ fontSize: 16 }} />;
  }
};

/**
 * Get source color
 */
const getSourceColor = (source: string, theme: ReturnType<typeof useTheme>) => {
  switch (source) {
    case 'gmail':
      return theme.palette.error.main;
    case 'outlook':
      return theme.palette.info.main;
    case 'gong':
      return theme.palette.secondary.main;
    case 'fathom':
      return theme.palette.success.main;
    case 'slack':
      return '#E01E5A';
    default:
      return theme.palette.primary.main;
  }
};

/**
 * Email Content Component
 */
function EmailContent({ message }: { message: MessageDetailsResponse }): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      {/* Email Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.background.default, 0.5),
          borderRadius: 1.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          mb: 2,
        }}
      >
        <InfoRow
          icon={<PersonIcon sx={{ fontSize: 16 }} />}
          label="From"
          value={
            <>
              <Typography
                variant="body2"
                component="span"
                sx={{ fontSize: '0.8rem', fontWeight: 500, display: 'block' }}
              >
                {message.sender}
              </Typography>
              {message.sender_email && message.sender_email !== message.sender && (
                <Typography
                  variant="caption"
                  component="span"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem', display: 'block' }}
                >
                  {message.sender_email}
                </Typography>
              )}
            </>
          }
        />

        {message.to_emails && message.to_emails.length > 0 && (
          <InfoRow
            icon={<PersonIcon sx={{ fontSize: 16 }} />}
            label="To"
            value={message.to_emails.join(', ')}
          />
        )}

        <InfoRow
          icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
          label="Date"
          value={formatDateTime(message.sent_at)}
        />

        {message.channel_name && (
          <InfoRow
            icon={<FolderIcon sx={{ fontSize: 16 }} />}
            label="Label/Folder"
            value={message.channel_name}
          />
        )}

        {message.message_count && message.message_count > 1 && (
          <InfoRow
            icon={<EmailIcon sx={{ fontSize: 16 }} />}
            label="Messages in thread"
            value={`${message.message_count} messages`}
          />
        )}
      </Box>

      {/* Email Body */}
      <Box>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', mb: 1, display: 'block' }}
        >
          Email Content
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 1.5,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            maxHeight: 350,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.divider, 0.3),
              borderRadius: 3,
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.7,
              color: theme.palette.text.secondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content || 'No content available'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Call Content Component (Gong/Fathom)
 */
function CallContent({ message }: { message: MessageDetailsResponse }): JSX.Element {
  const theme = useTheme();
  const sourceColor = getSourceColor(message.source, theme);

  return (
    <Box>
      {/* Call Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.background.default, 0.5),
          borderRadius: 1.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          mb: 2,
        }}
      >
        {message.duration_formatted && (
          <InfoRow
            icon={<DurationIcon sx={{ fontSize: 16 }} />}
            label="Duration"
            value={message.duration_formatted}
          />
        )}

        <InfoRow
          icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
          label="Date"
          value={formatDateTime(message.sent_at)}
        />

        {message.customer_info && (
          <InfoRow
            icon={<CustomerIcon sx={{ fontSize: 16 }} />}
            label="Customer"
            value={
              <>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ fontSize: '0.8rem', display: 'block' }}
                >
                  {message.customer_info.name}
                </Typography>
                {message.customer_info.email && (
                  <Typography
                    variant="caption"
                    component="span"
                    color="text.secondary"
                    sx={{ fontSize: '0.7rem', display: 'block' }}
                  >
                    {message.customer_info.email}
                  </Typography>
                )}
              </>
            }
          />
        )}

        {message.recording_url && (
          <InfoRow
            icon={<LinkIcon sx={{ fontSize: 16 }} />}
            label="Recording"
            value={
              <Link
                href={message.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: '0.8rem',
                  color: theme.palette.primary.main,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                View Recording
              </Link>
            }
          />
        )}
      </Box>

      {/* Participants */}
      {((message.participants && message.participants.length > 0) ||
        (message.parties && message.parties.length > 0)) && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ParticipantsIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Participants
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {message.participants?.map((participant, idx) => {
              const label =
                typeof participant === 'string'
                  ? participant
                  : (participant as PartyInfo)?.name ||
                    (participant as PartyInfo)?.email ||
                    'Unknown';
              return (
                <Chip
                  key={`p-${idx}`}
                  label={label}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    bgcolor: alpha(sourceColor, 0.1),
                    color: sourceColor,
                  }}
                />
              );
            })}
            {message.parties?.map((party, idx) => {
              const partyObj = party as PartyInfo;
              const label = partyObj?.name || partyObj?.email || 'Unknown';
              return (
                <Chip
                  key={`party-${idx}`}
                  label={label}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    bgcolor: alpha(sourceColor, 0.1),
                    color: sourceColor,
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Transcript */}
      <Box>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', mb: 1, display: 'block' }}
        >
          Transcript
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 1.5,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            maxHeight: 350,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.divider, 0.3),
              borderRadius: 3,
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.7,
              color: theme.palette.text.secondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content || 'No transcript available'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Slack Content Component
 */
function SlackContent({ message }: { message: MessageDetailsResponse }): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      {/* Slack Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.background.default, 0.5),
          borderRadius: 1.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          mb: 2,
        }}
      >
        <InfoRow
          icon={<PersonIcon sx={{ fontSize: 16 }} />}
          label="Author"
          value={
            <>
              <Typography
                variant="body2"
                component="span"
                sx={{ fontSize: '0.8rem', fontWeight: 500, display: 'block' }}
              >
                {message.sender}
              </Typography>
              {message.sender_email && (
                <Typography
                  variant="caption"
                  component="span"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem', display: 'block' }}
                >
                  {message.sender_email}
                </Typography>
              )}
            </>
          }
        />

        {message.channel_name && (
          <InfoRow
            icon={<FolderIcon sx={{ fontSize: 16 }} />}
            label="Channel"
            value={`#${message.channel_name}`}
          />
        )}

        <InfoRow
          icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
          label="Posted"
          value={formatDateTime(message.sent_at)}
        />
      </Box>

      {/* Message Content */}
      <Box>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', mb: 1, display: 'block' }}
        >
          Message Content
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 1.5,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            maxHeight: 350,
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.divider, 0.3),
              borderRadius: 3,
            },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.7,
              color: theme.palette.text.secondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content || 'No content available'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Get sentiment icon based on sentiment value
 */
const getSentimentIcon = (sentiment: string | null) => {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
      return <PositiveIcon sx={{ fontSize: 14 }} />;
    case 'negative':
      return <NegativeIcon sx={{ fontSize: 14 }} />;
    default:
      return <NeutralIcon sx={{ fontSize: 14 }} />;
  }
};

/**
 * Get sentiment color based on sentiment value
 */
const getSentimentColor = (sentiment: string | null, theme: Theme): string => {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
      return theme.palette.success.main;
    case 'negative':
      return theme.palette.error.main;
    default:
      return theme.palette.text.secondary;
  }
};

/**
 * AIInsightsTab - Dedicated tab for AI-generated insights
 * Shows Summary, Pain Point with Quote, Feature Request, Use Case, and Keywords
 */
export function AIInsightsTab(): JSX.Element {
  const theme = useTheme();
  const { aiInsights, isLoadingInsights } = useMessageDetailsStore();

  // Loading state
  if (isLoadingInsights) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1.5, fontSize: '0.85rem', color: theme.palette.text.secondary }}>
          Loading insights...
        </Typography>
      </Box>
    );
  }

  // No insights available
  if (!aiInsights || aiInsights.status !== 'completed') {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <InsightsIcon sx={{ fontSize: 40, color: theme.palette.text.disabled, mb: 1 }} />
        <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
          No AI insights available for this message
        </Typography>
      </Box>
    );
  }

  const { summary, pain_point, pain_point_quote, feature_request, customer_usecase, sentiment, keywords } = aiInsights;
  const sentimentColor = getSentimentColor(sentiment, theme);

  return (
    <Box>
      {/* Header with AI Insights label and Sentiment Badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <InsightsIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: theme.palette.primary.main,
            }}
          >
            AI INSIGHTS
          </Typography>
        </Box>
        {sentiment && (
          <Chip
            icon={getSentimentIcon(sentiment)}
            label={sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: alpha(sentimentColor, 0.1),
              color: sentimentColor,
              borderRadius: 1,
              '& .MuiChip-icon': { color: sentimentColor, ml: 0.5 },
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Summary */}
      {summary && (
        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: theme.palette.text.disabled,
              fontWeight: 600,
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Summary
          </Typography>
          <Typography
            sx={{
              fontSize: '0.85rem',
              lineHeight: 1.7,
              color: theme.palette.text.primary,
            }}
          >
            {summary}
          </Typography>
        </Box>
      )}

      {/* Pain Point */}
      {pain_point && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <PainPointIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: theme.palette.warning.main,
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              Pain Point
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: theme.palette.text.primary,
            }}
          >
            {pain_point}
          </Typography>
          {/* Pain Point Quote */}
          {pain_point_quote && (
            <Box
              sx={{
                mt: 1,
                pl: 1.5,
                borderLeft: `2px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  color: theme.palette.text.secondary,
                  fontStyle: 'italic',
                }}
              >
                "{pain_point_quote}"
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Feature Request */}
      {feature_request && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <FeatureIcon sx={{ fontSize: 14, color: theme.palette.info.main }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: theme.palette.info.main,
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              Feature Request
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: theme.palette.text.primary,
            }}
          >
            {feature_request}
          </Typography>
        </Box>
      )}

      {/* Use Case */}
      {customer_usecase && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <UseCaseIcon sx={{ fontSize: 14, color: theme.palette.secondary.main }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: theme.palette.secondary.main,
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              Use Case
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: theme.palette.text.primary,
            }}
          >
            {customer_usecase}
          </Typography>
        </Box>
      )}

      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: theme.palette.text.disabled,
              fontWeight: 600,
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Keywords
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {keywords.map((keyword, idx) => (
              <Chip
                key={idx}
                label={keyword}
                size="small"
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  borderColor: alpha(theme.palette.divider, 0.3),
                  color: theme.palette.text.secondary,
                  borderRadius: 0.75,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * ContentTab - Shows source-specific content (Transcript/Message tab)
 */
export function ContentTab({ message }: ContentTabProps): JSX.Element {
  // Render source-specific content
  switch (message.source) {
    case 'gmail':
    case 'outlook':
      return <EmailContent message={message} />;
    case 'gong':
    case 'fathom':
      return <CallContent message={message} />;
    case 'slack':
      return <SlackContent message={message} />;
    default:
      // Fallback to email layout
      return <EmailContent message={message} />;
  }
}

export default ContentTab;
