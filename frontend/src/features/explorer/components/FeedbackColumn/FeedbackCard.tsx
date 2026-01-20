/**
 * FeedbackCard - Individual message card with collapsible content
 * Shows preview by default, expands on click to show full message
 * Source-specific formatting for Slack, Gmail, transcripts
 */
import React, { useState } from 'react';
import { Box, Typography, Chip, Collapse, IconButton, Divider } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
  Chat as ChatIcon,
  VideoCall as VideoCallIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { formatRelativeTime } from '../../utils/dateUtils';
import type { FeedbackItem, FeedbackSource } from '../../types';

interface FeedbackCardProps {
  feedback: FeedbackItem;
  isSelected: boolean;
  onSelect: (feedbackId: string) => void;
  onExpand?: (feedbackId: string) => void;
}

const SOURCE_COLORS: Record<FeedbackSource, string> = {
  slack: '#4A154B',
  gmail: '#EA4335',
  gong: '#7C5CFF',
  fathom: '#00D1FF',
  intercom: '#1F8CEB',
  zendesk: '#03363D',
  manual: '#666666',
};

const SOURCE_LABELS: Record<FeedbackSource, string> = {
  slack: 'Slack',
  gmail: 'Email',
  gong: 'Call',
  fathom: 'Call',
  intercom: 'Chat',
  zendesk: 'Ticket',
  manual: 'Note',
};

const SOURCE_ICONS: Record<FeedbackSource, React.ReactNode> = {
  slack: <ChatIcon sx={{ fontSize: 14 }} />,
  gmail: <EmailIcon sx={{ fontSize: 14 }} />,
  gong: <VideoCallIcon sx={{ fontSize: 14 }} />,
  fathom: <VideoCallIcon sx={{ fontSize: 14 }} />,
  intercom: <ChatIcon sx={{ fontSize: 14 }} />,
  zendesk: <PersonIcon sx={{ fontSize: 14 }} />,
  manual: <PersonIcon sx={{ fontSize: 14 }} />,
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  feedback,
  isSelected,
  onSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    onSelect(feedback.id);
  };

  const timeAgo = formatRelativeTime(feedback.receivedAt);
  const sourceColor = SOURCE_COLORS[feedback.source] || SOURCE_COLORS.manual;
  const sourceIcon = SOURCE_ICONS[feedback.source] || SOURCE_ICONS.manual;

  // Get preview text (first 100 chars)
  const content = feedback.originalContent || feedback.summary || '';
  const previewText = content.length > 100 ? content.slice(0, 100) + '...' : content;

  return (
    <Box
      sx={{
        mb: 1,
        borderRadius: 1.5,
        transition: 'all 0.15s ease',
        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.04)' : 'background.paper',
        border: '1px solid',
        borderColor: isExpanded
          ? 'rgba(59, 130, 246, 0.3)'
          : isSelected
            ? 'rgba(59, 130, 246, 0.2)'
            : 'divider',
        overflow: 'hidden',
        '&:hover': {
          borderColor: 'rgba(59, 130, 246, 0.25)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        },
      }}
    >
      {/* Collapsed Header - Always Visible */}
      <Box
        onClick={handleToggleExpand}
        sx={{
          p: 1.5,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        {/* Source Icon */}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${sourceColor}12`,
            color: sourceColor,
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {sourceIcon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Top Row: Name + Source + Time */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {feedback.contactName || 'Unknown'}
            </Typography>
            <Chip
              label={SOURCE_LABELS[feedback.source]}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.5625rem',
                fontWeight: 600,
                bgcolor: `${sourceColor}15`,
                color: sourceColor,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', flexShrink: 0 }}>
              {timeAgo}
            </Typography>
          </Box>

          {/* Channel/Subject */}
          {(feedback.sourceChannel || feedback.title) && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {feedback.source === 'gmail' && feedback.title
                ? `Subject: ${feedback.title}`
                : feedback.sourceChannel
                  ? `#${feedback.sourceChannel}`
                  : feedback.title}
            </Typography>
          )}

          {/* Preview Text */}
          {!isExpanded && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                lineHeight: 1.4,
                color: 'text.disabled',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {previewText}
            </Typography>
          )}
        </Box>

        {/* Expand Button */}
        <IconButton
          size="small"
          onClick={handleToggleExpand}
          sx={{
            width: 24,
            height: 24,
            color: 'text.disabled',
            '&:hover': { color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.04)' },
          }}
        >
          {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {/* Expanded Content */}
      <Collapse in={isExpanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
          {/* Source-specific content rendering */}
          {renderSourceContent(feedback)}
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * Render source-specific message content
 */
function renderSourceContent(feedback: FeedbackItem): React.ReactNode {
  const { source, originalContent, title, contactName, contactEmail, sourceChannel } = feedback;

  switch (source) {
    case 'gmail':
      return (
        <Box>
          {/* Email Header */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', width: 50 }}>From:</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 500 }}>
                {contactName} {contactEmail && `<${contactEmail}>`}
              </Typography>
            </Box>
            {title && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', width: 50 }}>Subject:</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 500 }}>{title}</Typography>
              </Box>
            )}
          </Box>
          {/* Email Body */}
          <Typography
            sx={{
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {originalContent}
          </Typography>
        </Box>
      );

    case 'slack':
      return (
        <Box>
          {/* Slack-style message */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* Avatar placeholder */}
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: '#4A154B',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {(contactName || 'U').charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ flex: 1 }}>
              {/* Name + Channel */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.primary' }}>
                  {contactName}
                </Typography>
                {sourceChannel && (
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                    in #{sourceChannel}
                  </Typography>
                )}
              </Box>
              {/* Message */}
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: 'text.primary',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {originalContent}
              </Typography>
            </Box>
          </Box>
        </Box>
      );

    case 'gong':
    case 'fathom':
      return (
        <Box>
          {/* Call Transcript Header */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <VideoCallIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                Call Transcript
              </Typography>
            </Box>
            {title && (
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                {title}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', mt: 0.5 }}>
              Participant: {contactName}
            </Typography>
          </Box>
          {/* Transcript Content */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.8125rem',
                lineHeight: 1.7,
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
              }}
            >
              {originalContent}
            </Typography>
          </Box>
        </Box>
      );

    case 'intercom':
    case 'zendesk':
      return (
        <Box>
          {/* Support Ticket Header */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
              {source === 'intercom' ? 'Intercom Conversation' : 'Support Ticket'}
            </Typography>
            {title && (
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', fontWeight: 500 }}>
                {title}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', mt: 0.5 }}>
              From: {contactName} {contactEmail && `(${contactEmail})`}
            </Typography>
          </Box>
          {/* Message */}
          <Typography
            sx={{
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {originalContent}
          </Typography>
        </Box>
      );

    default:
      return (
        <Typography
          sx={{
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            color: 'text.primary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {originalContent}
        </Typography>
      );
  }
}

export default FeedbackCard;
