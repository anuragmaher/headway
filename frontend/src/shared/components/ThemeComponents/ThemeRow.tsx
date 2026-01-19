/**
 * ThemeRow - Individual theme row in the sidebar
 */

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  FeaturedPlayList as FeatureIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  MoreVert as MoreVertIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { ThemeWithChildren } from '@/shared/types/ThemesTypes';
import { useThemesPageStore } from '@/shared/store/ThemesStore';

interface ThemeRowProps {
  themeItem: ThemeWithChildren;
  level?: number;
  onCloseMobileDrawer?: () => void;
}

export const ThemeRow: React.FC<ThemeRowProps> = ({ 
  themeItem, 
  level = 0,
  onCloseMobileDrawer 
}) => {
  const theme = useTheme();
  const { 
    expandedThemes, 
    selectedThemeForDrawer,
    showingAllFeatures,
    showingAllFeaturesList,
    toggleThemeExpansion, 
    handleThemeClick, 
    openMenu 
  } = useThemesPageStore();
  
  const indentWidth = level * 20;
  const hasChildren = themeItem.children && themeItem.children.length > 0;
  const isExpanded = expandedThemes.has(themeItem.id);
  const isSelected = selectedThemeForDrawer?.id === themeItem.id && !showingAllFeatures && !showingAllFeaturesList;

  const handleClick = () => {
    handleThemeClick(themeItem);
    onCloseMobileDrawer?.();
  };

  return (
    <React.Fragment>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1,
          px: 1.5,
          ml: `${indentWidth}px`,
          borderRadius: 1.5,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          mb: 0.5,
          position: 'relative',
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
          border: `1px solid ${isSelected ? alpha(theme.palette.primary.main, 0.3) : 'transparent'}`,
          '&:hover': {
            bgcolor: isSelected 
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.action.hover, 0.5),
          },
          '&:hover .theme-menu-button': {
            opacity: 1,
          }
        }}
        onClick={handleClick}
      >
        {/* Expand/Collapse button or folder icon */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleThemeExpansion(themeItem.id);
            }}
            sx={{
              width: 24,
              height: 24,
              mr: 0.75,
              color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }
            }}
          >
            {isExpanded ? (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ 
            width: 24, 
            height: 24, 
            mr: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {level > 0 ? (
              <Box sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: isSelected ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.3),
              }} />
            ) : (
              <FeatureIcon sx={{ 
                fontSize: 18, 
                color: isSelected ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.5) 
              }} />
            )}
          </Box>
        )}

        {/* Theme name */}
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: isSelected ? 600 : 500, 
            fontSize: '0.875rem',
            flex: 1,
            color: isSelected ? theme.palette.primary.main : theme.palette.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {themeItem.name}
        </Typography>

        {/* Feature Count Badge */}
        <Chip 
          label={themeItem.feature_count} 
          size="small" 
          sx={{ 
            height: 20, 
            minWidth: 28,
            fontSize: '0.7rem',
            fontWeight: 600,
            bgcolor: isSelected 
              ? alpha(theme.palette.primary.main, 0.15)
              : alpha(theme.palette.text.primary, 0.06),
            color: isSelected 
              ? theme.palette.primary.main 
              : theme.palette.text.secondary,
            '& .MuiChip-label': {
              px: 0.75,
            },
          }} 
        />

        {/* Actions - Dropdown Menu */}
        <IconButton
          className="theme-menu-button"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            openMenu(e, themeItem);
          }}
          sx={{
            width: 24,
            height: 24,
            ml: 0.5,
            opacity: 0,
            transition: 'opacity 0.15s ease',
            color: theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main
            }
          }}
          title="More options"
        >
          <MoreVertIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Render sub-themes when expanded */}
      {hasChildren && isExpanded && themeItem.children.map((childTheme) => (
        <ThemeRow 
          key={childTheme.id} 
          themeItem={childTheme} 
          level={level + 1}
          onCloseMobileDrawer={onCloseMobileDrawer}
        />
      ))}
    </React.Fragment>
  );
};
