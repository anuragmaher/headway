/**
 * ThemesSidebar - Left sidebar with themes list
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Category as CategoryIcon,
  FeaturedPlayList as FeatureIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { ResizablePanel } from '@/shared/components/ResizablePanel';
import { useThemesPageStore } from '@/shared/store/ThemesStore';
import { ThemeRow } from './ThemeRow';

export const ThemesSidebar: React.FC = () => {
  const theme = useTheme();
  const {
    themes,
    hierarchicalThemes,
    showingAllFeatures,
    showingAllFeaturesList,
    selectedThemeForDrawer,
    handleAllThemesClick,
    handleAllFeaturesClick,
    openThemeDialog,
  } = useThemesPageStore();

  const totalFeatureCount = themes.reduce((acc, t) => acc + t.feature_count, 0);

  const isAllThemesSelected = showingAllFeatures && !selectedThemeForDrawer;
  const isAllFeaturesSelected = showingAllFeaturesList && !selectedThemeForDrawer;

  return (
    <ResizablePanel
      storageKey="themes-page-left-panel-width"
      minWidth={260}
      maxWidth={400}
      defaultWidth={300}
    >
      <Card sx={{
        borderRadius: 2,
        background: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.04)}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: alpha(theme.palette.background.default, 0.5),
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}>
              <CategoryIcon sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Themes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {themes.length} theme{themes.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={() => openThemeDialog()}
            size="small"
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
            title="Create New Theme"
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1, p: 1.5 }}>
          {/* Quick Navigation */}
          <Box sx={{ mb: 1.5 }}>
            {/* All Themes / Dashboard */}
            <Box
              onClick={handleAllThemesClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                px: 1.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                bgcolor: isAllThemesSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                border: `1px solid ${isAllThemesSelected ? alpha(theme.palette.primary.main, 0.3) : 'transparent'}`,
                '&:hover': {
                  bgcolor: isAllThemesSelected 
                    ? alpha(theme.palette.primary.main, 0.12)
                    : alpha(theme.palette.action.hover, 0.5),
                },
              }}
            >
              <DashboardIcon sx={{ 
                fontSize: 20, 
                color: isAllThemesSelected ? theme.palette.primary.main : theme.palette.text.secondary 
              }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: isAllThemesSelected ? 600 : 500, 
                  flex: 1,
                  color: isAllThemesSelected ? theme.palette.primary.main : theme.palette.text.primary,
                }}
              >
                Dashboard
              </Typography>
              <Chip 
                label={themes.length} 
                size="small" 
                sx={{ 
                  height: 22, 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: isAllThemesSelected 
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.text.primary, 0.06),
                  color: isAllThemesSelected 
                    ? theme.palette.primary.main 
                    : theme.palette.text.secondary,
                }} 
              />
            </Box>

            {/* All Features */}
            <Box
              onClick={handleAllFeaturesClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                px: 1.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                bgcolor: isAllFeaturesSelected ? alpha(theme.palette.secondary.main, 0.1) : 'transparent',
                border: `1px solid ${isAllFeaturesSelected ? alpha(theme.palette.secondary.main, 0.3) : 'transparent'}`,
                '&:hover': {
                  bgcolor: isAllFeaturesSelected 
                    ? alpha(theme.palette.secondary.main, 0.12)
                    : alpha(theme.palette.action.hover, 0.5),
                },
              }}
            >
              <ViewListIcon sx={{ 
                fontSize: 20, 
                color: isAllFeaturesSelected ? theme.palette.secondary.main : theme.palette.text.secondary 
              }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: isAllFeaturesSelected ? 600 : 500, 
                  flex: 1,
                  color: isAllFeaturesSelected ? theme.palette.secondary.main : theme.palette.text.primary,
                }}
              >
                All Features
              </Typography>
              <Chip 
                label={totalFeatureCount} 
                size="small" 
                sx={{ 
                  height: 22, 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: isAllFeaturesSelected 
                    ? alpha(theme.palette.secondary.main, 0.15)
                    : alpha(theme.palette.text.primary, 0.06),
                  color: isAllFeaturesSelected 
                    ? theme.palette.secondary.main 
                    : theme.palette.text.secondary,
                }} 
              />
            </Box>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          {/* Section Label */}
          <Typography 
            variant="caption" 
            sx={{ 
              px: 1.5, 
              mb: 1, 
              fontWeight: 600, 
              color: alpha(theme.palette.text.secondary, 0.7),
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontSize: '0.65rem',
            }}
          >
            Your Themes
          </Typography>

          {/* Individual Themes */}
          {hierarchicalThemes.length > 0 ? (
            hierarchicalThemes.map((themeItem) => (
              <ThemeRow key={themeItem.id} themeItem={themeItem} />
            ))
          ) : (
            <Box sx={{ 
              textAlign: 'center', 
              py: 4, 
              px: 2,
              color: theme.palette.text.secondary,
            }}>
              <CategoryIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" sx={{ mb: 2 }}>
                No themes yet
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: theme.palette.primary.main, 
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => openThemeDialog()}
              >
                Create your first theme
              </Typography>
            </Box>
          )}
        </Box>
      </Card>
    </ResizablePanel>
  );
};
