/**
 * ContentTab component - Shows source-specific content
 *
 * Displays different content layouts based on source type:
 * - Email: Subject, from/to, content
 * - Gong/Fathom: Call info, transcript
 * - Slack: Channel, message content
 */

import { Box, Typography, alpha, useTheme, Chip, Divider, Link, CircularProgress, Theme, Paper, Grid } from '@mui/material';
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
  Lightbulb as LightbulbIcon,
  ReportProblem as PainPointIcon,
  SentimentSatisfied as SentimentSatisfiedIcon,
  SentimentNeutral as SentimentNeutralIcon,
  SentimentDissatisfied as SentimentDissatisfiedIcon,
  FormatQuote as QuoteIcon,
  WorkOutline as UseCaseIcon,
  AccountTree as HierarchyIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MessageDetailsResponse, PartyInfo, LinkedCustomerAskInfo, FeatureMapping, SpeakerInfo } from '@/services/sources';
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
 * Get sentiment icon based on sentiment value (numeric)
 */
const getSentimentIcon = (sentiment?: number) => {
  if (sentiment === undefined || sentiment === null) return null;
  if (sentiment > 0.3) return <SentimentSatisfiedIcon sx={{ fontSize: 18 }} />;
  if (sentiment < -0.3) return <SentimentDissatisfiedIcon sx={{ fontSize: 18 }} />;
  return <SentimentNeutralIcon sx={{ fontSize: 18 }} />;
};

/**
 * Get risk color based on risk level
 */
const getRiskColor = (risk: string | undefined, theme: Theme): string => {
  const riskLower = risk?.toLowerCase() || '';
  if (riskLower === 'low') return theme.palette.success.main;
  if (riskLower === 'medium') return theme.palette.warning.main;
  if (riskLower === 'high') return theme.palette.error.main;
  return theme.palette.text.secondary;
};

/**
 * AIInsightsTab - Dedicated tab for AI-generated Key Insights
 * Shows Key Insights, Risk Assessment, Customer Metadata, Speakers, and Feature Mappings
 */
export function AIInsightsTab(): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
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
          {aiInsights?.status === 'processing' ? 'AI insights are being processed...' :
           aiInsights?.status === 'pending' ? 'AI insights are pending...' :
           aiInsights?.status === 'failed' ? 'AI insights processing failed' :
           'No AI insights available for this transcript'}
        </Typography>
      </Box>
    );
  }

  const keyInsights = aiInsights.key_insights || {};
  const riskAssessment = aiInsights.risk_assessment || {};
  const customerMetadata = aiInsights.customer_metadata || {};
  const speakers = aiInsights.speakers || [];
  const callMetadata = aiInsights.call_metadata || {};
  const mappings = aiInsights.mappings || [];

  const hasKeyInsights = Object.keys(keyInsights).length > 0;
  const hasRiskAssessment = Object.keys(riskAssessment).length > 0;
  const hasCustomerMetadata = Object.keys(customerMetadata).length > 0;

  return (
    <Box>
      {/* Key Insights Section */}
      {hasKeyInsights && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={1.5}>
            {/* Strongest Needs */}
            {keyInsights.strongest_needs && Array.isArray(keyInsights.strongest_needs) && keyInsights.strongest_needs.length > 0 && (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <LightbulbIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Strongest Needs
                    </Typography>
                  </Box>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {keyInsights.strongest_needs.map((need: string, idx: number) => (
                      <li key={idx}>
                        <Typography variant="body2" color="text.primary" sx={{ mb: 0.25, fontSize: '0.8rem' }}>
                          {need}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* Health Signals */}
            {keyInsights.health_signals && (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Health Signals
                    </Typography>
                  </Box>
                  {keyInsights.health_signals.positive && Array.isArray(keyInsights.health_signals.positive) && keyInsights.health_signals.positive.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        Positive
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {keyInsights.health_signals.positive.map((signal: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={signal}
                            size="small"
                            sx={{
                              height: 22,
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: 'success.main',
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {keyInsights.health_signals.negative && Array.isArray(keyInsights.health_signals.negative) && keyInsights.health_signals.negative.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="error.main" sx={{ fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        Negative
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {keyInsights.health_signals.negative.map((signal: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={signal}
                            size="small"
                            sx={{
                              height: 22,
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                              color: 'error.main',
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Grid>
            )}

            {/* Blockers */}
            {keyInsights.blockers && Array.isArray(keyInsights.blockers) && keyInsights.blockers.length > 0 && (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.error.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                    borderRadius: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <WarningIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main', fontSize: '0.8rem' }}>
                      Blockers
                    </Typography>
                  </Box>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {keyInsights.blockers.map((blocker: string, idx: number) => (
                      <li key={idx}>
                        <Typography variant="body2" color="error.main" sx={{ fontSize: '0.8rem' }}>
                          {blocker}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* Product Feedback */}
            {keyInsights.product_feedback_for_pm && (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                    borderRadius: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75, color: 'info.main', fontSize: '0.8rem' }}>
                    Product Feedback for PM
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.8rem' }}>
                    {keyInsights.product_feedback_for_pm}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Risk Assessment Section */}
      {hasRiskAssessment && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AssessmentIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem' }}>
              Risk Assessment
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            {riskAssessment.deal_risk && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Deal Risk
                </Typography>
                <Chip
                  label={riskAssessment.deal_risk}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: alpha(getRiskColor(riskAssessment.deal_risk, theme), 0.1),
                    color: getRiskColor(riskAssessment.deal_risk, theme),
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            )}

            {riskAssessment.churn_risk && riskAssessment.churn_risk !== 'n/a' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Churn Risk
                </Typography>
                <Chip
                  label={riskAssessment.churn_risk}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: alpha(getRiskColor(riskAssessment.churn_risk, theme), 0.1),
                    color: getRiskColor(riskAssessment.churn_risk, theme),
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            )}

            {riskAssessment.expansion_signal && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Expansion Signal
                </Typography>
                <Chip
                  label={riskAssessment.expansion_signal}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: alpha(getRiskColor(riskAssessment.expansion_signal, theme), 0.1),
                    color: getRiskColor(riskAssessment.expansion_signal, theme),
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            )}

            {riskAssessment.customer_type && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Customer Type
                </Typography>
                <Chip
                  label={riskAssessment.customer_type}
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: 'info.main',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Customer Metadata Section */}
      {hasCustomerMetadata && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BusinessIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem' }}>
              Customer Information
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              borderRadius: 1.5,
            }}
          >
            <Grid container spacing={1.5}>
              {customerMetadata.company_name && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.65rem' }}>
                    Company Name
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                    {customerMetadata.company_name}
                  </Typography>
                </Grid>
              )}
              {customerMetadata.company_stage && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.65rem' }}>
                    Company Stage
                  </Typography>
                  <Chip
                    label={customerMetadata.company_stage.toUpperCase()}
                    size="small"
                    sx={{
                      height: 20,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      fontWeight: 500,
                      fontSize: '0.65rem',
                    }}
                  />
                </Grid>
              )}
              {customerMetadata.use_case && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.65rem' }}>
                    Use Case
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.8rem' }}>
                    {customerMetadata.use_case}
                  </Typography>
                </Grid>
              )}
              {customerMetadata.timeline && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.65rem' }}>
                    Timeline
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.8rem' }}>
                    {customerMetadata.timeline}
                  </Typography>
                </Grid>
              )}
              {customerMetadata.current_solution && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.65rem' }}>
                    Current Solution
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.8rem' }}>
                    {customerMetadata.current_solution}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Speakers Section */}
      {speakers.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ParticipantsIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem' }}>
              Speakers ({speakers.length})
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {speakers.map((speaker: SpeakerInfo, index: number) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 1,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 1.5,
                  minWidth: 140,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8rem' }}>
                  {speaker.name}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {speaker.email && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {speaker.email}
                    </Typography>
                  )}
                  {speaker.company && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {speaker.company}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    {speaker.role_type && (
                      <Chip
                        label={speaker.role_type.replace('_', ' ')}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: speaker.role_type === 'customer'
                            ? alpha(theme.palette.primary.main, 0.1)
                            : alpha(theme.palette.secondary.main, 0.1),
                          color: speaker.role_type === 'customer' ? 'primary.main' : 'secondary.main',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Feature Mappings Section */}
      {mappings.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CategoryIcon sx={{ color: 'primary.main', fontSize: 18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.9rem' }}>
              Feature Mappings ({mappings.length})
            </Typography>
          </Box>

          {mappings.map((mapping: FeatureMapping, index: number) => (
            <Paper
              key={index}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 1.5,
                '&:last-child': { mb: 0 },
              }}
            >
              {/* Interpreted Need */}
              {mapping.interpreted_need && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    mb: 1,
                    color: 'text.primary',
                    lineHeight: 1.4,
                    fontSize: '0.8rem',
                  }}
                >
                  {mapping.interpreted_need}
                </Typography>
              )}

              {/* Verbatim Quote */}
              {mapping.verbatim_quote && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontStyle: 'italic',
                    mb: 1,
                    pl: 1.5,
                    borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    lineHeight: 1.4,
                    fontSize: '0.75rem',
                  }}
                >
                  "{mapping.verbatim_quote}"
                </Typography>
              )}

              {/* Chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mapping.signal_type && (
                  <Chip
                    label={mapping.signal_type.replace('_', ' ')}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: 'info.main',
                    }}
                  />
                )}
                {mapping.impact_score && (
                  <Chip
                    label={`Impact: ${mapping.impact_score}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                      color: 'warning.main',
                    }}
                  />
                )}
                {mapping.confidence_score && (
                  <Chip
                    label={`Confidence: ${mapping.confidence_score}%`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: 'success.main',
                    }}
                  />
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* No insights fallback */}
      {!hasKeyInsights && !hasRiskAssessment && !hasCustomerMetadata && speakers.length === 0 && mappings.length === 0 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <InsightsIcon sx={{ fontSize: 40, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
            No detailed insights available yet
          </Typography>
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
