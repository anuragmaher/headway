/**
 * FeedbackDetail - Expanded detail view for selected feedback
 * Shows full content, AI insights, and actions
 */
import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  Divider,
  Chip,
  Button,
} from '@mui/material';
import { formatDateTime } from '../../utils/dateUtils';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  SwapHoriz as SwapHorizIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { SourceBadge } from '../shared/SourceBadge';
import { TagChip, UrgencyChip } from '../shared/TagChip';
import {
  useExpandedFeedback,
  useIsDetailPanelOpen,
  useExplorerActions,
} from '../../store';

interface FeedbackDetailProps {
  width?: number;
}

export const FeedbackDetail: React.FC<FeedbackDetailProps> = ({
  width = 480,
}) => {
  const feedback = useExpandedFeedback();
  const isOpen = useIsDetailPanelOpen();
  const { closeDetailPanel } = useExplorerActions();

  const handleCopyContent = () => {
    if (feedback) {
      navigator.clipboard.writeText(feedback.originalContent);
    }
  };

  if (!feedback) return null;

  const formattedDate = formatDateTime(feedback.receivedAt);

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={closeDetailPanel}
      slotProps={{
        paper: {
          sx: {
            width,
            maxWidth: '100%',
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ flex: 1, mr: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 600,
              lineHeight: 1.4,
              mb: 1,
            }}
          >
            {feedback.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <SourceBadge source={feedback.source} />
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              ·
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {formattedDate}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={closeDetailPanel} size="small">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Contact Info */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: '0.625rem',
              fontWeight: 600,
              color: 'text.secondary',
              letterSpacing: 1,
              mb: 1,
              display: 'block',
            }}
          >
            FROM
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              {feedback.contactName.charAt(0).toUpperCase()}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {feedback.contactName}
              </Typography>
              {feedback.contactEmail && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                  {feedback.contactEmail}
                </Typography>
              )}
              {feedback.contactCompany && (
                <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                  {feedback.contactCompany}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Tags */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: '0.625rem',
              fontWeight: 600,
              color: 'text.secondary',
              letterSpacing: 1,
              mb: 1,
              display: 'block',
            }}
          >
            CLASSIFICATION
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {feedback.tags.map((tag) => (
              <TagChip key={tag} tag={tag} size="medium" />
            ))}
            <UrgencyChip urgency={feedback.urgency} size="medium" />
            {feedback.matchConfidence > 0 && (
              <Chip
                size="small"
                label={`${Math.round(feedback.matchConfidence * 100)}% confidence`}
                sx={{
                  height: 24,
                  fontSize: '0.6875rem',
                  bgcolor: 'action.hover',
                }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Original Content */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="overline"
              sx={{
                fontSize: '0.625rem',
                fontWeight: 600,
                color: 'text.secondary',
                letterSpacing: 1,
              }}
            >
              ORIGINAL MESSAGE
            </Typography>
            <IconButton size="small" onClick={handleCopyContent}>
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: 'text.primary',
              }}
            >
              {feedback.originalContent}
            </Typography>
          </Box>
          {feedback.sourceChannel && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 1,
                color: 'text.disabled',
              }}
            >
              From #{feedback.sourceChannel}
            </Typography>
          )}
        </Box>

        {/* AI Insights */}
        {feedback.aiInsights && feedback.aiInsights.keyPoints.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoAwesomeIcon sx={{ fontSize: 16, color: '#7C5CFF' }} />
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    letterSpacing: 1,
                  }}
                >
                  AI INSIGHTS
                </Typography>
              </Box>

              {/* Key Points */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: '#7C5CFF08',
                  border: '1px solid',
                  borderColor: '#7C5CFF20',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, mb: 1, fontSize: '0.8125rem' }}
                >
                  Key Topics
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {feedback.aiInsights.keyPoints.map((point, index) => (
                    <Chip
                      key={index}
                      label={point}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.75rem',
                        bgcolor: '#7C5CFF15',
                        color: '#5B3FBF',
                      }}
                    />
                  ))}
                </Box>

                {/* Suggested Actions */}
                {feedback.aiInsights.suggestedActions && feedback.aiInsights.suggestedActions.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1, fontSize: '0.8125rem' }}
                    >
                      Suggested Actions
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {feedback.aiInsights.suggestedActions.map((action, index) => (
                        <Typography
                          key={index}
                          component="li"
                          variant="body2"
                          sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8125rem' }}
                        >
                          {action}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none' }}
        >
          Move to...
        </Button>
        {feedback.sourceMessageId && (
          <Button
            variant="text"
            size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', ml: 'auto' }}
          >
            View Original
          </Button>
        )}
      </Box>
    </Drawer>
  );
};

export default FeedbackDetail;
