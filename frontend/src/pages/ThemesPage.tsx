/**
 * Refactored Themes page for managing and organizing feature request themes
 * This is now a clean orchestration component using custom hooks and reusable components
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
  Alert,
  Drawer,
  IconButton,
  Fab,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { OnboardingBlocker } from '@/shared/components/OnboardingBlocker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

// Import custom hooks
import {
  useThemes,
  useFeatures,
  useMessages,
  useDialogs,
  useDrawers,
  useResizable,
} from './ThemesPage/hooks';

// Import components
import {
  ThemesList,
  FeatureCard,
  ThemeFormDialog,
  ResizablePanels,
} from './ThemesPage/components';

// Import types
import { Theme, Feature } from './ThemesPage/types';

export function ThemesPage(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { tokens, isAuthenticated } = useAuthStore();
  
  const WORKSPACE_ID = tokens?.workspace_id;

  // Custom hooks for state management
  const themes = useThemes();
  const features = useFeatures();
  const messages = useMessages();
  const dialogs = useDialogs();
  const drawers = useDrawers();
  const resizable = useResizable();

  // Local UI state
  const [selectedThemeForMenu, setSelectedThemeForMenu] = useState<Theme | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showOnboardingBlocker, setShowOnboardingBlocker] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  // Hydration: Check if store is ready
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    if (!hydrated || !isAuthenticated || WORKSPACE_ID || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.workspace_id && tokens) {
          useAuthStore.setState({
            tokens: {
              ...tokens,
              workspace_id: data.workspace_id
            }
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch workspace_id:', err);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, WORKSPACE_ID, fetchingWorkspaceId, attemptedFetch, tokens]);

  // Update blocker status when themes change
  useEffect(() => {
    setShowOnboardingBlocker(themes.themes.length === 0);
  }, [themes.themes]);

  // Auto-load features when theme is selected
  useEffect(() => {
    if (themes.selectedThemeId) {
      features.fetchThemeFeatures(themes.selectedThemeId);
    }
  }, [themes.selectedThemeId]);

  // Theme menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, theme: Theme) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedThemeForMenu(theme);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedThemeForMenu(null);
  };

  const handleMenuAction = async (action: 'edit' | 'delete' | 'add-sub') => {
    if (!selectedThemeForMenu) return;

    try {
      switch (action) {
        case 'edit':
          themes.prepareFormForEdit(selectedThemeForMenu);
          dialogs.openDialog('dialogOpen');
          break;
        case 'delete':
          await themes.deleteTheme(selectedThemeForMenu.id);
          break;
        case 'add-sub':
          themes.prepareFormForCreate(selectedThemeForMenu.id);
          dialogs.openDialog('dialogOpen');
          break;
      }
    } catch (error) {
      console.error('Menu action error:', error);
      themes.setError(error instanceof Error ? error.message : 'Action failed');
    }
    handleMenuClose();
  };

  // Theme form handlers
  const handleOpenCreateDialog = () => {
    themes.prepareFormForCreate();
    dialogs.openDialog('dialogOpen');
  };

  const handleCloseThemeDialog = () => {
    dialogs.closeDialog('dialogOpen');
    themes.resetForm();
  };

  const handleSubmitTheme = async () => {
    try {
      if (themes.editingTheme) {
        await themes.updateTheme(themes.editingTheme.id, themes.formData);
      } else {
        await themes.createTheme(themes.formData);
      }
      handleCloseThemeDialog();
    } catch (error) {
      console.error('Theme submit error:', error);
      themes.setError(error instanceof Error ? error.message : 'Failed to save theme');
    }
  };

  const handleUseSuggestion = (suggestion: any) => {
    themes.setFormData({
      ...themes.formData,
      name: suggestion.name,
      description: suggestion.description,
    });
  };

  // Feature handlers
  const handleAllThemesClick = () => {
    themes.setSelectedThemeId('');
    features.fetchAllFeatures();
  };

  // Feature editing handlers
  const handleEditFeature = (feature: Feature) => {
    features.prepareFeatureForEdit(feature);
    dialogs.openDialog('editModalOpen');
  };

  const handleDeleteFeature = (feature: Feature) => {
    features.prepareFeatureForDelete(feature);
    dialogs.openDialog('deleteConfirmOpen');
  };

  const handleViewMessages = (feature: Feature, fullPage: boolean = false) => {
    messages.openMessagesForFeature(feature, fullPage);
    if (isMobile) {
      // On mobile, always open the drawer for messages
      drawers.openDrawer('mentionsDrawerOpen');
    } else if (!fullPage) {
      drawers.openDrawer('mentionsDrawerOpen');
    }
  };

  // Show onboarding blocker if needed
  if (showOnboardingBlocker) {
    return (
      <AdminLayout>
        <OnboardingBlocker isBlocked={true} />
      </AdminLayout>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <AdminLayout>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton
              onClick={() => drawers.openDrawer('mobileThemesDrawerOpen')}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h4">
              Features
            </Typography>
          </Box>
          
          {themes.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {themes.error}
            </Alert>
          )}

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {themes.selectedThemeId 
                ? `${themes.themes.find(t => t.id === themes.selectedThemeId)?.name || 'Theme'} Features` 
                : `All Features`} ({features.filteredAndSortedFeatures.length})
            </Typography>
            
            {features.loadingFeatures ? (
              <Typography>Loading features...</Typography>
            ) : (
              features.filteredAndSortedFeatures.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onEdit={handleEditFeature}
                  onDelete={handleDeleteFeature}
                  onViewMessages={handleViewMessages}
                  extractDataPointValue={features.extractDataPointValue}
                />
              ))
            )}
          </Box>
        </Box>

        {/* Mobile Themes Drawer */}
        <Drawer
          anchor="left"
          open={drawers.drawerState.mobileThemesDrawerOpen}
          onClose={() => drawers.closeDrawer('mobileThemesDrawerOpen')}
          sx={{
            '& .MuiDrawer-paper': {
              width: '90vw',
              maxWidth: 360,
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Themes</Typography>
              <IconButton onClick={() => drawers.closeDrawer('mobileThemesDrawerOpen')}>
                <CloseIcon />
              </IconButton>
            </Box>
            <ThemesList
              themes={themes.themes}
              hierarchicalThemes={themes.hierarchicalThemes}
              selectedThemeId={themes.selectedThemeId}
              expandedThemes={themes.expandedThemes}
              loading={themes.loading}
              error={themes.error}
              menuAnchorEl={menuAnchorEl}
              selectedThemeForMenu={selectedThemeForMenu}
              onThemeSelect={(id) => {
                themes.setSelectedThemeId(id);
                drawers.closeDrawer('mobileThemesDrawerOpen');
              }}
              onToggleExpansion={themes.toggleThemeExpansion}
              onMenuOpen={handleMenuOpen}
              onMenuClose={handleMenuClose}
              onMenuAction={handleMenuAction}
              onCreateTheme={handleOpenCreateDialog}
              onAllThemesClick={() => {
                handleAllThemesClick();
                drawers.closeDrawer('mobileThemesDrawerOpen');
              }}
            />
          </Box>
        </Drawer>

        {/* Mobile Messages Drawer - Full Width */}
        <Drawer
          anchor="bottom"
          open={drawers.drawerState.mentionsDrawerOpen}
          onClose={() => drawers.closeDrawer('mentionsDrawerOpen')}
          sx={{
            '& .MuiDrawer-paper': {
              height: '80vh',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          }}
        >
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Messages for {messages.selectedFeatureForMessages?.name}
              </Typography>
              <IconButton onClick={() => drawers.closeDrawer('mentionsDrawerOpen')}>
                <CloseIcon />
              </IconButton>
            </Box>
            
            {messages.loadingMessages ? (
              <Typography>Loading messages...</Typography>
            ) : messages.featureMessages.length === 0 ? (
              <Typography color="textSecondary">No messages found for this feature.</Typography>
            ) : (
              <Box>
                {messages.featureMessages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      p: 2,
                      mb: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      backgroundColor: theme.palette.background.paper,
                    }}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>From:</strong> {message.customer_name || message.sender_name || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {new Date(message.sent_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2">
                      {message.content}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Drawer>

        {/* Theme Form Dialog */}
        <ThemeFormDialog
          open={dialogs.dialogState.dialogOpen}
          editingTheme={themes.editingTheme}
          formData={themes.formData}
          flattenedThemes={themes.flattenedThemes}
          suggestions={themes.suggestions}
          loadingSuggestions={themes.loadingSuggestions}
          loadingMoreSuggestions={themes.loadingMoreSuggestions}
          onClose={handleCloseThemeDialog}
          onSubmit={handleSubmitTheme}
          onFormDataChange={(data) => themes.setFormData({ ...themes.formData, ...data })}
          onUseSuggestion={handleUseSuggestion}
          onLoadMoreSuggestions={themes.loadMoreSuggestions}
        />
      </AdminLayout>
    );
  }

  // Desktop layout with resizable panels
  return (
    <AdminLayout>
      <Box sx={{ p: 2, height: '100vh', overflow: 'hidden' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Themes & Features
        </Typography>
        
        {themes.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {themes.error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ height: 'calc(100% - 80px)' }}>
          <Grid item xs={3}>
            <ThemesList
              themes={themes.themes}
              hierarchicalThemes={themes.hierarchicalThemes}
              selectedThemeId={themes.selectedThemeId}
              expandedThemes={themes.expandedThemes}
              loading={themes.loading}
              error={themes.error}
              menuAnchorEl={menuAnchorEl}
              selectedThemeForMenu={selectedThemeForMenu}
              onThemeSelect={themes.setSelectedThemeId}
              onToggleExpansion={themes.toggleThemeExpansion}
              onMenuOpen={handleMenuOpen}
              onMenuClose={handleMenuClose}
              onMenuAction={handleMenuAction}
              onCreateTheme={handleOpenCreateDialog}
              onAllThemesClick={handleAllThemesClick}
            />
          </Grid>
          
          <Grid item xs={9}>
            <ResizablePanels
              containerRef={resizable.containerRef}
              resizableState={resizable.resizableState}
              onStartResize={resizable.startResize}
            >
              {{
                left: (
                  <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Features ({features.filteredAndSortedFeatures.length})
                    </Typography>
                    
                    {features.loadingFeatures ? (
                      <Typography>Loading features...</Typography>
                    ) : (
                      features.filteredAndSortedFeatures.map((feature) => (
                        <FeatureCard
                          key={feature.id}
                          feature={feature}
                          onEdit={handleEditFeature}
                          onDelete={handleDeleteFeature}
                          onViewMessages={handleViewMessages}
                          extractDataPointValue={features.extractDataPointValue}
                        />
                      ))
                    )}
                  </Box>
                ),
                middle: (
                  <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Messages
                    </Typography>
                    {/* Messages list component would go here */}
                  </Box>
                ),
                right: (
                  <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Details
                    </Typography>
                    {/* Message details component would go here */}
                  </Box>
                ),
              }}
            </ResizablePanels>
          </Grid>
        </Grid>
      </Box>

      {/* Theme Form Dialog */}
      <ThemeFormDialog
        open={dialogs.dialogState.dialogOpen}
        editingTheme={themes.editingTheme}
        formData={themes.formData}
        flattenedThemes={themes.flattenedThemes}
        suggestions={themes.suggestions}
        loadingSuggestions={themes.loadingSuggestions}
        loadingMoreSuggestions={themes.loadingMoreSuggestions}
        onClose={handleCloseThemeDialog}
        onSubmit={handleSubmitTheme}
        onFormDataChange={(data) => themes.setFormData({ ...themes.formData, ...data })}
        onUseSuggestion={handleUseSuggestion}
        onLoadMoreSuggestions={themes.loadMoreSuggestions}
      />

      {/* Desktop Messages Drawer */}
      <Drawer
        anchor="right"
        open={drawers.drawerState.mentionsDrawerOpen}
        onClose={() => drawers.closeDrawer('mentionsDrawerOpen')}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Messages
            </Typography>
            <IconButton onClick={() => drawers.closeDrawer('mentionsDrawerOpen')}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          {messages.loadingMessages ? (
            <Typography>Loading messages...</Typography>
          ) : messages.featureMessages.length === 0 ? (
            <Typography color="textSecondary">No messages found for this feature.</Typography>
          ) : (
            <Box>
              {messages.featureMessages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    backgroundColor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>From:</strong> {message.customer_name || message.sender_name || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {new Date(message.sent_at).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    {message.content}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Drawer>
    </AdminLayout>
  );
}