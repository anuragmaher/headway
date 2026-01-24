/**
 * ThemeSelectionView - Large widget-based theme selection when no theme is selected
 * Shows themes as attractive cards/widgets for better initial experience
 */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Skeleton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as ThemeIcon,
} from '@mui/icons-material';
import { useThemes, useIsLoadingThemes, useExplorerActions } from '../store';
import type { ExplorerTheme } from '../types/explorer.types';

interface ThemeSelectionViewProps {
  onThemeSelect: (themeId: string) => void;
}

export const ThemeSelectionView: React.FC<ThemeSelectionViewProps> = ({
  onThemeSelect,
}) => {
  const muiTheme = useTheme();
  const themes: ExplorerTheme[] = useThemes();
  const isLoading = useIsLoadingThemes();
  const {
    openAddThemeDialog,
    openEditThemeDialog,
    openDeleteConfirm,
  } = useExplorerActions();

  const getThemeColor = () => {
    // Use neutral, professional color for all themes
    return muiTheme.palette.text.secondary;
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 1, textAlign: 'center' }}>
          Product Themes
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, textAlign: 'center' }}>
          Loading your product themes...
        </Typography>
        
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
                  <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
                  <Skeleton variant="text" width="100%" height={16} sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                    <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (themes.length === 0) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          p: 4,
          textAlign: 'center',
        }}
      >
        <ThemeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h4" sx={{ mb: 1 }}>
          No Themes Yet
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 3, maxWidth: 400 }}>
          Create your first product theme to start organizing customer feedback and feature requests.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openAddThemeDialog()}
          size="large"
        >
          Create Your First Theme
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4">
          Product Themes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openAddThemeDialog()}
        >
          Add Theme
        </Button>
      </Box>
      
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Select a theme to explore its sub-themes and customer feedback
      </Typography>

      <Grid container spacing={3}>
        {themes.map((theme, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={theme.id}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: muiTheme.shadows[4] || '0 4px 12px rgba(0,0,0,0.1)',
                  borderColor: muiTheme.palette.primary.main,
                  backgroundColor: alpha(muiTheme.palette.primary.main, 0.04),
                },
                border: `1px solid ${alpha(muiTheme.palette.divider, 0.2)}`,
              }}
              onClick={() => onThemeSelect(theme.id)}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Theme Icon and Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      backgroundColor: alpha(muiTheme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: muiTheme.palette.primary.main,
                    }}
                  >
                    <ThemeIcon sx={{ fontSize: 24 }} />
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit Theme">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditThemeDialog(theme.id);
                        }}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Theme">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(theme.id, 'theme');
                        }}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Theme Info */}
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      mb: 1, 
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: 'text.primary',
                    }}
                  >
                    {theme.name}
                  </Typography>
                  
                  {theme.description && (
                    <Typography 
                      variant="body2" 
                      color="textSecondary" 
                      sx={{ 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                      }}
                    >
                      {theme.description}
                    </Typography>
                  )}
                </Box>

                {/* Theme Stats */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={`${theme.subThemeCount || 0} sub-themes`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                  
                  <Chip
                    label={`${theme.customerAskCount || 0} asks`}
                    size="small"
                    variant="outlined"
                    color="default"
                  />
                  
                  <Chip
                    label={`${theme.feedbackCount || 0} feedback`}
                    size="small"
                    variant="outlined"
                    color="default"
                  />
                  
                  {theme.isLocked && (
                    <Chip
                      label="Locked"
                      size="small"
                      color="warning"
                      variant="filled"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add Theme Card */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Card
            sx={{
              cursor: 'pointer',
              height: '100%',
              border: `1px solid ${alpha(muiTheme.palette.divider, 0.2)}`,
              backgroundColor: 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: muiTheme.shadows[4] || '0 4px 12px rgba(0,0,0,0.1)',
                borderColor: muiTheme.palette.primary.main,
                backgroundColor: alpha(muiTheme.palette.primary.main, 0.04),
              },
            }}
            onClick={() => openAddThemeDialog()}
          >
            <CardContent 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                textAlign: 'center',
                p: 3,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: alpha(muiTheme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: muiTheme.palette.primary.main,
                  mb: 2,
                }}
              >
                <AddIcon sx={{ fontSize: 24 }} />
              </Box>
              
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                Add New Theme
              </Typography>
              
              <Typography variant="caption" color="textSecondary">
                Create a new product theme
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};