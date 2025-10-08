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
  Divider,
  Drawer,
  MenuItem,
  Menu,
  Skeleton,
  Select,
  FormControl,
} from '@mui/material';
import {
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FeaturedPlayList as FeatureIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Message as MessageIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ThemeData, ThemeFormData } from '@/shared/types/theme.types';
import { API_BASE_URL } from '@/config/api.config';

type Theme = ThemeData;

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
  data_points?: any[];
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
    parent_theme_id: null,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedThemeForDrawer, setSelectedThemeForDrawer] = useState<Theme | null>(null);
  const [showingAllFeatures, setShowingAllFeatures] = useState(false);
  const [showingSubThemes, setShowingSubThemes] = useState(false);
  const [themeFeatures, setThemeFeatures] = useState<Feature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [messagesDrawerOpen, setMessagesDrawerOpen] = useState(false);
  const [selectedFeatureForMessages, setSelectedFeatureForMessages] = useState<Feature | null>(null);
  const [featureMessages, setFeatureMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedThemeForMenu, setSelectedThemeForMenu] = useState<Theme | null>(null);

  const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

  // Helper function to organize themes hierarchically
  const buildThemeHierarchy = (themes: Theme[]): Theme[] => {
    const themeMap = new Map(themes.map(theme => [theme.id, { ...theme, children: [] as Theme[] }]));
    const rootThemes: Theme[] = [];

    themes.forEach(theme => {
      const themeWithChildren = themeMap.get(theme.id)!;

      if (theme.parent_theme_id && themeMap.has(theme.parent_theme_id)) {
        const parent = themeMap.get(theme.parent_theme_id)!;
        (parent as any).children.push(themeWithChildren);
      } else {
        rootThemes.push(themeWithChildren);
      }
    });

    // Sort root themes alphabetically by name
    rootThemes.sort((a, b) => a.name.localeCompare(b.name));

    // Sort children alphabetically for each parent theme
    rootThemes.forEach(theme => {
      if ((theme as any).children && (theme as any).children.length > 0) {
        (theme as any).children.sort((a: Theme, b: Theme) => a.name.localeCompare(b.name));
      }
    });

    return rootThemes;
  };

  const hierarchicalThemes = buildThemeHierarchy(themes);

  // Flatten hierarchical themes for dropdown (includes all parent and child themes)
  const flattenedThemes = React.useMemo(() => {
    const result: Theme[] = [];
    const flatten = (themeList: Theme[]) => {
      themeList.forEach(theme => {
        result.push(theme);
        if ((theme as any).children && (theme as any).children.length > 0) {
          flatten((theme as any).children);
        }
      });
    };
    flatten(hierarchicalThemes);
    return result;
  }, [hierarchicalThemes]);

  // Initialize expanded state - start with all themes collapsed
  React.useEffect(() => {
    setExpandedThemes(new Set()); // Empty set = all collapsed
  }, [themes]);

  const toggleThemeExpansion = (themeId: string) => {
    setExpandedThemes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(themeId)) {
        newSet.delete(themeId);
      } else {
        newSet.add(themeId);
      }
      return newSet;
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, theme: Theme) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedThemeForMenu(theme);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedThemeForMenu(null);
  };

  const handleMenuAction = (action: 'edit' | 'delete' | 'add-sub') => {
    if (!selectedThemeForMenu) return;

    switch (action) {
      case 'edit':
        handleOpenDialog(selectedThemeForMenu);
        break;
      case 'delete':
        handleDeleteTheme(selectedThemeForMenu.id);
        break;
      case 'add-sub':
        handleOpenDialog(undefined, selectedThemeForMenu.id);
        break;
    }
    handleMenuClose();
  };

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchThemes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
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
    // Load all features by default
    handleAllThemesClick();
  }, []);

  const handleOpenDialog = (themeToEdit?: Theme, parentThemeId?: string) => {
    if (themeToEdit) {
      setEditingTheme(themeToEdit);
      setFormData({
        name: themeToEdit.name,
        description: themeToEdit.description,
        parent_theme_id: themeToEdit.parent_theme_id || null,
      });
    } else {
      setEditingTheme(null);
      setFormData({
        name: '',
        description: '',
        parent_theme_id: parentThemeId || null,
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
          `${API_BASE_URL}/api/v1/features/themes/${editingTheme.id}?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              parent_theme_id: formData.parent_theme_id
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update theme: ${response.status}`);
        }
      } else {
        // Create new theme
        const response = await fetch(
          `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              parent_theme_id: formData.parent_theme_id
            })
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
        `${API_BASE_URL}/api/v1/features/themes/${themeId}?workspace_id=${WORKSPACE_ID}`,
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
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}&theme_id=${themeId}`,
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

  const fetchAllFeatures = async () => {
    try {
      setLoadingFeatures(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}`,
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
      console.error('Error fetching all features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const handleThemeClick = (theme: Theme) => {
    setSelectedThemeForDrawer(theme);
    setShowingAllFeatures(false);

    // If theme has children, show sub-themes first
    const hasChildren = (theme as any).children && (theme as any).children.length > 0;
    if (hasChildren) {
      setShowingSubThemes(true);
      setThemeFeatures([]);
    } else {
      setShowingSubThemes(false);
      fetchThemeFeatures(theme.id);
    }
  };

  const handleAllThemesClick = () => {
    setSelectedThemeForDrawer(null);
    setShowingAllFeatures(true);
    setShowingSubThemes(false);
    setThemeFeatures([]);
  };

  const handleFeatureThemeChange = async (featureId: string, newThemeId: string | null) => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            theme_id: newThemeId
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update feature theme: ${response.status}`);
      }

      // Refresh the features list
      if (selectedThemeForDrawer) {
        fetchThemeFeatures(selectedThemeForDrawer.id);
      } else if (showingAllFeatures) {
        fetchAllFeatures();
      }

      // Refresh themes to update counts
      fetchThemes();
    } catch (error) {
      console.error('Error updating feature theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to update feature theme');
    }
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
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${WORKSPACE_ID}`,
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

  // Row-based theme renderer with proper hierarchy
  const renderThemeRow = (themeItem: any, level: number = 0) => {
    const indentWidth = level * 32; // 32px indent per level
    const hasChildren = themeItem.children && themeItem.children.length > 0;
    const isExpanded = expandedThemes.has(themeItem.id);

    return (
      <React.Fragment key={themeItem.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            px: 2,
            ml: indentWidth / 8, // Convert to MUI spacing units
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            mb: 0.5,
            position: 'relative',
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
              borderColor: theme.palette.primary.main,
              transform: 'translateX(4px)',
            },
          }}
          onClick={() => handleThemeClick(themeItem)}
        >
          {/* Hierarchy indicator */}
          {level > 0 && (
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              bgcolor: '#4FC3F7', // Light blue - more soothing
              borderRadius: '0 1px 1px 0'
            }} />
          )}

          {/* Theme name and info */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {themeItem.name}
              </Typography>
            </Box>

          </Box>

          {/* Actions - Dropdown Menu */}
          <Box>
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, themeItem)}
              sx={{
                width: 32,
                height: 32,
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                '&:hover': { bgcolor: alpha(theme.palette.grey[500], 0.2) }
              }}
              title="More options"
            >
              <MoreVertIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Expand/Collapse button - always reserve space */}
          <Box sx={{ width: 28, height: 28 }}>
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleThemeExpansion(themeItem.id);
                }}
                sx={{
                  width: 28,
                  height: 28,
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main
                  }
                }}
              >
                {isExpanded ? (
                  <ExpandMoreIcon sx={{ fontSize: 18 }} />
                ) : (
                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Render sub-themes only when expanded */}
        {hasChildren && isExpanded && themeItem.children.map((childTheme: any) =>
          renderThemeRow(childTheme, level + 1)
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box>
          {/* Header Skeleton */}
          <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width={200} height={40} />
            <Skeleton variant="text" width={300} height={24} sx={{ mt: 1 }} />
          </Box>

          <Grid container spacing={3}>
            {/* Left Panel - Themes List Skeleton */}
            <Grid item xs={12} md={5}>
              <Card sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: 'calc(100vh - 120px)',
              }}>
                <CardContent sx={{ p: 2 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Skeleton variant="text" width={150} height={32} />
                    <Skeleton variant="circular" width={40} height={40} />
                  </Box>

                  {/* All Themes */}
                  <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 2 }} />

                  {/* Theme Items */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} variant="rounded" width="100%" height={40} sx={{ mb: 1 }} />
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* Right Panel - Features List Skeleton */}
            <Grid item xs={12} md={7}>
              <Card sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: 'calc(100vh - 120px)',
              }}>
                <CardContent sx={{ p: 3 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Skeleton variant="rounded" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width={150} height={32} />
                      <Skeleton variant="text" width={120} height={20} />
                    </Box>
                  </Box>

                  {/* Feature Items */}
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Skeleton variant="text" width="80%" height={28} />
                      <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                      <Skeleton variant="text" width="90%" height={20} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={80} height={24} />
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box>
        {/* Header */}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        {/* Split Layout: Themes (30%) and Features (70%) */}
        <Grid container spacing={2} sx={{ height: 'calc(100vh - 120px)' }}>
          {/* Themes List - Left 30% */}
          <Grid item xs={12} lg={3.6}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: 'calc(100vh - 120px)', // Fixed height for scrolling
            }}>
              <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      All Themes
                    </Typography>
                  </Box>

                  {/* Add Theme Button */}
                  <IconButton
                    onClick={() => handleOpenDialog()}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                        transform: 'scale(1.05)',
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                    title="Create New Theme"
                  >
                    <AddIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1 }}>
                  {/* All Themes Summary Row */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 1,
                      px: 2,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      mb: 1,
                      '&:hover': {
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                        borderColor: theme.palette.primary.main,
                        transform: 'translateX(2px)',
                      },
                    }}
                    onClick={handleAllThemesClick}
                  >
                    {/* All Themes Label */}
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.primary.main }}>
                        All Themes
                      </Typography>
                    </Box>

                    {/* Total Features Count */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <FeatureIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                        <Box sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          bgcolor: theme.palette.primary.main,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {themes.reduce((acc, t) => acc + t.feature_count, 0)}
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Individual Themes */}
                  {hierarchicalThemes.map((themeItem) => renderThemeRow(themeItem))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Features List - Right 70% */}
          <Grid item xs={12} lg={8.4}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: 'calc(100vh - 120px)', // Fixed height for scrolling
            }}>
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {selectedThemeForDrawer || showingAllFeatures ? (
                  <>
                    {/* Selected Theme Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
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
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {showingAllFeatures ? 'Theme Dashboard' : selectedThemeForDrawer ? selectedThemeForDrawer.name : 'All Features'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {showingAllFeatures
                            ? `${themes.length} themes • ${themes.reduce((acc, t) => acc + t.feature_count, 0)} total features`
                            : showingSubThemes && selectedThemeForDrawer && (selectedThemeForDrawer as any).children
                            ? `${(selectedThemeForDrawer as any).children.length} sub-themes`
                            : `${themeFeatures.length} features`
                          }
                        </Typography>
                      </Box>
                    </Box>

                    {/* Theme Description - only show when displaying features */}
                    {!showingAllFeatures && !showingSubThemes && selectedThemeForDrawer?.description && (
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

                    {/* Dashboard or Features List */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      {showingAllFeatures ? (
                        /* Dashboard View - Show only root theme cards */
                        <Grid container spacing={2}>
                          {hierarchicalThemes.map((themeItem) => (
                            <Grid item xs={12} sm={6} md={4} key={themeItem.id}>
                              <Card
                                sx={{
                                  cursor: 'pointer',
                                  height: '100%',
                                  borderRadius: 2,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: theme.shadows[4],
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                  }
                                }}
                                onClick={() => handleThemeClick(themeItem)}
                              >
                                <CardContent>
                                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    {themeItem.name}
                                  </Typography>
                                  {themeItem.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                      {themeItem.description.substring(0, 80)}{themeItem.description.length > 80 ? '...' : ''}
                                    </Typography>
                                  )}
                                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <FeatureIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                      <Typography variant="body2" fontWeight={600}>
                                        {themeItem.feature_count}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        features
                                      </Typography>
                                    </Box>
                                    {(themeItem as any).children && (themeItem as any).children.length > 0 && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CategoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="body2" fontWeight={600}>
                                          {(themeItem as any).children.length}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          sub-themes
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : showingSubThemes && selectedThemeForDrawer && (selectedThemeForDrawer as any).children ? (
                        /* Sub-themes View - Show child theme cards */
                        <Grid container spacing={2}>
                          {(selectedThemeForDrawer as any).children.map((childTheme: any) => (
                            <Grid item xs={12} sm={6} md={4} key={childTheme.id}>
                              <Card
                                sx={{
                                  cursor: 'pointer',
                                  height: '100%',
                                  borderRadius: 2,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderLeft: `3px solid ${alpha(theme.palette.secondary.main, 0.5)}`,
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: theme.shadows[4],
                                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                                    borderLeft: `3px solid ${theme.palette.secondary.main}`,
                                  }
                                }}
                                onClick={() => handleThemeClick(childTheme)}
                              >
                                <CardContent>
                                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    {childTheme.name}
                                  </Typography>
                                  {childTheme.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                      {childTheme.description.substring(0, 80)}{childTheme.description.length > 80 ? '...' : ''}
                                    </Typography>
                                  )}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
                                    <FeatureIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Typography variant="body2" fontWeight={600}>
                                      {childTheme.feature_count}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      features
                                    </Typography>
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : loadingFeatures ? (
                        <Box>
                          {[1, 2, 3, 4].map((i) => (
                            <Box key={i} sx={{ mb: 2, p: 2, borderRadius: 2, background: alpha(theme.palette.background.paper, 0.4) }}>
                              <Skeleton variant="text" width="80%" height={28} />
                              <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                              <Skeleton variant="text" width="90%" height={20} />
                              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                <Skeleton variant="rounded" width={60} height={24} />
                                <Skeleton variant="rounded" width={60} height={24} />
                                <Skeleton variant="rounded" width={80} height={24} />
                              </Box>
                            </Box>
                          ))}
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
                                <Box sx={{ width: '100%' }}>
                                  {/* Title and Theme Selector Row */}
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                                      {feature.name}
                                    </Typography>

                                    {/* Theme Selector - Top Right */}
                                    <FormControl size="small" sx={{ minWidth: 180 }}>
                                      <Select
                                        value={feature.theme_id || ''}
                                        onChange={(e) => handleFeatureThemeChange(feature.id, e.target.value || null)}
                                        displayEmpty
                                        renderValue={(selected) => {
                                          if (!selected) {
                                            return <em>No Theme</em>;
                                          }
                                          const selectedTheme = flattenedThemes.find(t => t.id === selected);
                                          if (!selectedTheme) {
                                            return <em>Unknown Theme</em>;
                                          }

                                          // For child themes, show "Parent / Child"
                                          if ((selectedTheme.level ?? 0) > 0 && selectedTheme.parent_theme_id) {
                                            const parentTheme = flattenedThemes.find(t => t.id === selectedTheme.parent_theme_id);
                                            if (parentTheme) {
                                              return <Box component="span">{parentTheme.name} / {selectedTheme.name}</Box>;
                                            }
                                          }

                                          // For root themes, show name only
                                          return <Box component="span">{selectedTheme.name}</Box>;
                                        }}
                                        sx={{
                                          fontSize: '0.875rem',
                                          backgroundColor: alpha(theme.palette.background.paper, 0.8),
                                          '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.divider, 0.3),
                                          },
                                          '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.5),
                                          }
                                        }}
                                      >
                                        <MenuItem value="">
                                          <em>No Theme</em>
                                        </MenuItem>
                                        {flattenedThemes.map((themeItem) => {
                                          // For child themes in dropdown, show "Parent / Child"
                                          let displayText = themeItem.name;
                                          if ((themeItem.level ?? 0) > 0 && themeItem.parent_theme_id) {
                                            const parentTheme = flattenedThemes.find(t => t.id === themeItem.parent_theme_id);
                                            if (parentTheme) {
                                              displayText = `${parentTheme.name} / ${themeItem.name}`;
                                            }
                                          }

                                          return (
                                            <MenuItem key={themeItem.id} value={themeItem.id}>
                                              {displayText}
                                            </MenuItem>
                                          );
                                        })}
                                      </Select>
                                    </FormControl>
                                  </Box>

                                  {/* Description */}
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                                    {feature.description.length > 100
                                      ? `${feature.description.substring(0, 100)}...`
                                      : feature.description
                                    }
                                  </Typography>

                                  {/* Status Chips */}
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
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

                                      {/* Data Points Section */}
                                      {feature.data_points && feature.data_points.length > 0 && (
                                        <Box sx={{ mt: 2 }}>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                                            Extracted Insights:
                                          </Typography>
                                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {feature.data_points.map((dataPointEntry, index) => (
                                              <Box key={index} sx={{
                                                p: 1.5,
                                                borderRadius: 1,
                                                background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.04)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                                                border: `1px solid ${alpha(theme.palette.info.main, 0.08)}`,
                                              }}>
                                                {/* Author and timestamp */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                    {dataPointEntry.author || 'Unknown'}
                                                  </Typography>
                                                  <Typography variant="caption" color="text.secondary">
                                                    {dataPointEntry.timestamp ? new Date(dataPointEntry.timestamp).toLocaleDateString() : ''}
                                                  </Typography>
                                                </Box>

                                                {/* Display structured metrics, business metrics, and entities */}
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                  {dataPointEntry.structured_metrics && Object.keys(dataPointEntry.structured_metrics).length > 0 && (
                                                    <Box>
                                                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                        📊 Metrics:
                                                      </Typography>
                                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {Object.entries(dataPointEntry.structured_metrics).map(([key, value]) => (
                                                          <Chip
                                                            key={key}
                                                            label={`${key}: ${value}`}
                                                            size="small"
                                                            variant="outlined"
                                                            color="primary"
                                                            sx={{ fontSize: '0.7rem', height: 24 }}
                                                          />
                                                        ))}
                                                      </Box>
                                                    </Box>
                                                  )}

                                                  {dataPointEntry.business_metrics && Object.keys(dataPointEntry.business_metrics).length > 0 && (
                                                    <Box>
                                                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                        💰 Business:
                                                      </Typography>
                                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {Object.entries(dataPointEntry.business_metrics).map(([key, value]) => (
                                                          <Chip
                                                            key={key}
                                                            label={`${key}: ${value}`}
                                                            size="small"
                                                            variant="outlined"
                                                            color="success"
                                                            sx={{ fontSize: '0.7rem', height: 24 }}
                                                          />
                                                        ))}
                                                      </Box>
                                                    </Box>
                                                  )}

                                                  {dataPointEntry.entities && Object.keys(dataPointEntry.entities).length > 0 && (
                                                    <Box>
                                                      <Typography variant="caption" color="info.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                        🏷️ Entities:
                                                      </Typography>
                                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {Object.entries(dataPointEntry.entities).map(([key, value]) => (
                                                          <Chip
                                                            key={key}
                                                            label={`${key}: ${value}`}
                                                            size="small"
                                                            variant="outlined"
                                                            color="info"
                                                            sx={{ fontSize: '0.7rem', height: 24 }}
                                                          />
                                                        ))}
                                                      </Box>
                                                    </Box>
                                                  )}
                                                </Box>
                                              </Box>
                                            ))}
                                          </Box>
                                        </Box>
                                      )}
                                </Box>
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
                  </>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    <FeatureIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      Select a Theme
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click on a theme from the left to view its features here.
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

              <TextField
                select
                label="Parent Theme (Optional)"
                value={formData.parent_theme_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_theme_id: e.target.value || null })}
                fullWidth
                helperText="Select a parent theme to create a sub-theme"
              >
                <MenuItem value="">None (Root Theme)</MenuItem>
                {themes
                  .filter(t => !t.parent_theme_id && t.id !== editingTheme?.id) // Only show root themes and exclude current theme if editing
                  .map((parentTheme) => (
                    <MenuItem key={parentTheme.id} value={parentTheme.id}>
                      {parentTheme.name}
                    </MenuItem>
                  ))}
              </TextField>
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
                <Box>
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ mb: 2, p: 2, borderRadius: 2, background: alpha(theme.palette.background.paper, 0.4) }}>
                      <Skeleton variant="text" width="80%" height={28} />
                      <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                      <Skeleton variant="text" width="90%" height={20} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={80} height={24} />
                      </Box>
                    </Box>
                  ))}
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
                          secondaryTypographyProps={{ component: 'div' }}
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

        {/* Theme Actions Dropdown Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          sx={{
            '& .MuiPaper-root': {
              borderRadius: 2,
              minWidth: 160,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            },
          }}
        >
          <MenuItem
            onClick={() => handleMenuAction('edit')}
            sx={{ py: 1.5, px: 2 }}
          >
            <EditIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
            Edit Theme
          </MenuItem>
          {selectedThemeForMenu && !selectedThemeForMenu.parent_theme_id && (
            <MenuItem
              onClick={() => handleMenuAction('add-sub')}
              sx={{ py: 1.5, px: 2 }}
            >
              <AddIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
              Add Sub-theme
            </MenuItem>
          )}
          <MenuItem
            onClick={() => handleMenuAction('delete')}
            sx={{
              py: 1.5,
              px: 2,
              color: 'error.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.1)
              }
            }}
          >
            <DeleteIcon sx={{ fontSize: 18, mr: 1.5 }} />
            Delete Theme
          </MenuItem>
        </Menu>
      </Box>
    </AdminLayout>
  );
}