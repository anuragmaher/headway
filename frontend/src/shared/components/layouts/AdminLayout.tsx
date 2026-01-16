/**
 * Layout for authenticated app pages (dashboard, settings, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  alpha,
  useTheme,
  GlobalStyles,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  KeyboardDoubleArrowLeft as CollapseIcon,
  KeyboardDoubleArrowRight as ExpandIcon,
  Business as BusinessIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { OnboardingWizard } from '@/shared/components/OnboardingWizard/OnboardingWizard';
import { GmailLabelSelectionScreen } from '@/shared/components/OnboardingWizard/GmailLabelSelectionScreen';
import { ConnectDataSourcesBanner } from '@/shared/components/ConnectDataSourcesBanner';
import { useAuthActions, useUser, useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '@/shared/store/onboardingStore';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { useWorkspaceSettingsStore } from '@/shared/store/WorkspaceStore/workspaceSettingsStore';
import { ROUTES } from '@/lib/constants/routes';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  {
    text: 'Dashboard',
    icon: <DashboardIcon />,
    path: ROUTES.DASHBOARD,
  },
  {
    text: 'Themes',
    icon: <CategoryIcon />,
    path: ROUTES.THEMES,
  },
  {
    text: 'Customers',
    icon: <BusinessIcon />,
    path: ROUTES.CUSTOMERS,
  },
  {
    text: 'Customer Chat',
    icon: <ChatIcon />,
    path: ROUTES.CUSTOMERS_CHAT,
  },
  {
    text: 'Workspace Settings',
    icon: <SettingsIcon />,
    path: ROUTES.SETTINGS_WORKSPACE,
  },
];

export function AdminLayout({ children }: AdminLayoutProps): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { logout } = useAuthActions();
  const user = useUser();
  const tokens = useAuthStore((state) => state.tokens);

  // Onboarding state
  const {
    checkOnboardingStatus,
    showOnboardingDialog,
    dismissOnboarding,
    completeOnboarding,
    hasChecked,
    forceRecheck,
    onboardingStatus,
    isOnboardingComplete,
  } = useOnboardingStore();
  
  // Workspace settings store to check data sources
  const { 
    getDataSources, 
    isLoadingIntegrations,
    loadSlackIntegrations,
    loadGmailAccounts,
    loadConnectors,
  } = useWorkspaceSettingsStore((state) => ({
    getDataSources: state.getDataSources,
    isLoadingIntegrations: state.isLoadingIntegrations,
    loadSlackIntegrations: state.loadSlackIntegrations,
    loadGmailAccounts: state.loadGmailAccounts,
    loadConnectors: state.loadConnectors,
  }));
  
  // State to control wizard opening from banner
  const [wizardOpenFromBanner, setWizardOpenFromBanner] = useState(false);

  // Custom header content from pages
  const headerContent = useLayoutStore((state) => state.headerContent);

  // Track the workspace ID to detect changes (new login)
  const [lastCheckedWorkspaceId, setLastCheckedWorkspaceId] = useState<string | null>(null);
  
  // Track if Gmail label selection screen should be shown
  const [showGmailLabelScreen, setShowGmailLabelScreen] = useState(false);
  // Track if wizard should be hidden (when label selection is active)
  const [hideWizardForLabels, setHideWizardForLabels] = useState(false);

  // Handle Gmail OAuth completion from new tab
  useEffect(() => {
    // Listen for OAuth completion event (triggered from DataSourcesStep)
    const handleOAuthComplete = () => {
      // Hide wizard and show label selection
      setHideWizardForLabels(true);
      setShowGmailLabelScreen(true);
    };

    // Also listen for storage events (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gmail-oauth-complete' && e.newValue === 'true') {
        const isFromOnboarding = localStorage.getItem('onboarding-gmail-connect') === 'true';
        if (isFromOnboarding) {
          setHideWizardForLabels(true);
          setShowGmailLabelScreen(true);
        }
      }
    };

    window.addEventListener('gmail-oauth-complete', handleOAuthComplete);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('gmail-oauth-complete', handleOAuthComplete);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Listen for when label selection completes
  useEffect(() => {
    const handleLabelSelectionComplete = () => {
      // Clear the onboarding flag
      localStorage.removeItem('onboarding-gmail-connect');
      
      // Since Gmail is now connected, data sources are complete
      // Store that we should continue to Themes step (step 2)
      // Do this BEFORE hiding the label screen and forceRecheck
      localStorage.setItem('onboarding-continue-step', '2'); // Step 2 = Themes
      
      // Hide label screen
      setShowGmailLabelScreen(false);
      
      // Small delay before showing wizard to ensure continue step is set
      setTimeout(() => {
        setHideWizardForLabels(false);
        // Force recheck to update onboarding status (this will detect Gmail is connected)
        forceRecheck();
      }, 50);
    };
    
    window.addEventListener('gmail-label-selection-complete', handleLabelSelectionComplete);
    
    return () => {
      window.removeEventListener('gmail-label-selection-complete', handleLabelSelectionComplete);
    };
  }, [forceRecheck]);

  // Load data sources when workspace is available (for banner visibility)
  useEffect(() => {
    const workspaceId = tokens?.workspace_id;
    if (workspaceId) {
      loadSlackIntegrations();
      loadGmailAccounts();
      loadConnectors(workspaceId);
    }
  }, [tokens?.workspace_id, loadSlackIntegrations, loadGmailAccounts, loadConnectors]);

  // Check onboarding status when component mounts and workspace is available
  useEffect(() => {
    const workspaceId = tokens?.workspace_id;
    const accessToken = tokens?.access_token;
    
    if (!workspaceId || !accessToken) {
      console.log('[AdminLayout] No workspace or token, skipping onboarding check');
      return;
    }

    // If workspace changed (user logged into different workspace), force recheck
    if (lastCheckedWorkspaceId && lastCheckedWorkspaceId !== workspaceId) {
      console.log('[AdminLayout] Workspace changed, forcing recheck');
      forceRecheck();
      setLastCheckedWorkspaceId(workspaceId);
    }

    // Only check if not already checked and onboarding is not complete/dismissed
    // This prevents unnecessary API calls on every page navigation
    if (!hasChecked) {
      // Quick check: if onboarding is already complete or dismissed, skip API calls
      const wasDismissed = localStorage.getItem('headway-onboarding-dismissed') === 'true';
      const wasCompleted = localStorage.getItem('headway-onboarding-complete') === 'true';
      
      if (wasDismissed || wasCompleted) {
        console.log('[AdminLayout] Onboarding already complete/dismissed, skipping check');
        // Mark as checked without making API calls
        useOnboardingStore.setState({ 
          hasChecked: true,
          isOnboardingComplete: wasCompleted,
          showOnboardingDialog: false,
        });
        return;
      }

      console.log('[AdminLayout] Triggering onboarding check for workspace:', workspaceId);
      setLastCheckedWorkspaceId(workspaceId);
      checkOnboardingStatus(workspaceId, accessToken);
    }
  }, [tokens?.workspace_id, tokens?.access_token, hasChecked, checkOnboardingStatus, forceRecheck, lastCheckedWorkspaceId]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerCollapse = () => {
    setCollapsed(!collapsed);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  // Get resetOnboarding from the store
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const handleLogout = () => {
    // Reset onboarding state so it rechecks on next login
    resetOnboarding();
    logout();
    navigate(ROUTES.HOME);
    handleProfileMenuClose();
  };

  // Handle banner button click - open wizard at data sources step
  const handleBannerConnectClick = () => {
    // Set the continue step to 1 (data sources step)
    localStorage.setItem('onboarding-continue-step', '1');
    // Open the wizard
    setWizardOpenFromBanner(true);
  };

  // Clean up continue step when wizard closes
  const handleWizardComplete = () => {
    completeOnboarding();
    setWizardOpenFromBanner(false);
    localStorage.removeItem('onboarding-continue-step');
    // Dispatch event to refresh themes if user is on themes page
    window.dispatchEvent(new CustomEvent('onboarding-complete'));
  };

  const handleWizardDismiss = () => {
    dismissOnboarding();
    setWizardOpenFromBanner(false);
    localStorage.removeItem('onboarding-continue-step');
  };

  // Determine if banner should be shown
  // Show when: user has no data sources connected (regardless of onboarding status)
  const dataSources = getDataSources();
  const hasDataSources = !isLoadingIntegrations && dataSources.length > 0;
  const shouldShowBanner = 
    !isLoadingIntegrations &&
    !hasDataSources &&
    !showOnboardingDialog &&
    !wizardOpenFromBanner &&
    !hideWizardForLabels;

  const currentDrawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.mode === 'dark' 
        ? `linear-gradient(180deg, ${alpha('#0f0f23', 0.98)} 0%, ${alpha('#1a1a2e', 0.95)} 100%)`
        : `linear-gradient(180deg, ${alpha('#fafafa', 0.98)} 0%, ${alpha('#f5f5f5', 0.95)} 100%)`,
      borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      overflow: 'hidden',
    }}>
      {/* Logo and branding */}
      <Box sx={{ 
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 1.5,
        minHeight: 64,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
      }}>
        <Box sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
          flexShrink: 0,
        }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>
            H
          </Typography>
        </Box>
        {!collapsed && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              color: 'text.primary', 
              fontSize: '1rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}>
              HeadwayHQ
            </Typography>
            <Typography variant="caption" sx={{ 
              color: 'text.secondary', 
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
            }}>
              Product Intelligence
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 2, px: collapsed ? 1 : 1.5, overflow: 'auto' }}>
        <List disablePadding>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;

            const button = (
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  px: collapsed ? 0 : 1.5,
                  mb: 0.5,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  minHeight: 48,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  '&.Mui-selected': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      borderRadius: '0 4px 4px 0',
                      background: theme.palette.primary.main,
                      boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.5)}`,
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                    '& .MuiListItemText-primary': {
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                    },
                    '&:hover': {
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`,
                    },
                  },
                  '&:hover': {
                    background: alpha(theme.palette.action.hover, 0.08),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    minWidth: collapsed ? 0 : 40,
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                      }
                    }}
                  />
                )}
              </ListItemButton>
            );

            return (
              <ListItem key={item.text} disablePadding>
                {collapsed ? (
                  <Tooltip title={item.text} placement="right" arrow>
                    {button}
                  </Tooltip>
                ) : (
                  button
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Collapse/Expand Toggle at bottom */}
      <Box sx={{ 
        p: 1.5,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        display: { xs: 'none', sm: 'flex' },
        justifyContent: collapsed ? 'center' : 'flex-end',
      }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right" arrow>
          <IconButton
            onClick={handleDrawerCollapse}
            size="small"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            {collapsed ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
      <GlobalStyles
        styles={{
          'html, body': {
            overflowX: 'hidden',
          },
        }}
      />
      <Box sx={{ 
        display: 'flex', 
        minHeight: '100vh', 
        overflow: 'hidden',
        width: '100vw',
        maxWidth: '100%',
      }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          left: { xs: 0, sm: currentDrawerWidth },
          width: { xs: '100%', sm: `calc(100% - ${currentDrawerWidth}px)` },
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }}>
            {headerContent ? (
              headerContent
            ) : (
              <Typography variant="h6" noWrap component="div" sx={{ 
                fontWeight: 600, 
                fontSize: '1.1rem',
                color: theme.palette.text.primary,
              }}>
                {navigationItems.find(item =>
                  location.pathname === item.path
                )?.text || 'HeadwayHQ'}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ThemeToggle />

            <IconButton
              onClick={handleProfileMenuOpen}
              aria-label="account menu"
              sx={{
                p: 0.5,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Avatar sx={{
                width: 34,
                height: 34,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                fontSize: '0.9rem',
                fontWeight: 600,
              }}>
                {user?.first_name?.[0] || user?.email[0].toUpperCase()}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              onClick={handleProfileMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  mt: 1,
                  borderRadius: 2,
                  minWidth: 180,
                  boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`,
                }
              }}
            >
              <MenuItem onClick={() => navigate(ROUTES.SETTINGS_PROFILE)}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                Workspace Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            border: 'none',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: currentDrawerWidth,
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: currentDrawerWidth,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: 'none',
            overflowX: 'hidden',
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0, // Important: allows flex item to shrink below content size
          minHeight: '100vh',
          background: theme.palette.background.default,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        <Toolbar />
        {children}
        
        {/* Connect Data Sources Banner - Fixed position in right corner */}
        {shouldShowBanner && (
          <ConnectDataSourcesBanner onConnectClick={handleBannerConnectClick} />
        )}
      </Box>

      {/* Gmail Label Selection Screen - shown when returning from Gmail OAuth during onboarding */}
      {showGmailLabelScreen && <GmailLabelSelectionScreen />}

                  {/* Onboarding Wizard - shown for new users who haven't completed setup */}
                  {/* Hide wizard when Gmail label selection screen is active */}
                  {!hideWizardForLabels && (
                    <OnboardingWizard
                      open={showOnboardingDialog || wizardOpenFromBanner}
                      onComplete={handleWizardComplete}
                      onDismiss={handleWizardDismiss}
                    />
                  )}
    </Box>
    </>
  );
}