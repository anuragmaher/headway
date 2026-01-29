/**
 * TranscriptClassificationDetailPanel - Detailed view for selected transcript classification
 * Shows feature mappings, key insights, risk assessment, customer metadata, and more
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Category as CategoryIcon,
  Code as CodeIcon,
  Info as InfoIcon,
  People as PeopleIcon,
  Insights as InsightsIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Lightbulb as LightbulbIcon,
  SentimentSatisfied as SentimentSatisfiedIcon,
  SentimentNeutral as SentimentNeutralIcon,
  SentimentDissatisfied as SentimentDissatisfiedIcon,
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/dateUtils';
import {
  useSelectedTranscriptClassification,
  useThemes,
  useSubThemes,
} from '../../store';
import { useTranscriptCounts } from '../../hooks/useTranscriptCounts';
import { themesApi } from '../../../../services/themes.api';

interface TranscriptClassificationDetailPanelProps {
  onClose: () => void;
}

export const TranscriptClassificationDetailPanel: React.FC<TranscriptClassificationDetailPanelProps> = ({
  onClose,
}) => {
  const theme = useTheme();
  const classification = useSelectedTranscriptClassification();
  const themes = useThemes();
  const subThemes = useSubThemes();
  const { themeCounts, subThemeCounts } = useTranscriptCounts();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Fetch transcript when accordion is expanded
  const handleTranscriptToggle = useCallback(async () => {
    const newExpanded = !transcriptExpanded;
    setTranscriptExpanded(newExpanded);

    // Fetch transcript only when expanding and not already loaded
    if (newExpanded && !transcriptText && classification?.id) {
      setTranscriptLoading(true);
      setTranscriptError(null);
      try {
        const text = await themesApi.getTranscriptText(classification.id);
        setTranscriptText(text);
      } catch (error) {
        console.error('Failed to fetch transcript:', error);
        setTranscriptError('Failed to load transcript');
      } finally {
        setTranscriptLoading(false);
      }
    }
  }, [transcriptExpanded, transcriptText, classification?.id]);

  // Reset transcript state when classification changes
  useEffect(() => {
    setTranscriptText(null);
    setTranscriptError(null);
    setTranscriptExpanded(false);
  }, [classification?.id]);

  if (!classification) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Typography color="text.secondary">No classification selected</Typography>
      </Box>
    );
  }

  const extractedData = classification.extractedData || {};
  const rawAiResponse = classification.rawAiResponse || extractedData;

  // NEW FORMAT: Extract new prompt format fields
  const customer = (extractedData.customer as { company?: string; type?: string; use_case?: string }) || null;
  const featureSignals = (extractedData.feature_signals as any[]) || [];
  const unmappedSignals = (extractedData.unmapped_signals as any[]) || [];
  const pmSummary = (extractedData.pm_summary as string) || '';

  // OLD FORMAT: Extract all sections from the response (backward compatibility)
  const mappings = (extractedData.mappings as any[]) || [];
  const speakers = (extractedData.speakers as any[]) || [];
  const keyInsights = extractedData.key_insights || {};
  const callMetadata = extractedData.call_metadata || {};
  const themeSummary = extractedData.theme_summary || {};
  const riskAssessment = extractedData.risk_assessment || {};
  const customerMetadata = extractedData.customer_metadata || {};

  // Helper function to get signal type color
  const getSignalTypeColor = (signalType: string): string => {
    switch (signalType) {
      case 'feature_request': return theme.palette.info.main;
      case 'implicit_need': return theme.palette.secondary.main;
      case 'deal_blocker': return theme.palette.error.main;
      case 'adoption_blocker': return theme.palette.warning.main;
      default: return theme.palette.text.secondary;
    }
  };

  // Helper function to get signal type label
  const getSignalTypeLabel = (signalType: string): string => {
    switch (signalType) {
      case 'feature_request': return 'Feature Request';
      case 'implicit_need': return 'Implicit Need';
      case 'deal_blocker': return 'Deal Blocker';
      case 'adoption_blocker': return 'Adoption Blocker';
      default: return signalType.replace('_', ' ');
    }
  };

  // Helper function to get theme name by ID
  const getThemeName = (themeId: string): string => {
    const foundTheme = themes.find(t => t.id === themeId);
    return foundTheme?.name || themeId;
  };

  // Helper function to get sub-theme name by ID
  const getSubThemeName = (subThemeId: string): string => {
    const foundSubTheme = subThemes.find(st => st.id === subThemeId);
    return foundSubTheme?.name || subThemeId;
  };

  // Get counts from the hook
  const getThemeTranscriptCount = (themeId: string): number => {
    return themeCounts[themeId] || 0;
  };

  const getSubThemeTranscriptCount = (subThemeId: string): number => {
    return subThemeCounts[subThemeId] || 0;
  };

  const getStatusIcon = () => {
    switch (classification.processingStatus) {
      case 'completed':
        return <CheckCircleIcon sx={{ fontSize: 16 }} />;
      case 'failed':
        return <ErrorIcon sx={{ fontSize: 16 }} />;
      case 'processing':
        return <ScheduleIcon sx={{ fontSize: 16 }} />;
      default:
        return <ScheduleIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getStatusColor = () => {
    switch (classification.processingStatus) {
      case 'completed':
        return theme.palette.success.main;
      case 'failed':
        return theme.palette.error.main;
      case 'processing':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  // Format source type for display
  const formatSourceType = (sourceType: string): string => {
    return sourceType.toUpperCase();
  };

  // Get source type color
  const getSourceTypeColor = (sourceType: string): string => {
    const colors: Record<string, string> = {
      gong: '#7C5CFF',
      fathom: '#00D1FF',
      zoom: '#2D8CFF',
      slack: '#4A154B',
      gmail: '#EA4335',
    };
    return colors[sourceType.toLowerCase()] || theme.palette.primary.main;
  };

  // Get risk color
  const getRiskColor = (risk: string): string => {
    const riskLower = risk?.toLowerCase() || '';
    if (riskLower === 'low') return theme.palette.success.main;
    if (riskLower === 'medium') return theme.palette.warning.main;
    if (riskLower === 'high') return theme.palette.error.main;
    return theme.palette.text.secondary;
  };

  // Get sentiment icon
  const getSentimentIcon = (sentiment?: number) => {
    if (sentiment === undefined || sentiment === null) return null;
    if (sentiment > 0.3) return <SentimentSatisfiedIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />;
    if (sentiment < -0.3) return <SentimentDissatisfiedIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />;
    return <SentimentNeutralIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />;
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {classification.sourceTitle || 'Untitled Transcript'}
          </Typography>
          
          {/* Status Chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip
              label={formatSourceType(classification.sourceType)}
              size="small"
              sx={{
                bgcolor: alpha(getSourceTypeColor(classification.sourceType), 0.1),
                color: getSourceTypeColor(classification.sourceType),
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
              }}
            />
            <Chip
              icon={getStatusIcon()}
              label={classification.processingStatus.charAt(0).toUpperCase() + classification.processingStatus.slice(1)}
              size="small"
              sx={{
                bgcolor: alpha(getStatusColor(), 0.1),
                color: getStatusColor(),
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': {
                  color: getStatusColor(),
                },
              }}
            />
            {callMetadata.overall_sentiment !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getSentimentIcon(callMetadata.overall_sentiment)}
                <Typography variant="caption" color="text.secondary">
                  {callMetadata.overall_sentiment > 0 ? 'Positive' : callMetadata.overall_sentiment < 0 ? 'Negative' : 'Neutral'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Date and Duration */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {classification.transcriptDate && (
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(classification.transcriptDate)}
              </Typography>
            )}
            {callMetadata.duration_minutes && (
              <Typography variant="body2" color="text.secondary">
                {callMetadata.duration_minutes} min
              </Typography>
            )}
            {callMetadata.call_type && (
              <Chip
                label={callMetadata.call_type.replace('_', ' ')}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  color: 'info.main',
                }}
              />
            )}
          </Box>
        </Box>
        
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
            flexShrink: 0,
            color: 'text.secondary',
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.1),
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content - Scrollable */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
        }}
      >
        {/* NEW FORMAT: Customer Info Section */}
        {customer && (customer.company || customer.type || customer.use_case) && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BusinessIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Customer
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 2,
              }}
            >
              <Grid container spacing={2}>
                {customer.company && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Company
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                      {customer.company}
                    </Typography>
                  </Grid>
                )}
                {customer.type && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Type
                    </Typography>
                    <Chip
                      label={customer.type === 'prospect' ? 'Prospect' : 'Existing Customer'}
                      size="small"
                      sx={{
                        bgcolor: customer.type === 'prospect'
                          ? alpha(theme.palette.warning.main, 0.1)
                          : alpha(theme.palette.success.main, 0.1),
                        color: customer.type === 'prospect' ? 'warning.main' : 'success.main',
                        fontWeight: 500,
                      }}
                    />
                  </Grid>
                )}
                {customer.use_case && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Use Case
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {customer.use_case}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Box>
        )}

        {/* Key Insights Section - Supports both old and new formats */}
        {(Object.keys(keyInsights).length > 0 || featureSignals.length > 0 || pmSummary) && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <InsightsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Key Insights
              </Typography>
            </Box>

            {/* NEW FORMAT: PM Summary */}
            {pmSummary && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.main' }}>
                  PM Summary
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {pmSummary}
                </Typography>
              </Paper>
            )}

            {/* NEW FORMAT: Feature Signals */}
            {featureSignals.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary' }}>
                  Feature Signals ({featureSignals.length})
                </Typography>
                {featureSignals.map((signal: any, idx: number) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      bgcolor: signal.is_blocker
                        ? alpha(theme.palette.error.main, 0.05)
                        : theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${signal.is_blocker
                        ? alpha(theme.palette.error.main, 0.3)
                        : alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    {/* Quote */}
                    {signal.quote && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          mb: 1.5,
                          pl: 2,
                          borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                          lineHeight: 1.6,
                        }}
                      >
                        "{signal.quote}"
                      </Typography>
                    )}
                    {/* Need interpretation */}
                    {signal.need && (
                      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500, color: 'text.primary' }}>
                        {signal.need}
                      </Typography>
                    )}
                    {/* Chips row */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {signal.signal_type && (
                        <Chip
                          label={getSignalTypeLabel(signal.signal_type)}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(getSignalTypeColor(signal.signal_type), 0.1),
                            color: getSignalTypeColor(signal.signal_type),
                            fontWeight: 500,
                          }}
                        />
                      )}
                      {signal.impact && (
                        <Chip
                          label={`Impact: ${signal.impact}`}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                            color: 'warning.main',
                            fontWeight: 500,
                          }}
                        />
                      )}
                      {signal.is_blocker && (
                        <Chip
                          label="BLOCKER"
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.error.main, 0.15),
                            color: 'error.main',
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {signal.theme && (
                        <Chip
                          label={signal.theme}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            fontWeight: 500,
                          }}
                        />
                      )}
                      {signal.sub_theme && (
                        <Chip
                          label={signal.sub_theme}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.secondary.main, 0.1),
                            color: 'secondary.main',
                            fontWeight: 500,
                          }}
                        />
                      )}
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}

            {/* NEW FORMAT: Unmapped Signals (collapsible) */}
            {unmappedSignals.length > 0 && (
              <Accordion
                sx={{
                  mb: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 2, py: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                      Unmapped Signals ({unmappedSignals.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                  {unmappedSignals.map((signal: any, idx: number) => (
                    <Paper
                      key={idx}
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 1,
                        bgcolor: alpha(theme.palette.warning.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        borderRadius: 1,
                        '&:last-child': { mb: 0 },
                      }}
                    >
                      {signal.quote && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontStyle: 'italic',
                            mb: 1,
                          }}
                        >
                          "{signal.quote}"
                        </Typography>
                      )}
                      {signal.need && (
                        <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                          {signal.need}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                        {signal.signal_type && (
                          <Chip
                            label={getSignalTypeLabel(signal.signal_type)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              bgcolor: alpha(getSignalTypeColor(signal.signal_type), 0.1),
                              color: getSignalTypeColor(signal.signal_type),
                            }}
                          />
                        )}
                        {signal.impact && (
                          <Chip
                            label={`Impact: ${signal.impact}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              color: 'warning.main',
                            }}
                          />
                        )}
                        {(signal.suggested_theme || signal.suggested_sub_theme) && (
                          <Typography variant="caption" color="text.secondary">
                            Suggested: {signal.suggested_theme}{signal.suggested_sub_theme ? ` → ${signal.suggested_sub_theme}` : ''}
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </AccordionDetails>
              </Accordion>
            )}

            {/* OLD FORMAT: Keep existing key_insights rendering for backward compatibility */}
            {Object.keys(keyInsights).length > 0 && featureSignals.length === 0 && (
              <Grid container spacing={2}>
                {/* Strongest Needs */}
                {keyInsights.strongest_needs && Array.isArray(keyInsights.strongest_needs) && keyInsights.strongest_needs.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                        height: '100%',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <LightbulbIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Strongest Needs
                        </Typography>
                      </Box>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {keyInsights.strongest_needs.map((need: string, idx: number) => (
                          <li key={idx}>
                            <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
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
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                        height: '100%',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Health Signals
                        </Typography>
                      </Box>
                      {keyInsights.health_signals.positive && Array.isArray(keyInsights.health_signals.positive) && keyInsights.health_signals.positive.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                            Positive
                          </Typography>
                          {keyInsights.health_signals.positive.map((signal: string, idx: number) => (
                            <Chip
                              key={idx}
                              label={signal}
                              size="small"
                              sx={{
                                mr: 0.5,
                                mb: 0.5,
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                color: 'success.main',
                                fontSize: '0.7rem',
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      {keyInsights.health_signals.negative && Array.isArray(keyInsights.health_signals.negative) && keyInsights.health_signals.negative.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="error.main" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                            Negative
                          </Typography>
                          {keyInsights.health_signals.negative.map((signal: string, idx: number) => (
                            <Chip
                              key={idx}
                              label={signal}
                              size="small"
                              sx={{
                                mr: 0.5,
                                mb: 0.5,
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                color: 'error.main',
                                fontSize: '0.7rem',
                              }}
                            />
                          ))}
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
                        p: 2,
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <WarningIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main' }}>
                          Blockers
                        </Typography>
                      </Box>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {keyInsights.blockers.map((blocker: string, idx: number) => (
                          <li key={idx}>
                            <Typography variant="body2" color="error.main">
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
                        p: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.main' }}>
                        Product Feedback for PM
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {keyInsights.product_feedback_for_pm}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}
          </Box>
        )}

        {/* Risk Assessment Section */}
        {Object.keys(riskAssessment).length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <AssessmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Risk Assessment
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              {riskAssessment.deal_risk && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Deal Risk
                    </Typography>
                    <Chip
                      label={riskAssessment.deal_risk}
                      size="small"
                      sx={{
                        bgcolor: alpha(getRiskColor(riskAssessment.deal_risk), 0.1),
                        color: getRiskColor(riskAssessment.deal_risk),
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Paper>
                </Grid>
              )}

              {riskAssessment.churn_risk && riskAssessment.churn_risk !== 'n/a' && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Churn Risk
                    </Typography>
                    <Chip
                      label={riskAssessment.churn_risk}
                      size="small"
                      sx={{
                        bgcolor: alpha(getRiskColor(riskAssessment.churn_risk), 0.1),
                        color: getRiskColor(riskAssessment.churn_risk),
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Paper>
                </Grid>
              )}

              {riskAssessment.expansion_signal && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Expansion Signal
                    </Typography>
                    <Chip
                      label={riskAssessment.expansion_signal}
                      size="small"
                      sx={{
                        bgcolor: alpha(getRiskColor(riskAssessment.expansion_signal), 0.1),
                        color: getRiskColor(riskAssessment.expansion_signal),
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Paper>
                </Grid>
              )}

              {riskAssessment.customer_type && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Customer Type
                    </Typography>
                    <Chip
                      label={riskAssessment.customer_type}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Paper>
                </Grid>
              )}
            </Grid>

            {/* Risk Reasons */}
            {(riskAssessment.deal_risk_reasons && riskAssessment.deal_risk_reasons.length > 0) ||
             (riskAssessment.churn_risk_reasons && riskAssessment.churn_risk_reasons.length > 0) ||
             (riskAssessment.expansion_reasons && riskAssessment.expansion_reasons.length > 0) ? (
              <Box sx={{ mt: 2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                  }}
                >
                  {riskAssessment.deal_risk_reasons && riskAssessment.deal_risk_reasons.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Deal Risk Reasons
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {riskAssessment.deal_risk_reasons.map((reason: string, idx: number) => (
                          <li key={idx}>
                            <Typography variant="body2" color="text.primary">
                              {reason}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {riskAssessment.expansion_reasons && riskAssessment.expansion_reasons.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Expansion Reasons
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {riskAssessment.expansion_reasons.map((reason: string, idx: number) => (
                          <li key={idx}>
                            <Typography variant="body2" color="text.primary">
                              {reason}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {riskAssessment.churn_risk_reasons && riskAssessment.churn_risk_reasons.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}>
                        Churn Risk Reasons
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {riskAssessment.churn_risk_reasons.map((reason: string, idx: number) => (
                          <li key={idx}>
                            <Typography variant="body2" color="error.main">
                              {reason}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Box>
            ) : null}
          </Box>
        )}

        {/* Customer Metadata Section */}
        {Object.keys(customerMetadata).length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <BusinessIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Customer Information
              </Typography>
            </Box>
            
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 2,
              }}
            >
              <Grid container spacing={2}>
                {customerMetadata.company_name && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Company Name
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                      {customerMetadata.company_name}
                    </Typography>
                  </Grid>
                )}
                {customerMetadata.company_stage && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Company Stage
                    </Typography>
                    <Chip
                      label={customerMetadata.company_stage.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        fontWeight: 500,
                      }}
                    />
                  </Grid>
                )}
                {customerMetadata.use_case && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Use Case
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {customerMetadata.use_case}
                    </Typography>
                  </Grid>
                )}
                {customerMetadata.timeline && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Timeline
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {customerMetadata.timeline}
                    </Typography>
                  </Grid>
                )}
                {customerMetadata.current_solution && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Current Solution
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {customerMetadata.current_solution}
                    </Typography>
                  </Grid>
                )}
                {customerMetadata.budget_signals && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Budget Signals
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {customerMetadata.budget_signals}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Box>
        )}

        {/* Speakers Section */}
        {speakers.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <PeopleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Speakers ({speakers.length})
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              {speakers.map((speaker: any, index: number) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {speaker.name}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {speaker.email && (
                        <Typography variant="body2" color="text.secondary">
                          {speaker.email}
                        </Typography>
                      )}
                      {speaker.company && (
                        <Typography variant="body2" color="text.secondary">
                          {speaker.company}
                        </Typography>
                      )}
                      {speaker.job_role && speaker.job_role !== 'unknown' && (
                        <Typography variant="body2" color="text.secondary">
                          {speaker.job_role}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {speaker.role_type && (
                          <Chip
                            label={speaker.role_type.replace('_', ' ')}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: speaker.role_type === 'customer' 
                                ? alpha(theme.palette.primary.main, 0.1)
                                : alpha(theme.palette.secondary.main, 0.1),
                              color: speaker.role_type === 'customer' ? 'primary.main' : 'secondary.main',
                            }}
                          />
                        )}
                        {speaker.authority_level && speaker.authority_level !== 'unknown' && (
                          <Chip
                            label={speaker.authority_level}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              color: 'info.main',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Call Metadata Section */}
        {Object.keys(callMetadata).length > 0 && callMetadata.next_steps && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <InfoIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Call Details
              </Typography>
            </Box>
            
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: alpha(theme.palette.info.main, 0.05),
                border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                borderRadius: 2,
              }}
            >
              {callMetadata.next_steps && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.main' }}>
                    Next Steps
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    {callMetadata.next_steps}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* Theme Summary Section */}
        {Object.keys(themeSummary).length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <CategoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Theme Summary
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              {Object.values(themeSummary).map((themeData: any, index: number) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                      height: '100%',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {themeData.theme_name || getThemeName(themeData.theme_id)}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Mentions: {themeData.mention_count || 0}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((themeData.mention_count || 0) * 10, 100)}
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiLinearProgress-bar': {
                              bgcolor: theme.palette.primary.main,
                            },
                          }}
                        />
                      </Box>
                      {themeData.avg_impact && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Avg Impact: {themeData.avg_impact}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={themeData.avg_impact}
                            sx={{
                              mt: 0.5,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: theme.palette.warning.main,
                              },
                            }}
                          />
                        </Box>
                      )}
                      {themeData.avg_confidence && (
                        <Typography variant="caption" color="text.secondary">
                          Avg Confidence: {themeData.avg_confidence}%
                        </Typography>
                      )}
                      {themeData.has_blocker && (
                        <Chip
                          label="Has Blocker"
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            color: 'error.main',
                            fontSize: '0.7rem',
                            width: 'fit-content',
                          }}
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Feature Mappings Section */}
        {mappings.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <CategoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Feature Mappings ({mappings.length})
              </Typography>
            </Box>
            
            {mappings.map((mapping: any, index: number) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 2.5,
                  mb: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                  '&:last-child': {
                    mb: 0,
                  },
                }}
              >
                {/* Interpreted Need */}
                {mapping.interpreted_need && (
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 500, 
                      mb: 1.5,
                      color: 'text.primary',
                      lineHeight: 1.5,
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
                      mb: 1.5,
                      pl: 2,
                      borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      lineHeight: 1.6,
                    }}
                  >
                    "{mapping.verbatim_quote}"
                  </Typography>
                )}

                {/* Reasoning */}
                {mapping.reasoning && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      lineHeight: 1.6,
                    }}
                  >
                    {mapping.reasoning}
                  </Typography>
                )}

                {/* Additional Mapping Details */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {mapping.signal_type && (
                    <Chip
                      label={mapping.signal_type.replace('_', ' ')}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
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
                        height: 22,
                        fontSize: '0.7rem',
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
                        height: 22,
                        fontSize: '0.7rem',
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: 'success.main',
                      }}
                    />
                  )}
                  {mapping.sentiment !== undefined && mapping.sentiment !== null && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getSentimentIcon(mapping.sentiment)}
                      <Typography variant="caption" color="text.secondary">
                        {mapping.sentiment > 0 ? 'Positive' : mapping.sentiment < 0 ? 'Negative' : 'Neutral'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Business Context */}
                {mapping.business_context && (
                  <Box
                    sx={{
                      p: 1.5,
                      mb: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.05),
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                      Business Context
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {mapping.business_context}
                    </Typography>
                  </Box>
                )}

                {/* Theme and Sub-theme Tags */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {mapping.theme_id && (
                    <Chip
                      label={`Theme: ${getThemeName(mapping.theme_id)} (${getThemeTranscriptCount(mapping.theme_id)})`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  )}
                  {mapping.sub_theme_id && (
                    <Chip
                      label={`Sub-theme: ${getSubThemeName(mapping.sub_theme_id)} (${getSubThemeTranscriptCount(mapping.sub_theme_id)})`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: 'secondary.main',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        {/* Transcript Section */}
        <Accordion
          expanded={transcriptExpanded}
          onChange={handleTranscriptToggle}
          sx={{
            mb: 3,
            bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            boxShadow: 'none',
            '&:before': {
              display: 'none',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              px: 2,
              py: 1.5,
              '& .MuiAccordionSummary-content': {
                my: 0,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                Full Transcript
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
            <Box
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#F5F5F5',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 500,
              }}
            >
              {transcriptLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    Loading transcript...
                  </Typography>
                </Box>
              ) : transcriptError ? (
                <Typography
                  variant="body2"
                  color="error"
                  sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}
                >
                  {transcriptError}
                </Typography>
              ) : transcriptText ? (
                <Box sx={{ fontFamily: 'inherit' }}>
                  {transcriptText.split('\n').map((line: string, index: number) => {
                    // Check if line is a header (starts with = or contains "Call:" or "Date:")
                    const isHeader = line.startsWith('=') || line.startsWith('Call:') || line.startsWith('Date:');
                    // Check if line is a speaker line (ends with :) and doesn't start with whitespace
                    const isSpeakerLine = line.trim().endsWith(':') && !line.startsWith(' ') && !line.startsWith('\t') && line.length < 100;
                    // Check if line is dialogue (starts with whitespace)
                    const isDialogue = line.startsWith('  ') || line.startsWith('\t');

                    if (line.startsWith('=')) {
                      return (
                        <Box
                          key={index}
                          sx={{
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                            my: 1,
                          }}
                        />
                      );
                    }

                    if (isHeader) {
                      return (
                        <Typography
                          key={index}
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                            mb: 0.5,
                          }}
                        >
                          {line}
                        </Typography>
                      );
                    }

                    if (isSpeakerLine) {
                      return (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            mt: 1.5,
                            mb: 0.25,
                          }}
                        >
                          {line}
                        </Typography>
                      );
                    }

                    if (isDialogue) {
                      return (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            pl: 2,
                            lineHeight: 1.6,
                          }}
                        >
                          {line.trim()}
                        </Typography>
                      );
                    }

                    if (line.includes('[TRANSCRIPT TRUNCATED')) {
                      return (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{
                            color: 'warning.main',
                            fontStyle: 'italic',
                            textAlign: 'center',
                            my: 2,
                          }}
                        >
                          {line}
                        </Typography>
                      );
                    }

                    // Empty line
                    if (!line.trim()) {
                      return <Box key={index} sx={{ height: 8 }} />;
                    }

                    return (
                      <Typography
                        key={index}
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                      >
                        {line}
                      </Typography>
                    );
                  })}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}
                >
                  Click to load the full transcript...
                </Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Source Information Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <InfoIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 500, color: 'text.primary' }}>
              Source Information
            </Typography>
          </Box>
          
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5, display: 'block' }}>
                  Source ID
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {classification.sourceId}
                </Typography>
              </Box>
              
              {classification.createdAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5, display: 'block' }}>
                    Created
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    {formatDateTime(classification.createdAt)}
                  </Typography>
                </Box>
              )}
              
              {classification.sourceType && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5, display: 'block' }}>
                    Source Type
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    {formatSourceType(classification.sourceType)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};
