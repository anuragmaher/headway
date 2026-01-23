/**
 * MentionCard - Expandable card showing a mention with AI insights
 * When expanded, shows the full message content and AI-extracted insights
 *
 * Supports many-to-many: shows linked CustomerAsks when a message
 * is connected to multiple customer asks (e.g., call transcript with multiple features)
 */
import React from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip,
  useTheme,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
  Tag as SlackIcon,
  Psychology as AIIcon,
  FormatQuote as QuoteIcon,
  Lightbulb as InsightIcon,
  Person as PersonIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { MentionItem } from '../../types';
import { SOURCE_COLORS } from '../../types';

interface MentionCardProps {
  mention: MentionItem;
  isExpanded: boolean;
  onToggleExpand: (mentionId: string) => void;
  onNavigateToCustomerAsk?: (customerAskId: string) => void;  // NEW: Navigate to another CustomerAsk
}

export const MentionCard: React.FC<MentionCardProps> = ({
  mention,
  isExpanded,
  onToggleExpand,
  onNavigateToCustomerAsk,
}) => {
  const theme = useTheme();

  const handleToggle = () => {
    onToggleExpand(mention.id);
  };

  // Check if this message is linked to multiple CustomerAsks
  const hasMultipleLinks = mention.linkedCustomerAsks && mention.linkedCustomerAsks.length > 0;

  // Get source icon
  const getSourceIcon = () => {
    switch (mention.source) {
      case 'gmail':
        return <EmailIcon sx={{ fontSize: 14 }} />;
      case 'slack':
        return <SlackIcon sx={{ fontSize: 14 }} />;
      default:
        return <EmailIcon sx={{ fontSize: 14 }} />;
    }
  };

  // Get source color
  const sourceColor = SOURCE_COLORS[mention.source] || '#666';

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get author display name
  const authorDisplay = mention.authorName || mention.authorEmail || mention.fromEmail || 'Unknown';

  // Get sentiment color
  const getSentimentColor = (sentiment: string | null): string => {
    switch (sentiment) {
      case 'positive':
        return '#4CAF50';
      case 'negative':
        return '#F44336';
      case 'neutral':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        border: '1px solid',
        borderColor: isExpanded ? 'primary.main' : 'transparent',
        overflow: 'hidden',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {/* Header - Always visible */}
      <Box
        onClick={handleToggle}
        sx={{
          p: 1.5,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          '&:hover': {
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,0,0,0.02)',
          },
        }}
      >
        {/* Source icon */}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: `${sourceColor}15`,
            color: sourceColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getSourceIcon()}
        </Box>

        {/* Content preview */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title or snippet */}
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}
          >
            {mention.title || mention.content.slice(0, 100)}
          </Typography>

          {/* Metadata row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <PersonIcon sx={{ fontSize: 12 }} />
              {authorDisplay}
            </Typography>

            {mention.channelName && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                #{mention.channelName}
              </Typography>
            )}

            {mention.labelName && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                {mention.labelName}
              </Typography>
            )}

            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
              {formatDate(mention.sentAt)}
            </Typography>

            {/* Multi-link indicator */}
            {hasMultipleLinks && !isExpanded && (
              <Tooltip title={`Linked to ${mention.linkedCustomerAsks.length + 1} features`} arrow>
                <Chip
                  icon={<LinkIcon sx={{ fontSize: '12px !important' }} />}
                  label={`+${mention.linkedCustomerAsks.length}`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    bgcolor: theme.palette.mode === 'dark'
                      ? 'rgba(33, 150, 243, 0.15)'
                      : 'rgba(33, 150, 243, 0.1)',
                    color: 'info.main',
                    '& .MuiChip-icon': {
                      color: 'info.main',
                      marginLeft: '4px',
                    },
                  }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Expand icon */}
        <IconButton size="small" sx={{ mt: -0.5 }}>
          {isExpanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      {/* Expanded content */}
      <Collapse in={isExpanded}>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          {/* AI Insights section */}
          {mention.aiInsights && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: theme.palette.mode === 'dark'
                  ? 'rgba(156, 39, 176, 0.08)'
                  : 'rgba(156, 39, 176, 0.04)',
                border: '1px solid',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(156, 39, 176, 0.2)'
                  : 'rgba(156, 39, 176, 0.1)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AIIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'secondary.main',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  AI Insights
                </Typography>

                {mention.aiInsights.sentiment && (
                  <Chip
                    label={mention.aiInsights.sentiment}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      bgcolor: `${getSentimentColor(mention.aiInsights.sentiment)}15`,
                      color: getSentimentColor(mention.aiInsights.sentiment),
                      textTransform: 'capitalize',
                      ml: 'auto',
                    }}
                  />
                )}
              </Box>

              {/* Summary */}
              {mention.aiInsights.summary && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      mb: 0.5,
                    }}
                  >
                    Summary
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.primary',
                      lineHeight: 1.5,
                    }}
                  >
                    {mention.aiInsights.summary}
                  </Typography>
                </Box>
              )}

              {/* Pain Point with Quote */}
              {mention.aiInsights.painPoint && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <InsightIcon sx={{ fontSize: 12 }} />
                    Pain Point
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.primary',
                      lineHeight: 1.5,
                    }}
                  >
                    {mention.aiInsights.painPoint}
                  </Typography>

                  {mention.aiInsights.painPointQuote && (
                    <Box
                      sx={{
                        mt: 1,
                        pl: 1.5,
                        borderLeft: '3px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          lineHeight: 1.5,
                        }}
                      >
                        "{mention.aiInsights.painPointQuote}"
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Feature Request */}
              {mention.aiInsights.featureRequest && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      mb: 0.5,
                    }}
                  >
                    Feature Request
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.primary',
                      lineHeight: 1.5,
                    }}
                  >
                    {mention.aiInsights.featureRequest}
                  </Typography>
                </Box>
              )}

              {/* Customer Use Case */}
              {mention.aiInsights.customerUsecase && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      mb: 0.5,
                    }}
                  >
                    Use Case
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.primary',
                      lineHeight: 1.5,
                    }}
                  >
                    {mention.aiInsights.customerUsecase}
                  </Typography>
                </Box>
              )}

              {/* Keywords */}
              {mention.aiInsights.keywords && mention.aiInsights.keywords.length > 0 && (
                <Box>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      mb: 0.5,
                    }}
                  >
                    Keywords
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {mention.aiInsights.keywords.map((keyword, index) => (
                      <Chip
                        key={index}
                        label={keyword}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.625rem',
                          bgcolor: theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.06)',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Linked CustomerAsks - Shows when message links to multiple features */}
          {hasMultipleLinks && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: theme.palette.mode === 'dark'
                  ? 'rgba(33, 150, 243, 0.08)'
                  : 'rgba(33, 150, 243, 0.04)',
                border: '1px dashed',
                borderColor: theme.palette.mode === 'dark'
                  ? 'rgba(33, 150, 243, 0.3)'
                  : 'rgba(33, 150, 243, 0.2)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LinkIcon sx={{ fontSize: 14, color: 'info.main' }} />
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'info.main',
                  }}
                >
                  Also linked to {mention.linkedCustomerAsks.length} other feature{mention.linkedCustomerAsks.length > 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mention.linkedCustomerAsks.map((linkedAsk) => (
                  <Tooltip
                    key={linkedAsk.id}
                    title={linkedAsk.subThemeName ? `${linkedAsk.subThemeName}` : 'Click to view'}
                    arrow
                  >
                    <Chip
                      label={linkedAsk.name}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToCustomerAsk?.(linkedAsk.id);
                      }}
                      sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        bgcolor: theme.palette.mode === 'dark'
                          ? 'rgba(33, 150, 243, 0.15)'
                          : 'rgba(33, 150, 243, 0.1)',
                        color: 'info.main',
                        cursor: onNavigateToCustomerAsk ? 'pointer' : 'default',
                        '&:hover': onNavigateToCustomerAsk ? {
                          bgcolor: theme.palette.mode === 'dark'
                            ? 'rgba(33, 150, 243, 0.25)'
                            : 'rgba(33, 150, 243, 0.2)',
                        } : {},
                        maxWidth: 200,
                        '& .MuiChip-label': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          {/* Original Message */}
          <Box>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.75,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <QuoteIcon sx={{ fontSize: 12 }} />
              Original Message
            </Typography>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: theme.palette.mode === 'dark'
                  ? 'rgba(0,0,0,0.2)'
                  : 'rgba(0,0,0,0.03)',
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  color: 'text.primary',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {mention.content}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default MentionCard;
