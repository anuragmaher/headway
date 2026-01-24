/**
 * SubThemeSelectionView - Large widget-based sub-theme selection when theme is selected but no sub-theme
 * Shows sub-themes as attractive cards/widgets with back button to themes
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
  ArrowBack as ArrowBackIcon,
  Category as SubThemeIcon,
} from '@mui/icons-material';
import { 
  useSubThemes, 
  useSelectedTheme,
  useIsLoadingSubThemes, 
  useExplorerActions 
} from '../store';
import type { ExplorerSubTheme } from '../types/explorer.types';

interface SubThemeSelectionViewProps {
  onSubThemeSelect: (subThemeId: string) => void;
  onBack: () => void;
}

export const SubThemeSelectionView: React.FC<SubThemeSelectionViewProps> = ({
  onSubThemeSelect,
  onBack,
}) => {
  const muiTheme = useTheme();
  const subThemes: ExplorerSubTheme[] = useSubThemes();
  const selectedTheme = useSelectedTheme();
  const isLoading = useIsLoadingSubThemes();
  const {
    openAddSubThemeDialog,
    openEditSubThemeDialog,
    openDeleteConfirm,
  } = useExplorerActions();

  const getSubThemeColor = () => {
    // Use neutral, professional color for all sub-themes  
    return muiTheme.palette.text.secondary;
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ mb: 0.5 }}>
              {selectedTheme?.name} Sub-Themes
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Loading sub-themes...
            </Typography>
          </Box>
        </Box>
        
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

  if (subThemes.length === 0) {
    return (
      <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            {selectedTheme?.name} Sub-Themes
          </Typography>
        </Box>

        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1,
            textAlign: 'center',
          }}
        >
          <SubThemeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1 }}>
            No Sub-Themes Yet
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3, maxWidth: 400 }}>
            Create sub-themes to better organize customer feedback within "{selectedTheme?.name}".
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openAddSubThemeDialog()}
            size="large"
          >
            Create First Sub-Theme
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4">
              {selectedTheme?.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Sub-Themes
            </Typography>
          </Box>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openAddSubThemeDialog()}
        >
          Add Sub-Theme
        </Button>
      </Box>
      
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4, ml: 7 }}>
        Select a sub-theme to explore customer feedback and requests
      </Typography>

      <Grid container spacing={3}>
        {subThemes.map((subTheme, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={subTheme.id}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: muiTheme.shadows[4] || '0 4px 12px rgba(0,0,0,0.1)',
                  borderColor: muiTheme.palette.info.main,
                  backgroundColor: alpha(muiTheme.palette.info.main, 0.04),
                },
                border: `1px solid ${alpha(muiTheme.palette.divider, 0.2)}`,
              }}
              onClick={() => onSubThemeSelect(subTheme.id)}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Sub-Theme Icon and Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      backgroundColor: alpha(muiTheme.palette.info.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: muiTheme.palette.info.main,
                    }}
                  >
                    <SubThemeIcon sx={{ fontSize: 24 }} />
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit Sub-Theme">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSubThemeDialog(subTheme.id);
                        }}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Sub-Theme">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(subTheme.id, 'subTheme');
                        }}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Sub-Theme Info */}
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
                    {subTheme.name}
                  </Typography>
                  
                  {subTheme.description && (
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
                      {subTheme.description}
                    </Typography>
                  )}
                </Box>

                {/* Sub-Theme Stats */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={`${subTheme.customerAskCount || 0} asks`}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                  
                  <Chip
                    label={`${subTheme.feedbackCount || 0} feedback`}
                    size="small"
                    variant="outlined"
                    color="default"
                  />
                  
                  {subTheme.isLocked && (
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

        {/* Add Sub-Theme Card */}
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
                borderColor: muiTheme.palette.info.main,
                backgroundColor: alpha(muiTheme.palette.info.main, 0.04),
              },
            }}
            onClick={() => openAddSubThemeDialog()}
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
                  backgroundColor: alpha(muiTheme.palette.info.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: muiTheme.palette.info.main,
                  mb: 2,
                }}
              >
                <AddIcon sx={{ fontSize: 24 }} />
              </Box>
              
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                Add Sub-Theme
              </Typography>
              
              <Typography variant="caption" color="textSecondary">
                Create a new sub-theme for {selectedTheme?.name}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};