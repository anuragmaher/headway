/**
 * SubThemeItem - Individual feature card in the middle column
 * Clean, minimal design showing feature name, source icons, and mention count
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
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  MoreHoriz as DotsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  MergeType as MergeIcon,
  LocalOfferOutlined as SubThemeIcon,
} from '@mui/icons-material';
import type { ExplorerSubTheme, FeedbackSource } from '../../types';

// Source icons as simple SVG components
const SlackIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const GmailIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

const GongIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const FathomIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

const IntercomIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 17H7v-6h4v6zm6 0h-4v-6h4v6zm0-8H7V7h10v2z"/>
  </svg>
);

// Source configuration
const SOURCE_CONFIG: Record<FeedbackSource, { icon: React.FC<{ size?: number }>, color: string, label: string }> = {
  slack: { icon: SlackIcon, color: '#4A154B', label: 'Slack' },
  gmail: { icon: GmailIcon, color: '#EA4335', label: 'Gmail' },
  gong: { icon: GongIcon, color: '#7C5CFF', label: 'Gong' },
  fathom: { icon: FathomIcon, color: '#00D1FF', label: 'Fathom' },
  intercom: { icon: IntercomIcon, color: '#1F8CEB', label: 'Intercom' },
  zendesk: { icon: IntercomIcon, color: '#03363D', label: 'Zendesk' },
  manual: { icon: IntercomIcon, color: '#666666', label: 'Manual' },
};

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
        py: 1.25,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        bgcolor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderLeft: '3px solid',
        borderLeftColor: isSelected ? '#10B981' : 'transparent',
        '&:hover': {
          bgcolor: isSelected
            ? 'rgba(16, 185, 129, 0.12)'
            : muiTheme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Sub-theme icon */}
        <SubThemeIcon
          sx={{
            fontSize: 18,
            color: isSelected ? '#10B981' : 'text.secondary',
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
              {subTheme.name}
            </Typography>
            {subTheme.isLocked && (
              <LockIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
            )}
          </Box>

          {/* Stats row - Source icons and mention count */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
            {/* Source icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {subTheme.sources && subTheme.sources.length > 0 ? (
                subTheme.sources.slice(0, 4).map((source) => {
                  const config = SOURCE_CONFIG[source];
                  if (!config) return null;
                  const IconComponent = config.icon;
                  return (
                    <Tooltip key={source} title={config.label} arrow>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: config.color,
                          opacity: 0.8,
                          '&:hover': { opacity: 1 },
                        }}
                      >
                        <IconComponent size={13} />
                      </Box>
                    </Tooltip>
                  );
                })
              ) : (
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    color: 'text.disabled',
                  }}
                >
                  No sources
                </Typography>
              )}
            </Box>

            {/* Mention count - right bottom */}
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              {subTheme.feedbackCount}
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
