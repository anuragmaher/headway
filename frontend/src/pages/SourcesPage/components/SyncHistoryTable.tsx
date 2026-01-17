/**
 * SyncHistoryTable component - Displays sync history in a table format
 */

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
  useTheme,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Videocam as VideocamIcon,
  Headphones as HeadphonesIcon,
  Tag as SlackIcon,
  Sync as SyncIcon,
  AutoAwesome as ThemeSyncIcon,
  CheckCircle as SuccessIcon,
  Schedule as ScheduleIcon,
  LocalOffer as TagIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { SyncHistoryItem, SourceType } from '../types';

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

interface SyncHistoryTableProps {
  items: SyncHistoryItem[];
  onRowClick?: (item: SyncHistoryItem) => void;
}

const getSourceIcon = (source: SourceType | undefined, size: 'small' | 'medium' = 'medium') => {
  const fontSize = size === 'small' ? 14 : 16;
  switch (source) {
    case 'gmail':
    case 'outlook':
      return <EmailIcon sx={{ fontSize }} />;
    case 'gong':
      return <VideocamIcon sx={{ fontSize }} />;
    case 'fathom':
      return <HeadphonesIcon sx={{ fontSize }} />;
    case 'slack':
      return <SlackIcon sx={{ fontSize }} />;
    default:
      return <EmailIcon sx={{ fontSize }} />;
  }
};

const getSourceColor = (source: SourceType | undefined, theme: ReturnType<typeof useTheme>) => {
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

export function SyncHistoryTable({ items, onRowClick }: SyncHistoryTableProps): JSX.Element {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No sync history found matching your filters
        </Typography>
      </Box>
    );
  }

  const headerCellSx = {
    fontWeight: 600,
    fontSize: '0.7rem',
    color: theme.palette.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
    py: 1.25,
    px: 2,
  };

  const bodyCellSx = {
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
    py: 1.5,
    px: 2,
  };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Type</TableCell>
            <TableCell sx={headerCellSx}>Source / Theme</TableCell>
            <TableCell sx={headerCellSx}>Status</TableCell>
            <TableCell sx={headerCellSx}>Started At</TableCell>
            <TableCell align="right" sx={headerCellSx}>Checked</TableCell>
            <TableCell align="right" sx={headerCellSx}>New Data</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              onClick={() => onRowClick?.(item)}
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.action.hover, 0.03),
                },
                cursor: 'pointer',
              }}
            >
              {/* Type */}
              <TableCell sx={bodyCellSx}>
                <Chip
                  icon={item.type === 'source' 
                    ? <SyncIcon sx={{ fontSize: 12 }} /> 
                    : <ThemeSyncIcon sx={{ fontSize: 12 }} />
                  }
                  label={item.type === 'source' ? 'Source Sync' : 'Theme Sync'}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    bgcolor: item.type === 'source'
                      ? alpha(theme.palette.text.primary, 0.05)
                      : alpha(theme.palette.secondary.main, 0.1),
                    color: item.type === 'source'
                      ? theme.palette.text.secondary
                      : theme.palette.secondary.main,
                    borderRadius: 1,
                    '& .MuiChip-icon': { color: 'inherit' },
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </TableCell>

              {/* Source / Theme */}
              <TableCell sx={bodyCellSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  {item.type === 'source' ? (
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(getSourceColor(item.sourceType, theme), 0.1),
                        color: getSourceColor(item.sourceType, theme),
                      }}
                    >
                      {getSourceIcon(item.sourceType)}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                      }}
                    >
                      <TagIcon sx={{ fontSize: 16 }} />
                    </Box>
                  )}
                  <Box>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.name}
                    </Typography>
                    {item.type === 'theme' && item.sourceIcons && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <Typography
                          sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}
                        >
                          from
                        </Typography>
                        {item.sourceIcons.map((source, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              color: getSourceColor(source, theme),
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {getSourceIcon(source, 'small')}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </TableCell>

              {/* Status */}
              <TableCell sx={bodyCellSx}>
                <Box>
                  <Chip
                    icon={
                      item.status === 'success' ? (
                        <SuccessIcon sx={{ fontSize: 12 }} />
                      ) : item.status === 'in_progress' ? (
                        <CircularProgress size={10} sx={{ color: 'inherit' }} />
                      ) : (
                        <ScheduleIcon sx={{ fontSize: 12 }} />
                      )
                    }
                    label={item.status === 'success' ? 'Success' : item.status === 'in_progress' ? 'In Progress' : 'Failed'}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      bgcolor: item.status === 'success'
                        ? alpha(theme.palette.success.main, 0.1)
                        : item.status === 'in_progress'
                        ? alpha(theme.palette.warning.main, 0.1)
                        : alpha(theme.palette.error.main, 0.1),
                      color: item.status === 'success'
                        ? theme.palette.success.main
                        : item.status === 'in_progress'
                        ? theme.palette.warning.main
                        : theme.palette.error.main,
                      borderRadius: 1,
                      '& .MuiChip-icon': { color: 'inherit' },
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                  {item.status === 'failed' && item.errorMessage && (
                    <Typography
                      sx={{
                        fontSize: '0.65rem',
                        color: theme.palette.error.main,
                        mt: 0.5,
                        lineHeight: 1.2,
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.errorMessage}
                    >
                      {item.errorMessage}
                    </Typography>
                  )}
                </Box>
              </TableCell>

              {/* Started At */}
              <TableCell sx={bodyCellSx}>
                <Tooltip title={getFullDateTime(item.startedAt)} arrow placement="top">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'default' }}>
                    <ScheduleIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
                    <Typography
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.75rem',
                      }}
                    >
                      {formatDateTime(item.startedAt)}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>

              {/* Checked - items that were scanned/checked */}
              <TableCell align="right" sx={bodyCellSx}>
                <Tooltip title="Total items checked during sync" arrow placement="top">
                  <Typography
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      color: theme.palette.text.secondary,
                      cursor: 'default',
                    }}
                  >
                    {item.processed.toLocaleString()}
                  </Typography>
                </Tooltip>
              </TableCell>

              {/* New Data - new items that were synced */}
              <TableCell align="right" sx={bodyCellSx}>
                <Tooltip title="New items added to database" arrow placement="top">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, cursor: 'default' }}>
                    {item.newItems > 0 && <AddIcon sx={{ fontSize: 12, color: theme.palette.success.main }} />}
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: item.newItems > 0 ? theme.palette.success.main : theme.palette.text.secondary,
                      }}
                    >
                      {item.newItems.toLocaleString()}
                    </Typography>
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default SyncHistoryTable;
