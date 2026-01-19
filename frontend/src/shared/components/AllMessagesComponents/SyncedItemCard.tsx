/**
 * SyncedItemCard - Expandable card component for displaying synced items
 * Shows preview by default, full content when expanded with smooth transitions
 */

import { Box, Typography, Chip, alpha, useTheme, Collapse, IconButton } from '@mui/material';
import {
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tag as SlackIcon,
  Videocam as GongIcon,
  Headphones as FathomIcon,
  CheckCircle as FeatureIcon,
} from '@mui/icons-material';
import { SyncedItem } from '@/shared/store/AllMessagesStore';

interface SyncedItemCardProps {
  item: SyncedItem;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  totalItems: number;
}

/**
 * Format date/time for display
 */
const formatDateTime = (dateString: string | undefined | null): string => {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return 'Unknown date';
  }
};

/**
 * Format duration in seconds to readable string
 */
const formatDuration = (seconds: number | undefined): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

/**
 * Get icon and color config based on item type
 */
const getItemConfig = (type: SyncedItem['type'], theme: ReturnType<typeof useTheme>) => {
  switch (type) {
    case 'gmail_thread':
      return {
        icon: <EmailIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.error.main,
        label: 'Gmail',
      };
    case 'slack_message':
      return {
        icon: <SlackIcon sx={{ fontSize: 16 }} />,
        color: '#E01E5A',
        label: 'Slack',
      };
    case 'gong_call':
      return {
        icon: <GongIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.secondary.main,
        label: 'Gong',
      };
    case 'fathom_session':
      return {
        icon: <FathomIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.success.main,
        label: 'Fathom',
      };
    case 'feature':
      return {
        icon: <FeatureIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.warning.main,
        label: 'Feature',
      };
    default:
      return {
        icon: <EmailIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.primary.main,
        label: 'Item',
      };
  }
};

/**
 * Get title based on item type
 */
const getItemTitle = (item: SyncedItem): string => {
  switch (item.type) {
    case 'gmail_thread':
      return item.subject || '(No Subject)';
    case 'slack_message':
      return item.title || '(No Title)';
    case 'gong_call':
    case 'fathom_session':
      return item.title || 'Untitled Session';
    case 'feature':
      return item.title || 'Untitled Feature';
    default:
      return 'Unknown Item';
  }
};

/**
 * Get subtitle/sender info based on item type
 */
const getItemSubtitle = (item: SyncedItem): string => {
  switch (item.type) {
    case 'gmail_thread':
      return `From: ${item.from_name || item.from_email || 'Unknown'}`;
    case 'slack_message':
      return `From: ${item.author_name || item.author_email || 'Unknown'}`;
    case 'gong_call':
      if (item.customer_info?.name) {
        return `Customer: ${item.customer_info.name}`;
      }
      return item.author_name || item.author_email || 'Call Recording';
    case 'fathom_session':
      if (item.customer_info?.name) {
        return `With: ${item.customer_info.name}`;
      }
      return item.author_name || item.author_email || 'Meeting Recording';
    case 'feature':
      return item.theme_name ? `Theme: ${item.theme_name}` : '';
    default:
      return '';
  }
};

/**
 * Get preview text based on item type
 */
const getItemPreview = (item: SyncedItem): string => {
  switch (item.type) {
    case 'gmail_thread':
      return item.snippet || '';
    case 'slack_message':
    case 'gong_call':
    case 'fathom_session':
      return item.content?.substring(0, 150) || item.snippet || '';
    case 'feature':
      return item.description || '';
    default:
      return '';
  }
};

/**
 * Get full content based on item type
 */
const getItemContent = (item: SyncedItem): string => {
  switch (item.type) {
    case 'gmail_thread':
      return item.content || item.snippet || 'No content available';
    case 'slack_message':
      return item.content || 'No content available';
    case 'gong_call':
    case 'fathom_session':
      return item.transcript || item.content || 'No transcript available';
    case 'feature':
      return item.description || 'No description available';
    default:
      return 'No content available';
  }
};

/**
 * Get timestamp based on item type
 */
const getItemTimestamp = (item: SyncedItem): string | undefined => {
  switch (item.type) {
    case 'gmail_thread':
      return item.thread_date;
    case 'slack_message':
      return item.sent_at;
    case 'gong_call':
    case 'fathom_session':
      return item.sent_at || item.thread_date;
    default:
      return undefined;
  }
};

/**
 * Get tag/label based on item type
 */
const getItemTag = (item: SyncedItem): string | undefined => {
  switch (item.type) {
    case 'gmail_thread':
      return item.label_name;
    case 'slack_message':
      return item.channel_name ? `#${item.channel_name}` : undefined;
    case 'feature':
      return item.theme_name;
    default:
      return undefined;
  }
};

export function SyncedItemCard({
  item,
  isExpanded,
  onToggle,
  index,
  totalItems,
}: SyncedItemCardProps): JSX.Element {
  const theme = useTheme();
  const config = getItemConfig(item.type, theme);
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);
  const preview = getItemPreview(item);
  const content = getItemContent(item);
  const timestamp = getItemTimestamp(item);
  const tag = getItemTag(item);
  const hasExpandableContent = content && content.length > 0;

  return (
    <Box
      sx={{
        py: 1.5,
        px: 0,
        borderBottom: index < totalItems - 1 ? `1px solid ${alpha(theme.palette.divider, 0.05)}` : 'none',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          bgcolor: alpha(theme.palette.action.hover, 0.02),
        },
      }}
    >
      {/* Header Section - Always Visible */}
      <Box
        onClick={hasExpandableContent ? onToggle : undefined}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          cursor: hasExpandableContent ? 'pointer' : 'default',
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(config.color, 0.1),
            color: config.color,
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {config.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: '0.8rem',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: isExpanded ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {title}
            </Typography>
            {hasExpandableContent && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                sx={{
                  p: 0.25,
                  color: theme.palette.text.secondary,
                  transition: 'transform 0.3s ease',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>

          {/* Subtitle */}
          {subtitle && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', display: 'block', mt: 0.25 }}
            >
              {subtitle}
            </Typography>
          )}

          {/* Tag/Label */}
          {tag && (
            <Chip
              label={tag}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                mt: 0.5,
                bgcolor: alpha(config.color, 0.1),
                color: config.color,
              }}
            />
          )}

          {/* Preview (when collapsed) */}
          {!isExpanded && preview && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize: '0.7rem',
                mt: 0.75,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {preview}
            </Typography>
          )}

          {/* Metadata Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {timestamp && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 12, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {formatDateTime(timestamp)}
                </Typography>
              </Box>
            )}
            {item.message_count && item.message_count > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {item.message_count} messages
              </Typography>
            )}
            {(item.duration_formatted || item.duration || item.duration_seconds) && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {item.duration_formatted || formatDuration(item.duration || item.duration_seconds || 0)}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Expanded Content Section */}
      <Collapse in={isExpanded} timeout={300} unmountOnExit>
        <Box
          sx={{
            mt: 1.5,
            ml: 5.5, // Align with content (32px icon + 12px gap)
            p: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              lineHeight: 1.6,
              color: theme.palette.text.secondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 300,
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: 6,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: alpha(theme.palette.divider, 0.3),
                borderRadius: 3,
              },
            }}
          >
            {content}
          </Typography>

          {/* Participants for calls */}
          {(item.participants && item.participants.length > 0) || (item.parties && item.parties.length > 0) ? (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                Participants:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {item.participants?.map((participant, idx) => {
                  // Handle both string and object participants
                  const label = typeof participant === 'string'
                    ? participant
                    : (participant as { name?: string; email?: string })?.name ||
                      (participant as { name?: string; email?: string })?.email ||
                      'Unknown';
                  return (
                    <Chip
                      key={`p-${idx}`}
                      label={label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  );
                })}
                {item.parties?.map((party, idx) => {
                  // Handle party which may have name, email, or role
                  const partyObj = party as { name?: string; email?: string; role?: string };
                  const label = partyObj?.name || partyObj?.email || 'Unknown';
                  return (
                    <Chip
                      key={`party-${idx}`}
                      label={label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Collapse>
    </Box>
  );
}

export default SyncedItemCard;
