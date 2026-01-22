/**
 * CustomerAskCard - Card component for displaying a customer ask
 * Shows name, urgency, status, and mention count
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  TrendingUp as TrendingIcon,
  ChatBubbleOutline as MentionsIcon,
} from '@mui/icons-material';
import type { CustomerAskItem, CustomerAskStatus, UrgencyLevel } from '../../types';
import {
  URGENCY_COLORS,
  CUSTOMER_ASK_STATUS_LABELS,
  CUSTOMER_ASK_STATUS_COLORS,
} from '../../types';

interface CustomerAskCardProps {
  customerAsk: CustomerAskItem;
  isSelected: boolean;
  onSelect: (customerAskId: string) => void;
  onStatusChange?: (customerAskId: string, status: CustomerAskStatus) => void;
}

export const CustomerAskCard: React.FC<CustomerAskCardProps> = ({
  customerAsk,
  isSelected,
  onSelect,
  onStatusChange,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChange = (status: CustomerAskStatus) => {
    if (onStatusChange) {
      onStatusChange(customerAsk.id, status);
    }
    handleMenuClose();
  };

  const urgencyColor = URGENCY_COLORS[customerAsk.urgency as UrgencyLevel] || URGENCY_COLORS.medium;
  const statusColor = CUSTOMER_ASK_STATUS_COLORS[customerAsk.status] || '#666';
  const statusLabel = CUSTOMER_ASK_STATUS_LABELS[customerAsk.status] || customerAsk.status;

  // Format relative time
  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  return (
    <Box
      onClick={() => onSelect(customerAsk.id)}
      sx={{
        p: 1.5,
        mb: 1,
        borderRadius: 1.5,
        cursor: 'pointer',
        bgcolor: isSelected
          ? theme.palette.mode === 'dark'
            ? 'rgba(25, 118, 210, 0.16)'
            : 'rgba(25, 118, 210, 0.08)'
          : 'background.paper',
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          bgcolor: isSelected
            ? theme.palette.mode === 'dark'
              ? 'rgba(25, 118, 210, 0.20)'
              : 'rgba(25, 118, 210, 0.12)'
            : theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: isSelected ? 'primary.main' : 'action.hover',
        },
      }}
    >
      {/* Header with name and menu */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {customerAsk.name}
          </Typography>

          {customerAsk.description && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                mt: 0.5,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {customerAsk.description}
            </Typography>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={handleMenuClick}
          sx={{ mt: -0.5, mr: -0.5 }}
        >
          <MoreIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Status and metrics row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 1.5,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {/* Left side: Status chip and urgency indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 600,
              bgcolor: `${statusColor}15`,
              color: statusColor,
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />

          {/* Urgency indicator */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: urgencyColor,
              }}
            />
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: 'text.disabled',
                textTransform: 'capitalize',
              }}
            >
              {customerAsk.urgency}
            </Typography>
          </Box>
        </Box>

        {/* Right side: Metrics */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Mention count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MentionsIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {customerAsk.mentionCount}
            </Typography>
          </Box>

          {/* Last mentioned */}
          <Typography
            sx={{
              fontSize: '0.6875rem',
              color: 'text.disabled',
            }}
          >
            {formatRelativeTime(customerAsk.lastMentionedAt)}
          </Typography>
        </Box>
      </Box>

      {/* Status change menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          onClick={() => handleStatusChange('new')}
          selected={customerAsk.status === 'new'}
          sx={{ fontSize: '0.875rem' }}
        >
          New
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('under_review')}
          selected={customerAsk.status === 'under_review'}
          sx={{ fontSize: '0.875rem' }}
        >
          Under Review
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('planned')}
          selected={customerAsk.status === 'planned'}
          sx={{ fontSize: '0.875rem' }}
        >
          Planned
        </MenuItem>
        <MenuItem
          onClick={() => handleStatusChange('shipped')}
          selected={customerAsk.status === 'shipped'}
          sx={{ fontSize: '0.875rem' }}
        >
          Shipped
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CustomerAskCard;
