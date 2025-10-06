/**
 * Themes page for managing and organizing feature request themes
 */

import React, { useState, useEffect } from 'react';
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
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  Drawer,
} from '@mui/material';
import {
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingIcon,
  FeaturedPlayList as FeatureIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';

interface Theme {
  id: string;
  name: string;
  description: string;
  feature_count: number;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

interface ThemeFormData {
  name: string;
  description: string;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  urgency: string;
  status: string;
  mention_count: number;
  theme_id: string | null;
  first_mentioned: string;
  last_mentioned: string;
  created_at: string;
  updated_at: string | null;
}

interface Message {
  id: string;
  content: string;
  sent_at: string;
  sender_name: string;
  channel_name: string;
}

export function ThemesPage(): JSX.Element {
  const theme = useTheme();
  const { tokens } = useAuthStore();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [formData, setFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedThemeForDrawer, setSelectedThemeForDrawer] = useState<Theme | null>(null);
  const [themeFeatures, setThemeFeatures] = useState<Feature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [messagesDrawerOpen, setMessagesDrawerOpen] = useState(false);
  const [selectedFeatureForMessages, setSelectedFeatureForMessages] = useState<Feature | null>(null);
  const [featureMessages, setFeatureMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchThemes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch themes: ${response.status}`);
      }

      const themesData = await response.json();
      setThemes(themesData);

      // Auto-select first theme
      if (themesData.length > 0) {
        setSelectedThemeId(themesData[0].id);
      }

    } catch (error) {
      console.error('Error fetching themes:', error);
      setError(error instanceof Error ? error.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleOpenDialog = (themeToEdit?: Theme) => {
    if (themeToEdit) {
      setEditingTheme(themeToEdit);
      setFormData({
        name: themeToEdit.name,
        description: themeToEdit.description,
      });
    } else {
      setEditingTheme(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTheme(null);
  };

  const handleSubmit = async () => {
    try {
      const token = getAuthToken();

      if (editingTheme) {
        // Update existing theme
        const response = await fetch(
          `http://localhost:8000/api/v1/themes/${editingTheme.id}?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update theme: ${response.status}`);
        }
      } else {
        // Create new theme
        const response = await fetch(
          `http://localhost:8000/api/v1/themes?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to create theme: ${response.status}`);
        }
      }

      handleCloseDialog();
      fetchThemes(); // Refresh themes list
    } catch (error) {
      console.error('Error saving theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to save theme');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/themes/${themeId}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete theme: ${response.status}`);
      }

      fetchThemes(); // Refresh themes list
      if (selectedThemeId === themeId) {
        setSelectedThemeId(themes[0]?.id || '');
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete theme');
    }
  };

  const fetchThemeFeatures = async (themeId: string) => {
    try {
      setLoadingFeatures(true);
      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/features/features?workspace_id=${WORKSPACE_ID}&theme_id=${themeId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const features = await response.json();
      setThemeFeatures(features);
    } catch (error) {
      console.error('Error fetching theme features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const handleThemeClick = (theme: Theme) => {
    setSelectedThemeForDrawer(theme);
    setDrawerOpen(true);
    fetchThemeFeatures(theme.id);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedThemeForDrawer(null);
    setThemeFeatures([]);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const fetchFeatureMessages = async (featureId: string) => {
    try {
      setLoadingMessages(true);
      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/features/features/${featureId}/messages?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const messages = await response.json();
      setFeatureMessages(messages);
    } catch (error) {
      console.error('Error fetching feature messages:', error);
      setFeatureMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleShowMessages = (feature: Feature) => {
    setSelectedFeatureForMessages(feature);
    setMessagesDrawerOpen(true);
    fetchFeatureMessages(feature.id);
  };

  const handleBackToFeatures = () => {
    setMessagesDrawerOpen(false);
    setSelectedFeatureForMessages(null);
    setFeatureMessages([]);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const selectedTheme = themes.find(t => t.id === selectedThemeId) || themes[0];

  const totalFeatures = themes.reduce((acc, t) => acc + t.feature_count, 0);

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading themes...
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box>
        {/* Header */}
        <Box sx={{
          mb: 3,
          p: 3,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}>
                <CategoryIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Theme Management
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Organize and categorize feature requests by themes
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchThemes}
                sx={{ borderRadius: 2 }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                }}
              >
                Create Theme
              </Button>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Overview */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CategoryIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {themes.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Themes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.06)} 0%, ${alpha(theme.palette.success.main, 0.03)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100())`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {totalFeatures}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Features
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.06)} 0%, ${alpha(theme.palette.warning.main, 0.03)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100())`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TrendingIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {themes.filter(t => t.feature_count > 0).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Themes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.06)} 0%, ${alpha(theme.palette.info.main, 0.03)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100())`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {themes.length > 0 ? Math.round(totalFeatures / themes.length) : 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Features/Theme
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Main Content */}
        <Grid container spacing={2}>
          {/* Themes List */}
          <Grid item xs={12} lg={8}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    All Themes
                  </Typography>
                  <Chip
                    label={`${themes.length} themes`}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  />
                </Box>

                <Grid container spacing={2}>
                  {themes.map((themeItem) => (
                    <Grid item xs={12} sm={6} key={themeItem.id}>
                      <Card sx={{
                        borderRadius: 1,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                        border: selectedThemeId === themeItem.id
                          ? `2px solid ${theme.palette.primary.main}`
                          : `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.08)}`,
                        },
                      }}
                      onClick={() => handleThemeClick(themeItem)}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                {themeItem.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                {themeItem.description}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDialog(themeItem);
                                }}
                                sx={{
                                  borderRadius: 1,
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTheme(themeItem.id);
                                }}
                                sx={{
                                  borderRadius: 1,
                                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <FeatureIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {themeItem.feature_count} features
                                </Typography>
                              </Box>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Updated: {formatDate(themeItem.updated_at)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Theme Details Sidebar */}
          <Grid item xs={12} lg={4}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              position: 'sticky',
              top: 24,
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <TrendingIcon sx={{ color: theme.palette.info.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Theme Details
                  </Typography>
                </Box>

                {selectedTheme ? (
                  <Box>
                    <Box sx={{
                      p: 2,
                      borderRadius: 1,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                      mb: 3
                    }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                        {selectedTheme.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {selectedTheme.description}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          FEATURES
                        </Typography>
                        <Typography variant="caption">
                          {selectedTheme.feature_count}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          CREATED
                        </Typography>
                        <Typography variant="caption">
                          {formatDate(selectedTheme.created_at)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          LAST UPDATED
                        </Typography>
                        <Typography variant="caption">
                          {formatDate(selectedTheme.updated_at)}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleOpenDialog(selectedTheme)}
                        sx={{ flex: 1 }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<FeatureIcon />}
                        onClick={() => {
                          // Navigate to features page with this theme selected
                          window.location.href = '/app/features';
                        }}
                        sx={{
                          flex: 1,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
                        }}
                      >
                        View Features
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Select a theme to view details
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Create/Edit Theme Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingTheme ? 'Edit Theme' : 'Create New Theme'}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Theme Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                required
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, pt: 1.5 }}>
            <Button onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={!formData.name || !formData.description}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
              }}
            >
              {editingTheme ? 'Update Theme' : 'Create Theme'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Theme Features Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={handleCloseDrawer}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '100%', sm: 576 },
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
              backdropFilter: 'blur(20px)',
              zIndex: 1300, // Higher than AppBar but reasonable
              top: 64, // Start below AppBar
              height: 'calc(100vh - 64px)', // Full height minus AppBar
            },
          }}
        >
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedThemeForDrawer?.name || 'Theme Features'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {themeFeatures.length} features in this theme
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={handleCloseDrawer} sx={{ borderRadius: 2 }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Theme Description */}
            {selectedThemeForDrawer?.description && (
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                mb: 3
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {selectedThemeForDrawer.description}
                </Typography>
              </Box>
            )}

            {/* Features List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loadingFeatures ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ ml: 2 }}>Loading features...</Typography>
                </Box>
              ) : themeFeatures.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {themeFeatures.map((feature, index) => (
                    <React.Fragment key={feature.id}>
                      <ListItem
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.6)} 0%, ${alpha(theme.palette.background.paper, 0.3)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                              {feature.name}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                                {feature.description.length > 100
                                  ? `${feature.description.substring(0, 100)}...`
                                  : feature.description
                                }
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Chip
                                  label={feature.urgency}
                                  size="small"
                                  color={getUrgencyColor(feature.urgency) as any}
                                  sx={{ minWidth: 'auto' }}
                                />
                                <Chip
                                  label={feature.status}
                                  size="small"
                                  color={getStatusColor(feature.status) as any}
                                  variant="outlined"
                                  sx={{ minWidth: 'auto' }}
                                />
                                <Chip
                                  label={`${feature.mention_count} mentions`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    minWidth: 'auto',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                      borderColor: theme.palette.primary.main
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowMessages(feature);
                                  }}
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < themeFeatures.length - 1 && (
                        <Divider sx={{ my: 0.5, opacity: 0.5 }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <FeatureIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    No Features Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This theme doesn't have any features yet.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Drawer Footer */}
            {themeFeatures.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<FeatureIcon />}
                  onClick={() => {
                    handleCloseDrawer();
                    window.location.href = `/app/features?theme=${selectedThemeForDrawer?.id}`;
                  }}
                  sx={{
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
                  }}
                >
                  View All Features in Feature Dashboard
                </Button>
              </Box>
            )}
          </Box>
        </Drawer>

        {/* Messages Drawer (Second Level) */}
        <Drawer
          anchor="right"
          open={messagesDrawerOpen}
          onClose={handleBackToFeatures}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '100%', sm: 576 },
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
              backdropFilter: 'blur(20px)',
              zIndex: 1400, // Higher than the first drawer
              top: 64, // Start below AppBar
              height: 'calc(100vh - 64px)', // Full height minus AppBar
            },
          }}
        >
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Messages Drawer Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <IconButton
                onClick={handleBackToFeatures}
                sx={{
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  }
                }}
              >
                <ArrowBackIcon sx={{ color: theme.palette.primary.main }} />
              </IconButton>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100())`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MessageIcon sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Messages & Mentions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedFeatureForMessages?.name || 'Feature Messages'}
                </Typography>
              </Box>
              <IconButton onClick={handleBackToFeatures} sx={{ borderRadius: 2 }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Feature Summary */}
            {selectedFeatureForMessages && (
              <Box sx={{
                p: 2,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.04)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                border: `1px solid ${alpha(theme.palette.info.main, 0.08)}`,
                mb: 3
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {selectedFeatureForMessages.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2 }}>
                  {selectedFeatureForMessages.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={selectedFeatureForMessages.urgency}
                    size="small"
                    color={getUrgencyColor(selectedFeatureForMessages.urgency) as any}
                  />
                  <Chip
                    label={selectedFeatureForMessages.status}
                    size="small"
                    color={getStatusColor(selectedFeatureForMessages.status) as any}
                    variant="outlined"
                  />
                  <Chip
                    label={`${selectedFeatureForMessages.mention_count} mentions`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}

            {/* Messages List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loadingMessages ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ ml: 2 }}>Loading messages...</Typography>
                </Box>
              ) : featureMessages.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {featureMessages.map((message, index) => (
                    <React.Fragment key={message.id}>
                      <ListItem
                        sx={{
                          borderRadius: 2,
                          mb: 1.5,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100())`,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          p: 2,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.04)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100())`,
                            border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                          },
                        }}
                      >
                        {/* Message Content */}
                        <Typography
                          variant="body2"
                          sx={{
                            wordBreak: 'break-word',
                            lineHeight: 1.6,
                            mb: 2,
                            width: '100%'
                          }}
                        >
                          {message.content}
                        </Typography>

                        {/* Message Metadata */}
                        <Box sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          mt: 'auto'
                        }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              {message.sender_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              in #{message.channel_name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(message.sent_at)}
                          </Typography>
                        </Box>
                      </ListItem>
                      {index < featureMessages.length - 1 && (
                        <Divider sx={{ my: 0.5, opacity: 0.3 }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <MessageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    No Messages Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No messages have been linked to this feature yet.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Messages Stats Footer */}
            {featureMessages.length > 0 && (
              <Box sx={{
                mt: 2,
                pt: 2,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                textAlign: 'center'
              }}>
                <Typography variant="caption" color="text.secondary">
                  {featureMessages.length} message{featureMessages.length !== 1 ? 's' : ''} found for this feature
                </Typography>
              </Box>
            )}
          </Box>
        </Drawer>
      </Box>
    </AdminLayout>
  );
}