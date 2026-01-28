/**
 * ThemeSelectionView - Large widget-based theme selection when no theme is selected
 * Shows themes as attractive cards/widgets for better initial experience
 */
import React, { useState, useEffect } from 'react';
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
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as ThemeIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useThemes, useIsLoadingThemes, useExplorerActions } from '../store';
import type { ExplorerTheme } from '../types/explorer.types';
import { useTranscriptCounts } from '../hooks/useTranscriptCounts';
import { ConnectSlackDialog } from './dialogs/ConnectSlackDialog';
import { slackService } from '@/services/slack';
import { themeService } from '@/services/theme';

// Slack icon component
const SlackIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
  </svg>
);

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
    fetchThemes,
  } = useExplorerActions();
  const { themeCounts } = useTranscriptCounts();

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedMenuTheme, setSelectedMenuTheme] = useState<ExplorerTheme | null>(null);

  // Slack integration state
  const [hasSlackIntegration, setHasSlackIntegration] = useState(false);
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackDialogThemeId, setSlackDialogThemeId] = useState<string>('');
  const [slackDialogThemeName, setSlackDialogThemeName] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Check if workspace has Slack integration
  useEffect(() => {
    const checkSlackIntegration = async () => {
      try {
        const integrations = await slackService.getIntegrations();
        setHasSlackIntegration(integrations.length > 0);
      } catch {
        setHasSlackIntegration(false);
      }
    };
    checkSlackIntegration();
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, theme: ExplorerTheme) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedMenuTheme(theme);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedMenuTheme(null);
  };

  const handleEditFromMenu = () => {
    if (selectedMenuTheme) {
      openEditThemeDialog(selectedMenuTheme.id);
    }
    handleMenuClose();
  };

  const handleDeleteFromMenu = () => {
    if (selectedMenuTheme) {
      openDeleteConfirm(selectedMenuTheme.id, 'theme');
    }
    handleMenuClose();
  };

  const handleConnectSlackFromMenu = () => {
    if (selectedMenuTheme) {
      setSlackDialogThemeId(selectedMenuTheme.id);
      setSlackDialogThemeName(selectedMenuTheme.name);
      setSlackDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDisconnectSlack = async () => {
    if (selectedMenuTheme) {
      try {
        await themeService.disconnectThemeFromSlack(selectedMenuTheme.id);
        setSnackbar({
          open: true,
          message: 'Slack channel disconnected',
          severity: 'success',
        });
        fetchThemes();
      } catch {
        setSnackbar({
          open: true,
          message: 'Failed to disconnect Slack channel',
          severity: 'error',
        });
      }
    }
    handleMenuClose();
  };

  const handleSlackConnectSuccess = () => {
    setSnackbar({
      open: true,
      message: 'Slack channel connected successfully',
      severity: 'success',
    });
    fetchThemes();
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

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
        {[...themes]
          .sort((a, b) => (b.feedbackCount || 0) - (a.feedbackCount || 0))
          .map((theme) => (
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
                  
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, theme)}
                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                  >
                    <MoreVertIcon sx={{ fontSize: 18 }} />
                  </IconButton>
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
                    label={`${themeCounts[theme.id] || 0} transcript${(themeCounts[theme.id] || 0) !== 1 ? 's' : ''}`}
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

      {/* Theme Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              borderRadius: 1.5,
            },
          },
        }}
      >
        <MenuItem onClick={handleEditFromMenu} sx={{ fontSize: '0.875rem', py: 1 }}>
          <ListItemIcon>
            <EditIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primary="Edit Theme" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>

        {hasSlackIntegration && (
          <>
            <Divider sx={{ my: 0.5 }} />
            {selectedMenuTheme?.slackChannelId ? (
              <MenuItem onClick={handleDisconnectSlack} sx={{ fontSize: '0.875rem', py: 1 }}>
                <ListItemIcon>
                  <SlackIcon size={18} color={muiTheme.palette.text.secondary} />
                </ListItemIcon>
                <ListItemText
                  primary="Disconnect Slack"
                  secondary={`#${selectedMenuTheme.slackChannelName}`}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </MenuItem>
            ) : (
              <MenuItem onClick={handleConnectSlackFromMenu} sx={{ fontSize: '0.875rem', py: 1 }}>
                <ListItemIcon>
                  <SlackIcon size={18} color={muiTheme.palette.text.secondary} />
                </ListItemIcon>
                <ListItemText
                  primary="Connect Slack Channel"
                  secondary="Get notifications"
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </MenuItem>
            )}
          </>
        )}

        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleDeleteFromMenu} sx={{ fontSize: '0.875rem', py: 1, color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon sx={{ fontSize: 18, color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText primary="Delete Theme" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>
      </Menu>

      {/* Slack Connection Dialog */}
      <ConnectSlackDialog
        open={slackDialogOpen}
        onClose={() => setSlackDialogOpen(false)}
        themeId={slackDialogThemeId}
        themeName={slackDialogThemeName}
        onSuccess={handleSlackConnectSuccess}
      />

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};