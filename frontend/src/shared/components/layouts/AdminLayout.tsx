/**
 * Layout for authenticated app pages (dashboard, settings, etc.)
 */

import React, { useState } from 'react';
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
import { useAuthActions, useUser } from '@/features/auth/store/auth-store';
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

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
    handleProfileMenuClose();
  };

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
            <Typography variant="h6" noWrap component="div" sx={{ 
              fontWeight: 600, 
              fontSize: '1.1rem',
              color: theme.palette.text.primary,
            }}>
              {navigationItems.find(item =>
                location.pathname === item.path
              )?.text || 'HeadwayHQ'}
            </Typography>
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
      </Box>
    </Box>
    </>
  );
}