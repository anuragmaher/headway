/**
 * MentionDetails - Detailed view of a message/mention
 */

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  FeaturedPlayList as FeatureIcon,
  BugReport as BugReportIcon,
  SentimentDissatisfied as SadIcon,
  Summarize as SummarizeIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { Message, MentionDetailsTab } from '../types';
import { useThemesPageStore } from '../store';

interface MentionDetailsProps {
  message: Message;
  onBack: () => void;
  onClose: () => void;
}

export const MentionDetails: React.FC<MentionDetailsProps> = ({ message, onBack, onClose }) => {
  const theme = useTheme();
  const { mentionDetailsTab, setMentionDetailsTab } = useThemesPageStore();

  // Determine call URL
  let callUrl: string | null = null;
  let buttonText = 'Go to Call';

  if (message.source === 'gong' && message.external_id) {
    callUrl = `https://app.gong.io/call/${message.external_id}`;
    buttonText = 'View in Gong';
  } else if (message.source === 'fathom' && message.message_metadata?.recording_url) {
    callUrl = message.message_metadata.recording_url;
    buttonText = 'View Recording';
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Details Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.02)
      }}>
        <IconButton
          onClick={onBack}
          size="medium"
          sx={{
            color: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: theme.palette.primary.main
            },
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 22 }} />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, fontSize: '1rem' }}>
          Details
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.5),
              color: theme.palette.text.primary
            }
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Message Title */}
      {message.title && (
        <Box sx={{
          px: 2,
          pt: 2,
          pb: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: '0.95rem',
              color: theme.palette.text.primary,
              wordBreak: 'break-word'
            }}
          >
            {message.title}
          </Typography>
        </Box>
      )}

      {/* Details Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Header Section */}
        <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75, display: 'block' }}>
                {message.customer_name || message.sender_name || 'Unknown'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.8rem' }}>
                {message.customer_email || message.sender_name}
              </Typography>
            </Box>
            {callUrl && (
              <Button
                variant="contained"
                size="small"
                endIcon={<OpenInNewIcon />}
                onClick={() => window.open(callUrl, '_blank')}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  py: 0.75,
                  px: 1.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {buttonText}
              </Button>
            )}
          </Box>
        </Box>

        {message.ai_insights ? (
          <Box sx={{ width: '100%' }}>
            {/* Highlights Accordion */}
            <Accordion 
              defaultExpanded 
              expanded={mentionDetailsTab === 'highlights' || mentionDetailsTab === ''} 
              onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'highlights' : '')} 
              sx={{
                '&.MuiAccordion-root': {
                  boxShadow: 'none',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 1,
                  '&:before': { display: 'none' },
                  backgroundColor: alpha(theme.palette.info.main, 0.02)
                },
                mb: 1.5
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.05) }, transition: 'all 0.2s ease' }}>
                <LightbulbIcon sx={{ fontSize: 20, mr: 1.5, color: 'info.main' }} />
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Highlights</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                {message.ai_insights.summary && (
                  <Box mb={2}>
                    <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                      Overview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                      {message.ai_insights.summary}
                    </Typography>
                  </Box>
                )}

                {message.ai_insights.feature_requests && message.ai_insights.feature_requests.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.success.main }}>
                      {message.ai_insights.feature_requests.length} Feature Request{message.ai_insights.feature_requests.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box mt={0.5}>
                      {message.ai_insights.feature_requests.slice(0, 3).map((feature, idx) => (
                        <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                          • {feature.title}
                        </Typography>
                      ))}
                      {message.ai_insights.feature_requests.length > 3 && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                          +{message.ai_insights.feature_requests.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}

                {message.ai_insights.bug_reports && message.ai_insights.bug_reports.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.error.main }}>
                      {message.ai_insights.bug_reports.length} Bug Report{message.ai_insights.bug_reports.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box mt={0.5}>
                      {message.ai_insights.bug_reports.slice(0, 3).map((bug, idx) => (
                        <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                          • {bug.title}
                        </Typography>
                      ))}
                      {message.ai_insights.bug_reports.length > 3 && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                          +{message.ai_insights.bug_reports.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}

                {message.ai_insights.pain_points && message.ai_insights.pain_points.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.warning.main }}>
                      {message.ai_insights.pain_points.length} Pain Point{message.ai_insights.pain_points.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box mt={0.5}>
                      {message.ai_insights.pain_points.slice(0, 3).map((pain, idx) => (
                        <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                          • {pain.description.substring(0, 50)}...
                        </Typography>
                      ))}
                      {message.ai_insights.pain_points.length > 3 && (
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                          +{message.ai_insights.pain_points.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Features Accordion */}
            <Accordion expanded={mentionDetailsTab === 'features'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'features' : '')} sx={{
              '&.MuiAccordion-root': {
                boxShadow: 'none',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 1,
                '&:before': { display: 'none' },
                backgroundColor: alpha(theme.palette.success.main, 0.02)
              },
              mb: 1.5
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.05) }, transition: 'all 0.2s ease' }}>
                <FeatureIcon sx={{ fontSize: 20, mr: 1.5, color: 'success.main' }} />
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Features</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                  {message.ai_insights.feature_requests?.length || 0}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                {message.ai_insights.feature_requests && message.ai_insights.feature_requests.length > 0 ? (
                  message.ai_insights.feature_requests.map((feature, idx) => (
                    <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < message.ai_insights!.feature_requests!.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                      <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                        {feature.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem', display: 'block', mb: 0.5 }}>
                        "{feature.quote}"
                      </Typography>
                      <Chip
                        label={feature.urgency}
                        size="small"
                        color={feature.urgency === 'high' || feature.urgency === 'critical' ? 'error' : feature.urgency === 'medium' ? 'warning' : 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    No features found in this mention
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Bugs Accordion */}
            <Accordion expanded={mentionDetailsTab === 'bugs'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'bugs' : '')} sx={{
              '&.MuiAccordion-root': {
                boxShadow: 'none',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 1,
                '&:before': { display: 'none' },
                backgroundColor: alpha(theme.palette.error.main, 0.02)
              },
              mb: 1.5
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.05) }, transition: 'all 0.2s ease' }}>
                <BugReportIcon sx={{ fontSize: 20, mr: 1.5, color: 'error.main' }} />
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Bugs</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                  {message.ai_insights.bug_reports?.length || 0}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                {message.ai_insights.bug_reports && message.ai_insights.bug_reports.length > 0 ? (
                  message.ai_insights.bug_reports.map((bug, idx) => (
                    <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < message.ai_insights!.bug_reports!.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                      <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                        {bug.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                        {bug.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem', display: 'block', mb: 0.5 }}>
                        "{bug.quote}"
                      </Typography>
                      <Chip
                        label={bug.severity}
                        size="small"
                        color={bug.severity === 'high' || bug.severity === 'critical' ? 'error' : bug.severity === 'medium' ? 'warning' : 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    No bugs found in this mention
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Pain Points Accordion */}
            <Accordion expanded={mentionDetailsTab === 'pain-points'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'pain-points' : '')} sx={{
              '&.MuiAccordion-root': {
                boxShadow: 'none',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 1,
                '&:before': { display: 'none' },
                backgroundColor: alpha(theme.palette.warning.main, 0.02)
              },
              mb: 1.5
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.05) }, transition: 'all 0.2s ease' }}>
                <SadIcon sx={{ fontSize: 20, mr: 1.5, color: 'warning.main' }} />
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Pain Points</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                  {message.ai_insights.pain_points?.length || 0}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                {message.ai_insights.pain_points && message.ai_insights.pain_points.length > 0 ? (
                  message.ai_insights.pain_points.map((pain, idx) => (
                    <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < message.ai_insights!.pain_points!.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mb: 0.5 }}>
                        {pain.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        Impact: <strong>{pain.impact}</strong>
                      </Typography>
                      {pain.quote && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
                          "{pain.quote}"
                        </Typography>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    No pain points found in this mention
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Summary Accordion */}
            <Accordion expanded={mentionDetailsTab === 'summary'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'summary' : '')} sx={{
              '&.MuiAccordion-root': {
                boxShadow: 'none',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 1,
                '&:before': { display: 'none' },
                backgroundColor: alpha(theme.palette.primary.main, 0.02)
              },
              mb: 1.5
            }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }, transition: 'all 0.2s ease' }}>
                <SummarizeIcon sx={{ fontSize: 20, mr: 1.5, color: 'primary.main' }} />
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Summary</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                {message.ai_insights.summary && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {message.ai_insights.summary}
                    </Typography>
                  </Box>
                )}

                {message.ai_insights.sentiment && (
                  <Box mb={2}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ fontSize: '0.85rem' }}>
                      Sentiment
                    </Typography>
                    <Box pl={1}>
                      <Chip
                        label={`${message.ai_insights.sentiment.overall} (${message.ai_insights.sentiment.score})`}
                        size="small"
                        color={message.ai_insights.sentiment.overall === 'positive' ? 'success' : message.ai_insights.sentiment.overall === 'negative' ? 'error' : 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ fontSize: '0.75rem' }}>
                        {message.ai_insights.sentiment.reasoning}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {message.ai_insights.key_topics && message.ai_insights.key_topics.length > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ fontSize: '0.85rem' }}>
                      Key Topics
                    </Typography>
                    <Box pl={1} display="flex" gap={0.5} flexWrap="wrap">
                      {message.ai_insights.key_topics.map((topic, idx) => (
                        <Chip key={idx} label={topic} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Message Metadata */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              mt: 3,
              pt: 2,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {message.sender_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                in #{message.channel_name}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              wordBreak: 'break-word',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontSize: '0.85rem'
            }}
          >
            {message.content}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
