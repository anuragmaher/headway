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
} from '@mui/material';
import {
  MoreHoriz as DotsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import type { ExplorerTheme } from '../../types';

interface ThemeItemProps {
  theme: ExplorerTheme;
  isSelected: boolean;
  onSelect: (themeId: string) => void;
  onEdit?: (themeId: string) => void;
  onDelete?: (themeId: string) => void;
  onLock?: (themeId: string) => void;
  onUnlock?: (themeId: string) => void;
}

export const ThemeItem: React.FC<ThemeItemProps> = ({
  theme,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onLock,
  onUnlock,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

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
        py: 1,
        mx: 0.75,
        my: 0.25,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        borderLeft: '2px solid',
        borderColor: isSelected ? theme.color || '#3B82F6' : 'transparent',
        '&:hover': {
          bgcolor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      {/* Color dot */}
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: theme.color || '#3B82F6',
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
        </Box>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            color: 'text.disabled',
            mt: 0.25,
          }}
        >
          {theme.subThemeCount} features · {theme.feedbackCount} mentions
        </Typography>
      </Box>

      {/* Menu button */}
      {(isHovered || Boolean(anchorEl)) && (
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            p: 0.25,
            opacity: 0.6,
            '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.06)' },
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
              minWidth: 140,
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
