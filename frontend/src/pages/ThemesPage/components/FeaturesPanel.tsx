/**
 * FeaturesPanel - Main panel for displaying theme content
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  Tooltip,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import { useThemesPageStore, filterAndSortFeatures } from '../store';
import { FeatureFilters } from './FeatureFilters';
import { FeatureItem } from './FeatureItem';
import { ThemeDashboard, SubThemesView } from './ThemeDashboard';
import { FeaturesLoadingSkeleton } from './ThemesLoadingSkeleton';
import { ThemeWithChildren } from '../types';

export const FeaturesPanel: React.FC = () => {
  const theme = useTheme();
  const {
    hierarchicalThemes,
    selectedThemeForDrawer,
    themeFeatures,
    loadingFeatures,
    showingAllFeatures,
    showingAllFeaturesList,
    showingSubThemes,
    filters,
    openAddModal,
    openMenu,
    setMentionsDrawerOpen,
    setSelectedFeatureForMessages,
    setDrawerLevel,
    fetchFeatureMessages,
  } = useThemesPageStore();

  const filteredAndSortedFeatures = filterAndSortFeatures(themeFeatures, filters);

  const handleShowMessages = (feature: typeof themeFeatures[0]) => {
    setSelectedFeatureForMessages(feature);
    setMentionsDrawerOpen(true);
    setDrawerLevel('mentions');
    fetchFeatureMessages(feature.id);
  };

  // Check if we should show the action bar
  const showActionBar = !showingAllFeatures && (selectedThemeForDrawer || showingAllFeaturesList);

  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minWidth: 0,
      bgcolor: theme.palette.background.default,
      overflow: 'hidden',
    }}>
      {/* Action Bar - Only show when viewing a theme or all features */}
      {showActionBar && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: theme.palette.background.paper,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
          flexShrink: 0,
        }}>
          {/* Theme Actions (for selected theme) */}
          {selectedThemeForDrawer && !showingAllFeaturesList && (
            <Tooltip title="Theme options">
              <IconButton
                size="small"
                onClick={(e) => openMenu(e, selectedThemeForDrawer)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                }}
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Add Feature Button */}
          <Button
            onClick={openAddModal}
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            size="small"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              px: 2,
              py: 0.75,
              borderRadius: 1.5,
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            Add Feature
          </Button>
        </Box>
      )}

      {/* Content Area - Scrollable without visible scrollbar */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        px: 2,
        py: 2,
        // Hide scrollbar but keep functionality
        '&::-webkit-scrollbar': {
          width: 0,
          height: 0,
        },
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE/Edge
      }}>
        {showingAllFeatures ? (
          <ThemeDashboard themes={hierarchicalThemes} />
        ) : showingSubThemes && selectedThemeForDrawer ? (
          <SubThemesView parentTheme={selectedThemeForDrawer as ThemeWithChildren} />
        ) : loadingFeatures ? (
          <FeaturesLoadingSkeleton />
        ) : themeFeatures.length > 0 ? (
          <>
            <FeatureFilters 
              filteredCount={filteredAndSortedFeatures.length} 
              totalCount={themeFeatures.length} 
            />

            <List sx={{ p: 0 }}>
              {filteredAndSortedFeatures.map((feature) => (
                <FeatureItem 
                  key={feature.id}
                  feature={feature} 
                  onShowMessages={handleShowMessages} 
                />
              ))}
            </List>
          </>
        ) : selectedThemeForDrawer || showingAllFeaturesList ? (
          /* Empty State */
          <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 300,
            textAlign: 'center',
          }}>
            <Box sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: alpha(theme.palette.primary.main, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}>
              <InboxIcon sx={{ fontSize: 32, color: alpha(theme.palette.primary.main, 0.5) }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              No Features Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 280, fontSize: '0.85rem' }}>
              {selectedThemeForDrawer 
                ? `Add features to "${selectedThemeForDrawer.name}"`
                : 'Start adding features to track feedback'
              }
            </Typography>
            <Button
              onClick={openAddModal}
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                textTransform: 'none',
                fontWeight: 600,
                px: 2.5,
                borderRadius: 1.5,
              }}
            >
              Add Feature
            </Button>
          </Box>
        ) : (
          /* No Theme Selected - Show Dashboard */
          <ThemeDashboard themes={hierarchicalThemes} />
        )}
      </Box>
    </Box>
  );
};
