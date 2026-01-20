/**
 * SubThemeItem - Individual feature card in the middle column
 * Clean, minimal design showing feature name and mention count
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
  Chip,
  useTheme,
} from '@mui/material';
import {
  MoreHoriz as DotsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  MergeType as MergeIcon,
} from '@mui/icons-material';
import type { ExplorerSubTheme } from '../../types';

interface SubThemeItemProps {
  subTheme: ExplorerSubTheme;
  isSelected: boolean;
  onSelect: (subThemeId: string) => void;
  onEdit?: (subThemeId: string) => void;
  onDelete?: (subThemeId: string) => void;
  onMerge?: (subThemeId: string) => void;
  onLock?: (subThemeId: string) => void;
  onUnlock?: (subThemeId: string) => void;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
};

export const SubThemeItem: React.FC<SubThemeItemProps> = ({
  subTheme,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onMerge,
  onLock,
  onUnlock,
}) => {
  const muiTheme = useTheme();
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
    onEdit?.(subTheme.id);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete?.(subTheme.id);
    handleMenuClose();
  };

  const handleMerge = () => {
    onMerge?.(subTheme.id);
    handleMenuClose();
  };

  const handleToggleLock = () => {
    if (subTheme.isLocked) {
      onUnlock?.(subTheme.id);
    } else {
      onLock?.(subTheme.id);
    }
    handleMenuClose();
  };

  const urgencyColor = URGENCY_COLORS[subTheme.urgency || 'medium'] || URGENCY_COLORS.medium;

  return (
    <Box
      onClick={() => onSelect(subTheme.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        px: 1.5,
        py: 1,
        mx: 0.75,
        my: 0.25,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        borderLeft: '2px solid',
        borderColor: isSelected ? '#3B82F6' : 'transparent',
        '&:hover': {
          bgcolor: isSelected
            ? 'rgba(59, 130, 246, 0.12)'
            : muiTheme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? 'text.primary' : 'text.secondary',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {subTheme.name}
            </Typography>
            {subTheme.isLocked && (
              <LockIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
            )}
          </Box>

          {/* Stats row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              label={`${subTheme.feedbackCount} mentions`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                fontWeight: 600,
                bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: 'text.secondary',
                '& .MuiChip-label': { px: 1 },
              }}
            />
            {subTheme.urgency && subTheme.urgency !== 'medium' && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: urgencyColor,
                }}
              />
            )}
          </Box>
        </Box>

        {/* Menu button */}
        {(isHovered || Boolean(anchorEl)) && (
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{
              p: 0.25,
              mt: 0.25,
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
      </Box>

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
        <MenuItem onClick={handleMerge} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
          <ListItemIcon>
            <MergeIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primary="Merge into..." primaryTypographyProps={{ fontSize: '0.8125rem' }} />
        </MenuItem>
        <MenuItem onClick={handleToggleLock} sx={{ fontSize: '0.8125rem', py: 0.75 }}>
          <ListItemIcon>
            {subTheme.isLocked ? <LockOpenIcon sx={{ fontSize: 16 }} /> : <LockIcon sx={{ fontSize: 16 }} />}
          </ListItemIcon>
          <ListItemText primary={subTheme.isLocked ? 'Unlock' : 'Lock'} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
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

export default SubThemeItem;
