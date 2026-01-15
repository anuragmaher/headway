/**
 * ThemeDashboard - Dashboard view showing theme cards
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  FeaturedPlayList as FeatureIcon,
  Category as CategoryIcon,
  ArrowForward as ArrowForwardIcon,
  AccountTree as AccountTreeIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { ThemeWithChildren } from '../types';
import { useThemesPageStore } from '../store';

// Color palette for theme cards
const THEME_COLORS = [
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Green
  '#DC2626', // Red
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

interface ThemeDashboardProps {
  themes: ThemeWithChildren[];
}

export const ThemeDashboard: React.FC<ThemeDashboardProps> = ({ themes }) => {
  const theme = useTheme();
  const { handleThemeClick, openThemeDialog } = useThemesPageStore();

  if (themes.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        textAlign: 'center',
      }}>
        <Box sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: alpha(theme.palette.primary.main, 0.08),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}>
          <CategoryIcon sx={{ fontSize: 36, color: alpha(theme.palette.primary.main, 0.4) }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          No Themes Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 300 }}>
          Create your first theme to start organizing feedback
        </Typography>
        <Button
          onClick={() => openThemeDialog()}
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
          Create Theme
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Compact Summary Stats */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1.5, 
        mb: 2.5,
      }}>
        <Box sx={{
          px: 2,
          py: 1.25,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <CategoryIcon sx={{ color: theme.palette.primary.main, fontSize: 22 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1, fontSize: '1.1rem' }}>
              {themes.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Total Themes
            </Typography>
          </Box>
        </Box>
        <Box sx={{
          px: 2,
          py: 1.25,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.secondary.main, 0.08),
          border: `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <FeatureIcon sx={{ color: theme.palette.secondary.main, fontSize: 22 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1, fontSize: '1.1rem' }}>
              {themes.reduce((acc, t) => acc + t.feature_count, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Total Features
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Theme Cards Grid - Compact */}
      <Grid container spacing={2}>
        {themes.map((themeItem, index) => {
          const accentColor = THEME_COLORS[index % THEME_COLORS.length];
          const hasSubThemes = themeItem.children && themeItem.children.length > 0;
          
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={themeItem.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  height: '100%',
                  minHeight: 140,
                  borderRadius: 2.5,
                  background: theme.palette.background.paper,
                  border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${alpha(accentColor, 0.12)}`,
                    borderColor: alpha(accentColor, 0.25),
                    '& .arrow-icon': {
                      transform: 'translateX(3px)',
                      opacity: 1,
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: accentColor,
                  },
                }}
                onClick={() => handleThemeClick(themeItem)}
              >
                <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: alpha(accentColor, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <CategoryIcon sx={{ color: accentColor, fontSize: 20 }} />
                    </Box>
                    <ArrowForwardIcon 
                      className="arrow-icon"
                      sx={{ 
                        color: accentColor, 
                        fontSize: 18, 
                        opacity: 0,
                        transition: 'all 0.2s ease',
                      }} 
                    />
                  </Box>

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.3, fontSize: '0.9rem' }}>
                    {themeItem.name}
                  </Typography>

                  {themeItem.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 1.5, 
                        flex: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                        fontSize: '0.75rem',
                      }}
                    >
                      {themeItem.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 0.75, mt: 'auto', flexWrap: 'wrap' }}>
                    <Chip
                      icon={<FeatureIcon sx={{ fontSize: '12px !important' }} />}
                      label={`${themeItem.feature_count} features`}
                      size="small"
                      sx={{
                        height: 22,
                        bgcolor: alpha(accentColor, 0.1),
                        color: accentColor,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        '& .MuiChip-icon': { color: accentColor },
                      }}
                    />
                    {hasSubThemes && (
                      <Chip
                        icon={<AccountTreeIcon sx={{ fontSize: '12px !important' }} />}
                        label={`${themeItem.children!.length} sub`}
                        size="small"
                        sx={{
                          height: 22,
                          bgcolor: alpha(theme.palette.text.secondary, 0.06),
                          color: theme.palette.text.secondary,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          '& .MuiChip-icon': { color: theme.palette.text.secondary },
                        }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}

        {/* Add Theme Card - Compact */}
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Card
            sx={{
              cursor: 'pointer',
              height: '100%',
              minHeight: 140,
              borderRadius: 2.5,
              background: 'transparent',
              border: `2px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.03),
              },
            }}
            onClick={() => openThemeDialog()}
          >
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}>
                <AddIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.primary.main, fontSize: '0.85rem' }}>
                Add Theme
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Create new
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

interface SubThemesViewProps {
  parentTheme: ThemeWithChildren;
}

export const SubThemesView: React.FC<SubThemesViewProps> = ({ parentTheme }) => {
  const theme = useTheme();
  const { handleThemeClick } = useThemesPageStore();

  if (!parentTheme.children || parentTheme.children.length === 0) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        py: 6,
        color: theme.palette.text.secondary,
      }}>
        <AccountTreeIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1.5 }} />
        <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 600 }}>
          No sub-themes
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
          This theme doesn't have any sub-themes
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {parentTheme.children.map((childTheme, index) => {
        const accentColor = THEME_COLORS[(index + 2) % THEME_COLORS.length];
        
        return (
          <Grid item xs={12} sm={6} md={4} lg={3} key={childTheme.id}>
            <Card
              sx={{
                cursor: 'pointer',
                height: '100%',
                minHeight: 120,
                borderRadius: 2.5,
                background: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                borderLeft: `3px solid ${accentColor}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${alpha(accentColor, 0.12)}`,
                  '& .arrow-icon': {
                    transform: 'translateX(3px)',
                    opacity: 1,
                  },
                },
              }}
              onClick={() => handleThemeClick(childTheme)}
            >
              <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, lineHeight: 1.3, fontSize: '0.9rem' }}>
                    {childTheme.name}
                  </Typography>
                  <ArrowForwardIcon 
                    className="arrow-icon"
                    sx={{ 
                      color: accentColor, 
                      fontSize: 16, 
                      opacity: 0,
                      transition: 'all 0.2s ease',
                      ml: 1,
                    }} 
                  />
                </Box>

                {childTheme.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 1.5, 
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                      fontSize: '0.75rem',
                    }}
                  >
                    {childTheme.description}
                  </Typography>
                )}

                <Box sx={{ mt: 'auto' }}>
                  <Chip
                    icon={<FeatureIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${childTheme.feature_count} features`}
                    size="small"
                    sx={{
                      height: 22,
                      bgcolor: alpha(accentColor, 0.1),
                      color: accentColor,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      '& .MuiChip-icon': { color: accentColor },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};
