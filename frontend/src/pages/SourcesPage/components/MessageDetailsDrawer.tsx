/**
 * MessageDetailsDrawer - Drawer component showing full message details
 * Similar to SyncDetailsDrawer but for individual messages
 */

import { useEffect, useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Tag as SlackIcon,
  Videocam as GongIcon,
  Headphones as FathomIcon,
  CheckCircle as ProcessedIcon,
  PendingOutlined as PendingIcon,
  Folder as FolderIcon,
  AccessTime as DurationIcon,
  Group as ParticipantsIcon,
  Business as CustomerIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { MessageDetailsResponse } from '@/services/sources';
import sourcesService from '@/services/sources';

interface MessageDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  messageId: string | null;
  workspaceId: string;
}

/**
 * Format date/time for display
 */
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Unknown date';
  }
};

/**
 * Get source icon and color config
 */
const getSourceConfig = (source: string, theme: ReturnType<typeof useTheme>) => {
  switch (source) {
    case 'gmail':
      return {
        icon: <EmailIcon sx={{ fontSize: 20 }} />,
        color: theme.palette.error.main,
        label: 'Gmail',
      };
    case 'slack':
      return {
        icon: <SlackIcon sx={{ fontSize: 20 }} />,
        color: '#E01E5A',
        label: 'Slack',
      };
    case 'gong':
      return {
        icon: <GongIcon sx={{ fontSize: 20 }} />,
        color: theme.palette.secondary.main,
        label: 'Gong Call',
      };
    case 'fathom':
      return {
        icon: <FathomIcon sx={{ fontSize: 20 }} />,
        color: theme.palette.success.main,
        label: 'Fathom',
      };
    default:
      return {
        icon: <EmailIcon sx={{ fontSize: 20 }} />,
        color: theme.palette.primary.main,
        label: 'Message',
      };
  }
};

/**
 * Info row component for metadata display
 */
function InfoRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  color?: string;
}): JSX.Element | null {
  const theme = useTheme();

  if (!value) return null;

  // Check if value is a string or ReactNode
  const isStringValue = typeof value === 'string';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Box
        sx={{
          color: color || theme.palette.text.secondary,
          display: 'flex',
          alignItems: 'center',
          mt: 0.25,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}
        >
          {label}
        </Typography>
        {isStringValue ? (
          <Typography variant="body2" component="span" sx={{ fontSize: '0.8rem', mt: 0.25, display: 'block' }}>
            {value}
          </Typography>
        ) : (
          <Box sx={{ fontSize: '0.8rem', mt: 0.25 }}>
            {value}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function MessageDetailsDrawer({
  open,
  onClose,
  messageId,
  workspaceId,
}: MessageDetailsDrawerProps): JSX.Element {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<MessageDetailsResponse | null>(null);

  useEffect(() => {
    if (open && messageId && workspaceId) {
      fetchDetails();
    } else {
      // Reset state when drawer closes
      setDetails(null);
      setError(null);
    }
  }, [open, messageId, workspaceId]);

  const fetchDetails = async () => {
    if (!messageId || !workspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await sourcesService.getMessageDetails(workspaceId, messageId);
      setDetails(data);
    } catch (err) {
      console.error('Error fetching message details:', err);
      setError('Failed to load message details');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDetails(null);
    setError(null);
    onClose();
  };

  const sourceConfig = details ? getSourceConfig(details.source, theme) : null;

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">
            Loading message details...
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!details) {
      return null;
    }

    return (
      <Box>
        {/* Source Badge */}
        <Box sx={{ mb: 2 }}>
          <Chip
            icon={sourceConfig?.icon}
            label={sourceConfig?.label}
            size="small"
            sx={{
              bgcolor: alpha(sourceConfig?.color || theme.palette.primary.main, 0.1),
              color: sourceConfig?.color,
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: 'inherit',
              },
            }}
          />
          {details.is_processed ? (
            <Chip
              icon={<ProcessedIcon sx={{ fontSize: 14 }} />}
              label="Processed"
              size="small"
              sx={{
                ml: 1,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          ) : (
            <Chip
              icon={<PendingIcon sx={{ fontSize: 14 }} />}
              label="Pending"
              size="small"
              sx={{
                ml: 1,
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: theme.palette.warning.main,
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', mb: 2, lineHeight: 1.3 }}>
          {details.title}
        </Typography>

        {/* Metadata Section */}
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 1.5,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            mb: 2,
          }}
        >
          <InfoRow
            icon={<PersonIcon sx={{ fontSize: 16 }} />}
            label="From"
            value={
              <>
                <Typography variant="body2" component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, display: 'block' }}>
                  {details.sender}
                </Typography>
                {details.sender_email && details.sender_email !== details.sender && (
                  <Typography variant="caption" component="span" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                    {details.sender_email}
                  </Typography>
                )}
              </>
            }
          />

          {details.channel_name && (
            <InfoRow
              icon={<FolderIcon sx={{ fontSize: 16 }} />}
              label={details.source === 'slack' ? 'Channel' : 'Label/Folder'}
              value={details.source === 'slack' ? `#${details.channel_name}` : details.channel_name}
            />
          )}

          <InfoRow
            icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
            label="Date"
            value={formatDateTime(details.sent_at)}
          />

          {/* Gmail specific: To emails */}
          {details.to_emails && details.to_emails.length > 0 && (
            <InfoRow
              icon={<PersonIcon sx={{ fontSize: 16 }} />}
              label="To"
              value={details.to_emails.join(', ')}
            />
          )}

          {/* Gmail specific: Message count */}
          {details.message_count && details.message_count > 1 && (
            <InfoRow
              icon={<EmailIcon sx={{ fontSize: 16 }} />}
              label="Messages in thread"
              value={`${details.message_count} messages`}
            />
          )}

          {/* Gong/Fathom: Duration */}
          {details.duration_formatted && (
            <InfoRow
              icon={<DurationIcon sx={{ fontSize: 16 }} />}
              label="Duration"
              value={details.duration_formatted}
            />
          )}

          {/* Gong/Fathom: Customer info */}
          {details.customer_info && (
            <InfoRow
              icon={<CustomerIcon sx={{ fontSize: 16 }} />}
              label="Customer"
              value={
                <>
                  <Typography variant="body2" component="span" sx={{ fontSize: '0.8rem', display: 'block' }}>
                    {details.customer_info.name}
                  </Typography>
                  {details.customer_info.email && (
                    <Typography variant="caption" component="span" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                      {details.customer_info.email}
                    </Typography>
                  )}
                </>
              }
            />
          )}

          {/* Recording URL */}
          {details.recording_url && (
            <InfoRow
              icon={<LinkIcon sx={{ fontSize: 16 }} />}
              label="Recording"
              value={
                <Typography
                  component="a"
                  href={details.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: '0.8rem',
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  View Recording
                </Typography>
              }
            />
          )}
        </Box>

        {/* Participants for calls */}
        {((details.participants && details.participants.length > 0) ||
          (details.parties && details.parties.length > 0)) && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ParticipantsIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                Participants
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {details.participants?.map((participant, idx) => {
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
                      height: 24,
                      fontSize: '0.7rem',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  />
                );
              })}
              {details.parties?.map((party, idx) => {
                // Handle party which may have name, email, or role
                const partyObj = party as { name?: string; email?: string; role?: string };
                const label = partyObj?.name || partyObj?.email || 'Unknown';
                return (
                  <Chip
                    key={`party-${idx}`}
                    label={label}
                    size="small"
                    sx={{
                      height: 24,
                      fontSize: '0.7rem',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Related Features */}
        {details.related_features && details.related_features.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}
            >
              Related Features
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {details.related_features.map((feature) => (
                <Chip
                  key={feature.id}
                  label={feature.title}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.main,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Content Section */}
        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontSize: '0.7rem', mb: 1, display: 'block' }}
          >
            {details.source === 'gong' || details.source === 'fathom' ? 'Transcript' : 'Content'}
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.background.default, 0.5),
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              maxHeight: 400,
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
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8rem',
                lineHeight: 1.7,
                color: theme.palette.text.secondary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {details.content || 'No content available'}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 480,
          maxWidth: '90vw',
          bgcolor: theme.palette.background.paper,
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          Message Details
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5, overflow: 'auto', flex: 1 }}>
        {renderContent()}
      </Box>
    </Drawer>
  );
}

export default MessageDetailsDrawer;
