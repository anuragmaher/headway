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
import { ConnectDataSourcesBanner } from '@/shared/components/ConnectDataSourcesBanner';
import { useAuthActions, useUser, useAuthStore } from '@/features/auth/store/auth-store';
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

  // Custom header content from pages
  const headerContent = useLayoutStore((state) => state.headerContent);

  // Load data sources when workspace is available (for banner visibility)
  useEffect(() => {
    const workspaceId = tokens?.workspace_id;
    if (workspaceId) {
      loadSlackIntegrations();
      loadGmailAccounts();
      loadConnectors(workspaceId);
    }
  }, [tokens?.workspace_id, loadSlackIntegrations, loadGmailAccounts, loadConnectors]);

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

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
    handleProfileMenuClose();
  };

  // Determine if banner should be shown (when no data sources connected)
  const dataSources = getDataSources();
  const hasDataSources = !isLoadingIntegrations && dataSources.length > 0;

  // Clear banner dismissed state when data sources are connected
  useEffect(() => {
    if (hasDataSources) {
      sessionStorage.removeItem('headway-datasource-banner-dismissed');
    }
  }, [hasDataSources]);

  const shouldShowBanner = !isLoadingIntegrations && !hasDataSources;

  const currentDrawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.mode === 'dark' ? '#1A1A1A' : '#fafbfc',
      overflow: 'hidden',
    }}>
      {/* Logo header */}
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
              '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.08) },
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
                    '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
                    '& .MuiListItemText-primary': {
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                    },
                  },
                  '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.06) },
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
                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.08) },
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
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* App Bar */}
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
          <Toolbar sx={{ minHeight: { xs: 48, sm: 48 }, height: 48, px: { xs: 1.5, sm: 2 } }}>
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
                  {navigationItems.find(item => location.pathname === item.path)?.text || 'HeadwayHQ'}
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
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
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
                  <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                  Profile
                </MenuItem>
                <MenuItem onClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)} sx={{ py: 1, fontSize: '0.875rem' }}>
                  <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                  Settings
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={handleLogout} sx={{ py: 1, fontSize: '0.875rem' }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
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
          minWidth: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: theme.palette.background.default,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ minHeight: 48, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, overflowX: 'hidden', overflowY: 'auto' }}>
          <PageTransition>
            {children}
          </PageTransition>
        </Box>

        {/* Connect Data Sources Banner */}
        {shouldShowBanner && (
          <ConnectDataSourcesBanner onConnectClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)} />
        )}
      </Box>
    </Box>
    </>
  );
}
