import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MessageIcon from '@mui/icons-material/Message';
import PersonIcon from '@mui/icons-material/Person';
import TagIcon from '@mui/icons-material/Tag';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { API_BASE_URL } from '../../config/api.config';
import { ExternalCallLink } from './ExternalCallLink';

interface AIInsights {
  feature_requests?: Array<{
    title: string;
    description: string;
    urgency: string;
    quote: string;
  }>;
  bug_reports?: Array<{
    title: string;
    description: string;
    severity: string;
    quote: string;
  }>;
  pain_points?: Array<{
    description: string;
    impact: string;
    quote?: string;
  }>;
  sentiment?: {
    overall: string;
    score: number;
    reasoning: string;
  };
  key_topics?: string[];
  summary?: string;
}

interface Message {
  id: string;
  content: string;
  sent_at: string;
  sender_name: string | null;
  channel_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  ai_insights: AIInsights | null;
  source?: string;
  external_id?: string;
  message_metadata?: Record<string, any>;
}

interface FeatureMessagesModalProps {
  open: boolean;
  onClose: () => void;
  featureId: string;
  featureName: string;
  workspaceId: string;
}

const FeatureMessagesModal: React.FC<FeatureMessagesModalProps> = ({
  open,
  onClose,
  featureId,
  featureName,
  workspaceId
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = () => {
    try {
      const authData = localStorage.getItem('headway-auth');
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        return parsedAuth.state?.tokens?.access_token;
      }
    } catch (error) {
      console.warn('Failed to parse auth data');
    }
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchMessages = async () => {
    if (!featureId || !open) return;

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [featureId, open, workspaceId]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <MessageIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Messages & Mentions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {featureName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading messages...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {messages.length} message{messages.length !== 1 ? 's' : ''} related to this feature
            </Typography>

            {messages.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No messages found for this feature
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflow: 'auto' }}>
                {messages.map((message) => {
                  // Count insights for summary
                  const insightCounts = {
                    features: message.ai_insights?.feature_requests?.length || 0,
                    bugs: message.ai_insights?.bug_reports?.length || 0,
                    painPoints: message.ai_insights?.pain_points?.length || 0,
                  };
                  const totalInsights = insightCounts.features + insightCounts.bugs + insightCounts.painPoints;

                  return (
                    <Accordion
                      key={message.id}
                      sx={{
                        mb: 1.5,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        '&:hover': {
                          background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.04)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          '& .MuiAccordionSummary-content': {
                            my: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          },
                        }}
                      >
                        {/* Customer Name and Date */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} color="primary">
                              {message.customer_name || 'Unknown Customer'}
                            </Typography>
                            {message.customer_email && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {message.customer_email}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(message.sent_at)}
                          </Typography>
                        </Box>

                        {/* Insight Counts and External Call Link */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          {message.ai_insights && totalInsights > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {insightCounts.features > 0 && (
                                <Chip
                                  label={`${insightCounts.features} feature${insightCounts.features > 1 ? 's' : ''}`}
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              )}
                              {insightCounts.bugs > 0 && (
                                <Chip
                                  label={`${insightCounts.bugs} bug${insightCounts.bugs > 1 ? 's' : ''}`}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              )}
                              {insightCounts.painPoints > 0 && (
                                <Chip
                                  label={`${insightCounts.painPoints} pain point${insightCounts.painPoints > 1 ? 's' : ''}`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          )}
                          <ExternalCallLink
                            source={message.source}
                            externalId={message.external_id}
                            messageMetadata={message.message_metadata}
                            size="small"
                          />
                        </Box>
                      </AccordionSummary>

                      <AccordionDetails>
                      {message.ai_insights ? (
                        <Box sx={{ width: '100%' }}>

                          {/* Feature Requests */}
                          {message.ai_insights.feature_requests && message.ai_insights.feature_requests.length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Feature Requests:
                              </Typography>
                              {message.ai_insights.feature_requests.map((feature, idx) => (
                                <Box key={idx} mb={1.5} pl={2}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {feature.title}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" paragraph>
                                    {feature.description}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    "{feature.quote}"
                                  </Typography>
                                  <Box mt={0.5}>
                                    <Chip
                                      label={feature.urgency}
                                      size="small"
                                      color={feature.urgency === 'high' || feature.urgency === 'critical' ? 'error' : feature.urgency === 'medium' ? 'warning' : 'default'}
                                    />
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}

                          {/* Bug Reports */}
                          {message.ai_insights.bug_reports && message.ai_insights.bug_reports.length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Bug Reports:
                              </Typography>
                              {message.ai_insights.bug_reports.map((bug, idx) => (
                                <Box key={idx} mb={1.5} pl={2}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {bug.title}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" paragraph>
                                    {bug.description}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    "{bug.quote}"
                                  </Typography>
                                  <Box mt={0.5}>
                                    <Chip
                                      label={bug.severity}
                                      size="small"
                                      color={bug.severity === 'high' || bug.severity === 'critical' ? 'error' : bug.severity === 'medium' ? 'warning' : 'default'}
                                    />
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}

                          {/* Pain Points */}
                          {message.ai_insights.pain_points && message.ai_insights.pain_points.length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Pain Points:
                              </Typography>
                              {message.ai_insights.pain_points.map((pain, idx) => (
                                <Box key={idx} mb={1.5} pl={2}>
                                  <Typography variant="body2" color="text.secondary">
                                    {pain.description}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Impact: {pain.impact}
                                  </Typography>
                                  {pain.quote && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                                      "{pain.quote}"
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          )}

                          {/* Summary */}
                          {message.ai_insights.summary && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Summary:
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                {message.ai_insights.summary}
                              </Typography>
                            </Box>
                          )}

                          {/* Sentiment */}
                          {message.ai_insights.sentiment && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Sentiment:
                              </Typography>
                              <Box pl={2}>
                                <Chip
                                  label={`${message.ai_insights.sentiment.overall} (${message.ai_insights.sentiment.score})`}
                                  size="small"
                                  color={message.ai_insights.sentiment.overall === 'positive' ? 'success' : message.ai_insights.sentiment.overall === 'negative' ? 'error' : 'default'}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                  {message.ai_insights.sentiment.reasoning}
                                </Typography>
                              </Box>
                            </Box>
                          )}

                          {/* Key Topics */}
                          {message.ai_insights.key_topics && message.ai_insights.key_topics.length > 0 && (
                            <Box mb={2}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} gutterBottom>
                                Key Topics:
                              </Typography>
                              <Box pl={2} display="flex" gap={0.5} flexWrap="wrap">
                                {message.ai_insights.key_topics.map((topic, idx) => (
                                  <Chip key={idx} label={topic} size="small" variant="outlined" />
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* Message Metadata */}
                          <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            mt: 2,
                            pt: 2,
                            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                          }}>
                            <Box display="flex" gap={1} flexWrap="wrap">
                              {message.sender_name && (
                                <Chip
                                  icon={<PersonIcon />}
                                  label={message.sender_name}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {message.channel_name && (
                                <Chip
                                  icon={<TagIcon />}
                                  label={message.channel_name}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </Typography>
                      )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeatureMessagesModal;