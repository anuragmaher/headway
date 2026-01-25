/**
 * TranscriptClassificationDetailPanel - Detailed view for selected transcript classification
 * Shows full extracted data, mappings, AI insights, and source information
 */
import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Paper,
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Psychology as PsychologyIcon,
  Category as CategoryIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/dateUtils';
import { 
  useSelectedTranscriptClassification,
  useThemes,
  useSubThemes,
} from '../../store';
import { useTranscriptCounts } from '../../hooks/useTranscriptCounts';

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
  // Fetch counts only when detail panel opens (lightweight)
  const { themeCounts, subThemeCounts, isLoading: isLoadingCounts } = useTranscriptCounts();

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
  const mappings = (extractedData.mappings as any[]) || [];
  const classificationData = extractedData.classification || {};
  const features = (extractedData.features as any[]) || [];
  const insights = extractedData.insights || {};
  const metadata = extractedData.metadata || {};

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

  // Get counts from the hook (lightweight, no full transcript data)
  const getThemeTranscriptCount = (themeId: string): number => {
    return themeCounts[themeId] || 0;
  };

  const getSubThemeTranscriptCount = (subThemeId: string): number => {
    return subThemeCounts[subThemeId] || 0;
  };

  const getStatusIcon = () => {
    switch (classification.processingStatus) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />;
      case 'processing':
        return <ScheduleIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />;
      default:
        return <ScheduleIcon sx={{ color: theme.palette.text.disabled, fontSize: 20 }} />;
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
          py: 2,
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
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {classification.sourceTitle || 'Untitled Transcript'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip
              label={classification.sourceType.toUpperCase()}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getStatusIcon()}
              <Typography variant="body2" sx={{ color: getStatusColor(), fontWeight: 500 }}>
                {classification.processingStatus.charAt(0).toUpperCase() + classification.processingStatus.slice(1)}
              </Typography>
            </Box>
            {classification.confidenceScore && (
              <Chip
                label={`${classification.confidenceScore} confidence`}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  color: 'info.main',
                  fontSize: '0.75rem',
                }}
              />
            )}
          </Box>
          {classification.transcriptDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(classification.transcriptDate)}
              </Typography>
            </Box>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
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
        {/* Mappings Section */}
        {mappings.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CategoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Feature Mappings ({mappings.length})
              </Typography>
            </Box>
            {mappings.map((mapping: any, index: number) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                }}
              >
                {mapping.interpreted_need && (
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                    {mapping.interpreted_need}
                  </Typography>
                )}
                {mapping.verbatim_quote && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      mb: 1,
                      pl: 2,
                      borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  >
                    "{mapping.verbatim_quote}"
                  </Typography>
                )}
                {mapping.reasoning && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {mapping.reasoning}
                  </Typography>
                )}
                {mapping.theme_id && (
                  <Chip
                    label={`Theme: ${getThemeName(mapping.theme_id)} (${getThemeTranscriptCount(mapping.theme_id)})`}
                    size="small"
                    sx={{ mr: 1, mt: 1 }}
                  />
                )}
                {mapping.sub_theme_id && (
                  <Chip
                    label={`Sub-theme: ${getSubThemeName(mapping.sub_theme_id)} (${getSubThemeTranscriptCount(mapping.sub_theme_id)})`}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </Paper>
            ))}
          </Box>
        )}

        {/* Features Section */}
        {features.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DescriptionIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Extracted Features ({features.length})
              </Typography>
            </Box>
            {features.map((feature: any, index: number) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                }}
              >
                {feature.name && (
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                    {feature.name}
                  </Typography>
                )}
                {feature.description && (
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                )}
                {feature.urgency && (
                  <Chip
                    label={`Urgency: ${feature.urgency}`}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </Paper>
            ))}
          </Box>
        )}

        {/* AI Insights Section */}
        {Object.keys(insights).length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PsychologyIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                AI Insights
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              {insights.sentiment && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Sentiment
                  </Typography>
                  <Chip
                    label={insights.sentiment as string}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                    }}
                  />
                </Box>
              )}
              {insights.key_points && Array.isArray(insights.key_points) && insights.key_points.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Key Points
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {(insights.key_points as string[]).map((point: string, idx: number) => (
                      <li key={idx}>
                        <Typography variant="body2" color="text.primary">
                          {point}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              {insights.action_items && Array.isArray(insights.action_items) && insights.action_items.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Action Items
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {(insights.action_items as string[]).map((item: string, idx: number) => (
                      <li key={idx}>
                        <Typography variant="body2" color="text.primary">
                          {item}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* Classification Data */}
        {Object.keys(classificationData).length > 0 && (
          <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Classification Details
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#F5F5F5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(classificationData, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Metadata */}
        {Object.keys(metadata).length > 0 && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Processing Metadata
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#F5F5F5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(metadata, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Error Message */}
        {classification.errorMessage && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.error.main, 0.1),
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              borderRadius: 2,
              mt: 2,
            }}
          >
            <Typography variant="body2" color="error" sx={{ fontWeight: 500, mb: 0.5 }}>
              Error
            </Typography>
            <Typography variant="body2" color="error">
              {classification.errorMessage}
            </Typography>
          </Paper>
        )}

        {/* Raw AI Response (Collapsible) */}
        {classification.rawAiResponse && (
          <Accordion defaultExpanded={false} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Raw AI Response
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#F5F5F5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  maxHeight: 400,
                }}
              >
                {JSON.stringify(classification.rawAiResponse, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Source Information */}
        <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Source Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              <strong>Source ID:</strong> {classification.sourceId}
            </Typography>
            <Typography variant="body2">
              <strong>Created:</strong> {formatDateTime(classification.createdAt)}
            </Typography>
            {classification.updatedAt && (
              <Typography variant="body2">
                <strong>Updated:</strong> {formatDateTime(classification.updatedAt)}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
