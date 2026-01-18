/**
 * MessageList component - Displays list of synced messages
 */

import {
  Box,
  Typography,
  List,
  ListItem,
  Chip,
  alpha,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Videocam as VideocamIcon,
  Headphones as HeadphonesIcon,
  Tag as SlackIcon,
} from '@mui/icons-material';
import { Message, MessageType } from '../types';

/**
 * Format date/time according to user's locale and timezone
 */
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return '-';

    // Format with user's locale - shows date and time
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '-';
  }
};

/**
 * Get full date/time string for tooltip
 */
const getFullDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return '';
  }
};

interface MessageListProps {
  messages: Message[];
  onMessageClick?: (messageId: string) => void;
}

const getMessageIcon = (type: MessageType) => {
  switch (type) {
    case 'email':
      return <EmailIcon sx={{ fontSize: 18 }} />;
    case 'transcript':
      return <VideocamIcon sx={{ fontSize: 18 }} />;
    case 'meeting':
      return <HeadphonesIcon sx={{ fontSize: 18 }} />;
    case 'slack':
      return <SlackIcon sx={{ fontSize: 18 }} />;
    default:
      return <EmailIcon sx={{ fontSize: 18 }} />;
  }
};

const getIconColor = (type: MessageType, theme: ReturnType<typeof useTheme>) => {
  switch (type) {
    case 'email':
      return theme.palette.primary.main;
    case 'transcript':
      return theme.palette.secondary.main;
    case 'meeting':
      return theme.palette.success.main;
    case 'slack':
      return '#E01E5A';
    default:
      return theme.palette.primary.main;
  }
};

const getTypeLabel = (type: MessageType) => {
  switch (type) {
    case 'email':
      return 'Email';
    case 'transcript':
      return 'Transcript';
    case 'meeting':
      return 'Transcript';
    case 'slack':
      return 'Slack';
    default:
      return 'Message';
  }
};

export function MessageList({ messages, onMessageClick }: MessageListProps): JSX.Element {
  const theme = useTheme();

  if (messages.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No messages found matching your filters
        </Typography>
      </Box>
    );
  }

  const handleMessageClick = (messageId: string) => {
    if (onMessageClick) {
      onMessageClick(messageId);
    }
  };

  return (
    <List disablePadding>
      {messages.map((message, index) => (
        <ListItem
          key={message.id}
          onClick={() => handleMessageClick(message.id)}
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            borderBottom: index < messages.length - 1
              ? `1px solid ${alpha(theme.palette.divider, 0.06)}`
              : 'none',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.04),
            },
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(getIconColor(message.sourceType, theme), 0.1),
              color: getIconColor(message.sourceType, theme),
              flexShrink: 0,
            }}
          >
            {getMessageIcon(message.sourceType)}
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.primary,
                lineHeight: 1.3,
                mb: 0.25,
              }}
            >
              {message.title}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                }}
              >
                {message.sender}
              </Typography>
              <Chip
                label={getTypeLabel(message.sourceType)}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  color: theme.palette.text.secondary,
                  borderRadius: 0.75,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>

            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.75rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {message.preview}
            </Typography>
          </Box>

          {/* Timestamp */}
          <Tooltip title={getFullDateTime(message.timestamp)} arrow placement="top">
            <Typography
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.7rem',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              {formatDateTime(message.timestamp)}
            </Typography>
          </Tooltip>
        </ListItem>
      ))}
    </List>
  );
}

export default MessageList;
