/**
 * ThemeSelector - Dropdown for selecting themes (used in header)
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Category as CategoryIcon,
  Dashboard as DashboardIcon,
  ViewList as ViewListIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useThemesPageStore } from '../store';

export const ThemeSelector: React.FC = () => {
  const theme = useTheme();
  const {
    themes,
    hierarchicalThemes,
    selectedThemeForDrawer,
    themeFeatures,
    showingAllFeatures,
    showingAllFeaturesList,
    openThemeDialog,
    handleAllThemesClick,
    handleAllFeaturesClick,
    handleThemeClick,
  } = useThemesPageStore();

  const [themeMenuAnchor, setThemeMenuAnchor] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const totalFeatureCount = themes.reduce((acc, t) => acc + t.feature_count, 0);

  // Filter themes based on search
  const filteredThemes = hierarchicalThemes.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current view info
  const getCurrentViewInfo = () => {
    if (showingAllFeatures) {
      return { 
        title: 'Dashboard', 
        subtitle: `${themes.length} themes`,
        icon: DashboardIcon,
        color: theme.palette.primary.main 
      };
    }
    if (showingAllFeaturesList) {
      return { 
        title: 'All Features', 
        subtitle: `${totalFeatureCount} features`,
        icon: ViewListIcon,
        color: theme.palette.secondary.main 
      };
    }
    if (selectedThemeForDrawer) {
      return { 
        title: selectedThemeForDrawer.name, 
        subtitle: `${themeFeatures.length} feature${themeFeatures.length !== 1 ? 's' : ''}`,
        icon: CategoryIcon,
        color: theme.palette.primary.main 
      };
    }
    return { 
      title: 'Themes', 
      subtitle: 'Select a theme',
      icon: CategoryIcon,
      color: theme.palette.primary.main 
    };
  };

  const viewInfo = getCurrentViewInfo();
  const ViewIcon = viewInfo.icon;

  return (
    <>
      <Button
        onClick={(e) => setThemeMenuAnchor(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 2,
          bgcolor: alpha(viewInfo.color, 0.08),
          border: `1px solid ${alpha(viewInfo.color, 0.15)}`,
          textTransform: 'none',
          minWidth: 180,
          justifyContent: 'flex-start',
          '&:hover': {
            bgcolor: alpha(viewInfo.color, 0.12),
            borderColor: alpha(viewInfo.color, 0.25),
          },
        }}
      >
        <Box sx={{
          width: 28,
          height: 28,
          borderRadius: 1.5,
          bgcolor: viewInfo.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ViewIcon sx={{ color: 'white', fontSize: 16 }} />
        </Box>
        <Box sx={{ flex: 1, textAlign: 'left' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
            {viewInfo.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
            {viewInfo.subtitle}
          </Typography>
        </Box>
        <ArrowDownIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
      </Button>

      {/* Theme Selector Menu */}
      <Menu
        anchorEl={themeMenuAnchor}
        open={Boolean(themeMenuAnchor)}
        onClose={() => setThemeMenuAnchor(null)}
        PaperProps={{
          sx: {
            mt: 0.5,
            minWidth: 260,
            maxHeight: 360,
            borderRadius: 2,
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
          }
        }}
      >
        {/* Search */}
        <Box sx={{ px: 1.5, py: 1 }}>
          <TextField
            size="small"
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: 1.5, fontSize: '0.8rem', py: 0 }
            }}
          />
        </Box>
        
        <Divider />

        {/* Quick Access */}
        <MenuItem 
          onClick={() => { handleAllThemesClick(); setThemeMenuAnchor(null); }}
          selected={showingAllFeatures}
          sx={{ py: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DashboardIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText 
            primary="Dashboard" 
            secondary={`${themes.length} themes`}
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.7rem' }}
          />
        </MenuItem>

        <MenuItem 
          onClick={() => { handleAllFeaturesClick(); setThemeMenuAnchor(null); }}
          selected={showingAllFeaturesList}
          sx={{ py: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ViewListIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
          </ListItemIcon>
          <ListItemText 
            primary="All Features" 
            secondary={`${totalFeatureCount} features`}
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.7rem' }}
          />
        </MenuItem>

        {filteredThemes.length > 0 && <Divider sx={{ my: 0.5 }} />}

        {/* Theme List */}
        <Box sx={{ maxHeight: 180, overflow: 'auto' }}>
          {filteredThemes.map((themeItem) => (
            <MenuItem
              key={themeItem.id}
              onClick={() => { handleThemeClick(themeItem); setThemeMenuAnchor(null); }}
              selected={selectedThemeForDrawer?.id === themeItem.id && !showingAllFeatures && !showingAllFeaturesList}
              sx={{ py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CategoryIcon sx={{ fontSize: 18, color: alpha(theme.palette.text.primary, 0.5) }} />
              </ListItemIcon>
              <ListItemText 
                primary={themeItem.name}
                primaryTypographyProps={{ fontSize: '0.85rem' }}
              />
              <Chip 
                label={themeItem.feature_count} 
                size="small" 
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                }} 
              />
            </MenuItem>
          ))}
        </Box>

        <Divider sx={{ my: 0.5 }} />

        {/* Create New Theme */}
        <MenuItem 
          onClick={() => { openThemeDialog(); setThemeMenuAnchor(null); }}
          sx={{ py: 1, color: theme.palette.primary.main }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <AddIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText 
            primary="Create New Theme"
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};
