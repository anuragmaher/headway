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
  alpha,
  Chip,
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
        mx: 1.5,
        my: 1,
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        bgcolor: isSelected 
          ? alpha(muiTheme.palette.info.main, 0.1)
          : 'background.paper',
        border: `1px solid ${
          isSelected 
            ? muiTheme.palette.info.main 
            : alpha(muiTheme.palette.divider, 0.3)
        }`,
        boxShadow: isSelected 
          ? `0 2px 8px ${alpha(muiTheme.palette.info.main, 0.15)}`
          : '0 1px 3px rgba(0,0,0,0.05)',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: isSelected
            ? `0 4px 12px ${alpha(muiTheme.palette.info.main, 0.2)}`
            : '0 2px 8px rgba(0,0,0,0.1)',
          borderColor: isSelected 
            ? muiTheme.palette.info.main 
            : muiTheme.palette.divider,
          bgcolor: isSelected
            ? alpha(muiTheme.palette.info.main, 0.12)
            : alpha(muiTheme.palette.action.hover, 0.04),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        {/* Sub-theme icon with background */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: isSelected
              ? alpha(muiTheme.palette.info.main, 0.15)
              : alpha(muiTheme.palette.info.main, 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSelected ? muiTheme.palette.info.main : muiTheme.palette.info.main,
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          <SubThemeIcon sx={{ fontSize: 20 }} />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: isSelected ? 600 : 500,
                color: 'text.primary',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subTheme.name}
            </Typography>
            {subTheme.isLocked && (
              <Tooltip title="Locked">
                <LockIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
              </Tooltip>
            )}
          </Box>

          {/* Stats row - Source icons and mention count */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            {/* Source icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {subTheme.sources && subTheme.sources.length > 0 ? (
                subTheme.sources.slice(0, 4).map((source) => {
                  const config = SOURCE_CONFIG[source];
                  if (!config) return null;
                  const IconComponent = config.icon;
                  return (
                    <Tooltip key={source} title={config.label} arrow>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(config.color, 0.1),
                          color: config.color,
                          transition: 'all 0.2s ease',
                          '&:hover': { 
                            bgcolor: alpha(config.color, 0.2),
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        <IconComponent size={12} />
                      </Box>
                    </Tooltip>
                  );
                })
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontSize: '0.7rem',
                  }}
                >
                  No sources
                </Typography>
              )}
            </Box>

            {/* Mention count badge - only show if count > 0 */}
            {(subTheme.feedbackCount || 0) > 0 && (
              <Chip
                label={subTheme.feedbackCount}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: isSelected
                    ? alpha(muiTheme.palette.info.main, 0.2)
                    : alpha(muiTheme.palette.info.main, 0.12),
                  color: muiTheme.palette.info.main,
                  border: `1px solid ${alpha(muiTheme.palette.info.main, 0.3)}`,
                  '& .MuiChip-label': {
                    px: 1.25,
                    py: 0,
                  },
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
              opacity: 0.7,
              transition: 'all 0.2s ease',
              '&:hover': {
                opacity: 1,
                bgcolor: alpha(muiTheme.palette.action.hover, 0.1),
                transform: 'scale(1.1)',
              },
            }}
          >
            <DotsIcon sx={{ fontSize: 18 }} />
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
