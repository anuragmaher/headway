/**
 * ThemeItem - Individual theme card in the left column
 * Clean, minimal design inspired by Linear/Notion
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  MoreHoriz as DotsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Layers as ThemeIcon,
} from '@mui/icons-material';
import type { ExplorerTheme } from '../../types';

// Slack icon component
const SlackIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
  </svg>
);

interface ThemeItemProps {
  theme: ExplorerTheme;
  isSelected: boolean;
  onSelect: (themeId: string) => void;
  onEdit?: (themeId: string) => void;
  onDelete?: (themeId: string) => void;
  onLock?: (themeId: string) => void;
  onUnlock?: (themeId: string) => void;
  onConnectSlack?: (themeId: string) => void;
  onDisconnectSlack?: (themeId: string) => void;
}

export const ThemeItem: React.FC<ThemeItemProps> = ({
  theme,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onLock,
  onUnlock,
  onConnectSlack,
  onDisconnectSlack,
}) => {
  const muiTheme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isSlackConnected = Boolean(theme.slackChannelId);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    onEdit?.(theme.id);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete?.(theme.id);
    handleMenuClose();
  };

  const handleToggleLock = () => {
    if (theme.isLocked) {
      onUnlock?.(theme.id);
    } else {
      onLock?.(theme.id);
    }
    handleMenuClose();
  };

  const handleSlackConnect = () => {
    onConnectSlack?.(theme.id);
    handleMenuClose();
  };

  const handleSlackDisconnect = () => {
    onDisconnectSlack?.(theme.id);
    handleMenuClose();
  };

  return (
    <Box
      onClick={() => onSelect(theme.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderLeft: '3px solid',
        borderLeftColor: isSelected ? 'primary.main' : 'transparent',
        '&:hover': {
          bgcolor: isSelected
            ? 'rgba(59, 130, 246, 0.12)'
            : muiTheme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      {/* Theme icon */}
      <ThemeIcon
        sx={{
          fontSize: 18,
          color: isSelected ? 'primary.main' : 'text.secondary',
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? 'text.primary' : 'text.secondary',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {theme.name}
          </Typography>
          {theme.isLocked && (
            <LockIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
          )}
          {/* Slack connected indicator */}
          {isSlackConnected && (
            <Tooltip title={`Connected to #${theme.slackChannelName}`} arrow placement="top">
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <SlackIcon size={11} color={muiTheme.palette.mode === 'dark' ? '#E8E8E8' : '#4A154B'} />
              </Box>
            </Tooltip>
          )}
        </Box>
        {/* Stats row - Sub-theme count and mention count */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              color: 'text.disabled',
            }}
          >
            {theme.subThemeCount} sub-theme{theme.subThemeCount !== 1 ? 's' : ''}
          </Typography>
          {/* Mention count - right side */}
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            {theme.feedbackCount}
          </Typography>
        </Box>
      </Box>

      {/* Menu button */}
      {(isHovered || Boolean(anchorEl)) && (
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            p: 0.25,
            opacity: 0.6,
            '&:hover': {
              opacity: 1,
              bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          }}
        >
          <DotsIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              borderRadius: 1.5,
            },
          },
        }}
      >
        <MenuItem onClick={handleEdit} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
          <ListItemIcon>
            <EditIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primary="Rename" primaryTypographyProps={{ fontSize: '0.8125rem' }} />
        </MenuItem>
        <MenuItem onClick={handleToggleLock} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
          <ListItemIcon>
            {theme.isLocked ? <LockOpenIcon sx={{ fontSize: 16 }} /> : <LockIcon sx={{ fontSize: 16 }} />}
          </ListItemIcon>
          <ListItemText primary={theme.isLocked ? 'Unlock' : 'Lock'} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Slack Integration Options */}
        {isSlackConnected ? (
          <MenuItem onClick={handleSlackDisconnect} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
            <ListItemIcon>
              <SlackIcon size={16} color={muiTheme.palette.text.secondary} />
            </ListItemIcon>
            <ListItemText
              primary="Disconnect Slack"
              secondary={`#${theme.slackChannelName}`}
              primaryTypographyProps={{ fontSize: '0.8125rem' }}
              secondaryTypographyProps={{ fontSize: '0.6875rem' }}
            />
          </MenuItem>
        ) : (
          <MenuItem onClick={handleSlackConnect} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
            <ListItemIcon>
              <SlackIcon size={16} color={muiTheme.palette.text.secondary} />
            </ListItemIcon>
            <ListItemText
              primary="Connect to Slack"
              secondary="Get notifications"
              primaryTypographyProps={{ fontSize: '0.8125rem' }}
              secondaryTypographyProps={{ fontSize: '0.6875rem' }}
            />
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleDelete} sx={{ fontSize: '0.8125rem', py: 0.75, color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ fontSize: '0.8125rem' }} />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ThemeItem;
