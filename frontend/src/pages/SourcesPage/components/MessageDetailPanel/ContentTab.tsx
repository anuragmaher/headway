/**
 * ContentTab component - Shows source-specific content
 *
 * Minimalist design optimized for split-screen view
 */

import { Box, Typography, alpha, useTheme, Chip, Link, Divider } from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  AccessTime as DurationIcon,
  Group as ParticipantsIcon,
  PlayArrow as PlayIcon,
  Tag as ChannelIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { MessageDetailsResponse, PartyInfo } from '@/services/sources';

interface ContentTabProps {
  message: MessageDetailsResponse;
}

/**
 * Format date/time for display - compact version
 */
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
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
 * Compact Header with Metadata
 */
function CompactHeader({
  message,
}: {
  message: MessageDetailsResponse;
}): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 2 }}>
      {/* From/To Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <PersonIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
        <Typography
          sx={{
            fontSize: '0.8rem',
            fontWeight: 500,
            color: theme.palette.text.primary,
          }}
        >
          {message.sender}
        </Typography>
        {message.to_emails?.[0] && (
          <>
            <ArrowIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {message.to_emails[0]}
              {message.to_emails.length > 1 && ` +${message.to_emails.length - 1}`}
            </Typography>
          </>
        )}
        {message.channel_name && !message.to_emails?.[0] && (
          <>
            <ArrowIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: theme.palette.text.secondary,
              }}
            >
              #{message.channel_name}
            </Typography>
          </>
        )}
      </Box>

      {/* Meta Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ScheduleIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
          <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled }}>
            {formatDateTime(message.sent_at)}
          </Typography>
        </Box>
        {message.duration_formatted && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DurationIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled }}>
              {message.duration_formatted}
            </Typography>
          </Box>
        )}
        {message.message_count && message.message_count > 1 && (
          <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled }}>
            {message.message_count} messages in thread
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Participants Section (for Gong/Fathom)
 */
function ParticipantsSection({
  message,
}: {
  message: MessageDetailsResponse;
}): JSX.Element | null {
  const theme = useTheme();
  const sourceColor = getSourceColor(message.source, theme);

  const hasParticipants =
    (message.participants && message.participants.length > 0) ||
    (message.parties && message.parties.length > 0);

  if (!hasParticipants) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <ParticipantsIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
        <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled, fontWeight: 600 }}>
          PARTICIPANTS
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
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 500,
                bgcolor: alpha(sourceColor, 0.08),
                color: sourceColor,
                borderRadius: 0.75,
                '& .MuiChip-label': { px: 1 },
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
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 500,
                bgcolor: alpha(sourceColor, 0.08),
                color: sourceColor,
                borderRadius: 0.75,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Recording Link (for Gong/Fathom)
 */
function RecordingLink({
  url,
}: {
  url: string | null | undefined;
}): JSX.Element | null {
  const theme = useTheme();

  if (!url) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '0.75rem',
          color: theme.palette.primary.main,
          textDecoration: 'none',
          fontWeight: 500,
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
          },
        }}
      >
        <PlayIcon sx={{ fontSize: 14 }} />
        View Recording
      </Link>
    </Box>
  );
}

/**
 * Content Body
 */
function ContentBody({
  content,
}: {
  content: string | null | undefined;
}): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.8rem',
          lineHeight: 1.7,
          color: theme.palette.text.secondary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content || 'No content available'}
      </Typography>
    </Box>
  );
}

/**
 * Email Content Component
 */
function EmailContent({ message }: { message: MessageDetailsResponse }): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      <CompactHeader message={message} />
      <Divider sx={{ mb: 2, borderColor: alpha(theme.palette.divider, 0.06) }} />
      <ContentBody content={message.content} />
    </Box>
  );
}

/**
 * Call Content Component (Gong/Fathom)
 */
function CallContent({ message }: { message: MessageDetailsResponse }): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      <CompactHeader message={message} />
      <RecordingLink url={message.recording_url} />
      <ParticipantsSection message={message} />
      <Divider sx={{ mb: 2, borderColor: alpha(theme.palette.divider, 0.06) }} />
      <ContentBody content={message.content} />
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
      <CompactHeader message={message} />
      <Divider sx={{ mb: 2, borderColor: alpha(theme.palette.divider, 0.06) }} />
      <ContentBody content={message.content} />
    </Box>
  );
}

export function ContentTab({ message }: ContentTabProps): JSX.Element {
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
      return <EmailContent message={message} />;
  }
}

export default ContentTab;
