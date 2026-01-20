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
  GridViewRounded as DashboardIcon,
  AutoAwesomeRounded as ThemesIcon,
  SettingsRounded as SettingsIcon,
  LogoutRounded as LogoutIcon,
  PersonRounded as PersonIcon,
  ChevronLeftRounded as CollapseIcon,
  ChevronRightRounded as ExpandIcon,
  PeopleAltRounded as CustomersIcon,
  InboxRounded as MessagesIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { PageTransition } from '@/shared/components/PageTransition';
import { OnboardingWizard } from '@/shared/components/OnboardingWizard/OnboardingWizard';
import { GmailLabelSelectionScreen } from '@/shared/components/OnboardingWizard/GmailLabelSelectionScreen';
import { ConnectDataSourcesBanner } from '@/shared/components/ConnectDataSourcesBanner';
import { useAuthActions, useUser, useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '@/shared/store/onboardingStore';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { useWorkspaceSettingsStore } from '@/shared/store/WorkspaceStore/workspaceSettingsStore';
import { ROUTES } from '@/lib/constants/routes';

const DRAWER_WIDTH = 220;
const DRAWER_WIDTH_COLLAPSED = 64;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  {
    text: 'Dashboard',
    icon: <DashboardIcon sx={{ fontSize: 20 }} />,
    path: ROUTES.DASHBOARD,
  },
  {
    text: 'Messages',
    icon: <MessagesIcon sx={{ fontSize: 20 }} />,
    path: ROUTES.SOURCES,
  },
  {
    text: 'Themes',
    icon: <ThemesIcon sx={{ fontSize: 20 }} />,
    path: ROUTES.THEMES,
  },
  {
    text: 'Customers',
    icon: <CustomersIcon sx={{ fontSize: 20 }} />,
    path: ROUTES.CUSTOMERS,
  },
  {
    text: 'Settings',
    icon: <SettingsIcon sx={{ fontSize: 20 }} />,
    path: ROUTES.SETTINGS_WORKSPACE,
  },
];

export function AdminLayout({ children }: AdminLayoutProps): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { logout } = useAuthActions();
  const user = useUser();
  const tokens = useAuthStore((state) => state.tokens);

  // Sidebar collapsed state from global store (persisted)
  const { sidebarCollapsed: collapsed, toggleSidebar } = useLayoutStore();

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

    // Only check if not already checked
    // The onboarding store handles localStorage checks internally with workspace-specific keys
    if (!hasChecked) {
      console.log('[AdminLayout] Triggering onboarding check for workspace:', workspaceId);
      setLastCheckedWorkspaceId(workspaceId);
      checkOnboardingStatus(workspaceId, accessToken);
    }
  }, [tokens?.workspace_id, tokens?.access_token, hasChecked, checkOnboardingStatus, forceRecheck, lastCheckedWorkspaceId]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerCollapse = () => {
    toggleSidebar();
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
  
  // Clear banner dismissed state when data sources are connected
  // This ensures banner can show again if user later disconnects all sources
  useEffect(() => {
    if (hasDataSources) {
      sessionStorage.removeItem('headway-datasource-banner-dismissed');
    }
  }, [hasDataSources]);
  
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
        ? '#1A1A1A'
        : '#fafbfc',
      overflow: 'hidden',
    }}>
      {/* Compact Logo header - matches AppBar height (48px) */}
      <Box sx={{
        px: collapsed ? 1 : 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        height: 48,
        minHeight: 48,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
              H
            </Typography>
          </Box>
          {!collapsed && (
            <Typography sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.875rem',
              letterSpacing: '-0.01em',
            }}>
              Headway
            </Typography>
          )}
        </Box>
        {!collapsed && (
          <IconButton
            onClick={handleDrawerCollapse}
            size="small"
            sx={{
              width: 24,
              height: 24,
              color: theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.08),
              },
            }}
          >
            <CollapseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 1, px: collapsed ? 0.75 : 1, overflow: 'auto' }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;

            const button = (
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={isActive}
                sx={{
                  borderRadius: 1.5,
                  py: 0.875,
                  px: collapsed ? 0 : 1.25,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  minHeight: 36,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08),
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '25%',
                      bottom: '25%',
                      width: 2,
                      borderRadius: '0 2px 2px 0',
                      background: theme.palette.primary.main,
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                    '& .MuiListItemText-primary': {
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.action.hover, 0.06),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    minWidth: collapsed ? 0 : 32,
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
                        fontSize: '0.8125rem',
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

      {/* Expand button at bottom (only when collapsed) */}
      {collapsed && (
        <Box sx={{
          p: 1,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
          display: { xs: 'none', sm: 'flex' },
          justifyContent: 'center',
        }}>
          <Tooltip title="Expand" placement="right" arrow>
            <IconButton
              onClick={handleDrawerCollapse}
              size="small"
              sx={{
                width: 28,
                height: 28,
                color: theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: alpha(theme.palette.action.hover, 0.08),
                },
              }}
            >
              <ExpandIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <GlobalStyles
        styles={{
          'html, body, #root': {
            margin: 0,
            padding: 0,
            height: '100%',
            overflow: 'hidden',
          },
        }}
      />
      <Box sx={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}>
      {/* Compact App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          left: { xs: 0, sm: currentDrawerWidth },
          width: { xs: '100%', sm: `calc(100% - ${currentDrawerWidth}px)` },
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: theme.palette.mode === 'dark' ? '#1A1A1A' : '#fafbfc',
          backdropFilter: 'none',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          borderRadius: 0,
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 48, sm: 48 },
            height: 48,
            px: { xs: 1.5, sm: 2 },
          }}
        >
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            size="small"
            sx={{ mr: 1.5, display: { sm: 'none' } }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {headerContent ? (
              headerContent
            ) : (
              <Typography
                variant="subtitle1"
                noWrap
                component="div"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: theme.palette.text.secondary,
                  letterSpacing: '-0.01em',
                }}
              >
                {navigationItems.find(item =>
                  location.pathname === item.path
                )?.text || 'HeadwayHQ'}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ThemeToggle size="small" />

            <IconButton
              onClick={handleProfileMenuOpen}
              aria-label="account menu"
              size="small"
              sx={{
                p: 0.25,
                borderRadius: 1.5,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Avatar sx={{
                width: 28,
                height: 28,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                fontSize: '0.75rem',
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
                  mt: 0.5,
                  borderRadius: 2,
                  minWidth: 160,
                  boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.12)}`,
                }
              }}
            >
              <MenuItem onClick={() => navigate(ROUTES.SETTINGS_PROFILE)} sx={{ py: 1, fontSize: '0.875rem' }}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)} sx={{ py: 1, fontSize: '0.875rem' }}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                Settings
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout} sx={{ py: 1, fontSize: '0.875rem' }}>
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
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            borderRadius: 0,
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
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: theme.palette.background.default,
          overflow: 'hidden',
        }}
      >
        {/* Compact spacer for fixed AppBar (48px height) */}
        <Box sx={{ minHeight: 48, flexShrink: 0 }} />
        <Box
          sx={{
            flexGrow: 1,
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
        >
          <PageTransition>
            {children}
          </PageTransition>
        </Box>
        
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