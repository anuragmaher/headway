import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  alpha,
  useTheme,
  Box,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { Theme } from '../../types';

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  depth?: number;
  onSelect: (themeId: string) => void;
  onToggleExpansion: (themeId: string) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, theme: Theme) => void;
  menuAnchorEl: HTMLElement | null;
  selectedThemeForMenu: Theme | null;
  onMenuClose: () => void;
  onMenuAction: (action: 'edit' | 'delete' | 'add-sub') => void;
}

export const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  isSelected,
  isExpanded,
  hasChildren,
  depth = 0,
  onSelect,
  onToggleExpansion,
  onMenuOpen,
  menuAnchorEl,
  selectedThemeForMenu,
  onMenuClose,
  onMenuAction,
}) => {
  const muiTheme = useTheme();
  const isMenuOpen = Boolean(menuAnchorEl) && selectedThemeForMenu?.id === theme.id;

  const handleCardClick = () => {
    onSelect(theme.id);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpansion(theme.id);
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onMenuOpen(e, theme);
  };

  return (
    <>
      <Card
        sx={{
          mb: 1,
          ml: depth * 2,
          cursor: 'pointer',
          backgroundColor: isSelected 
            ? alpha(muiTheme.palette.primary.main, 0.1)
            : muiTheme.palette.background.paper,
          borderLeft: isSelected 
            ? `3px solid ${muiTheme.palette.primary.main}`
            : 'none',
          '&:hover': {
            backgroundColor: alpha(muiTheme.palette.primary.main, 0.05),
          },
        }}
        onClick={handleCardClick}
      >
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              {hasChildren && (
                <IconButton
                  size="small"
                  onClick={handleExpandClick}
                  sx={{ mr: 1, p: 0.5 }}
                >
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
              )}
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    color: isSelected ? muiTheme.palette.primary.main : 'inherit',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {theme.name}
                </Typography>
                
                {theme.description && (
                  <Typography 
                    variant="caption" 
                    color="textSecondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mt: 0.5,
                    }}
                  >
                    {theme.description}
                  </Typography>
                )}
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                  <Chip
                    label={`${theme.feature_count || 0} features`}
                    size="small"
                    variant="outlined"
                    color={theme.feature_count > 0 ? "primary" : "default"}
                  />
                  
                  {theme.parent_theme_id && (
                    <Chip
                      label="Sub-theme"
                      size="small"
                      variant="filled"
                      sx={{ 
                        backgroundColor: alpha(muiTheme.palette.secondary.main, 0.1),
                        color: muiTheme.palette.secondary.main,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
            
            <IconButton
              size="small"
              onClick={handleMenuClick}
              sx={{ ml: 1 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={onMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => onMenuAction('edit')}>
          Edit Theme
        </MenuItem>
        <MenuItem onClick={() => onMenuAction('add-sub')}>
          Add Sub-theme
        </MenuItem>
        <MenuItem onClick={() => onMenuAction('delete')} sx={{ color: 'error.main' }}>
          Delete Theme
        </MenuItem>
      </Menu>
    </>
  );
};









