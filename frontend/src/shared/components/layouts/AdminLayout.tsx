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
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  BusinessCenter as FeaturesIcon,
  Psychology as PsychologyIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useAuthActions, useUser } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/lib/constants/routes';
import { useResponsive } from '@/shared/utils/responsive';

const DRAWER_WIDTH = 280;
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
    text: 'Features',
    icon: <FeaturesIcon />,
    path: ROUTES.FEATURES,
  },
  {
    text: 'Themes',
    icon: <CategoryIcon />,
    path: ROUTES.THEMES,
  },
  {
    text: 'AI Intelligence',
    icon: <PsychologyIcon />,
    path: ROUTES.CLUSTERING,
  },
  {
    text: 'Workspace Settings',
    icon: <SettingsIcon />,
    path: ROUTES.SETTINGS_WORKSPACE,
  },
];

export function AdminLayout({ children }: AdminLayoutProps): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // Start collapsed by default
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { } = useResponsive();
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

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
      backdropFilter: 'blur(10px)',
      width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
      transition: 'width 0.3s ease-in-out',
    }}>
      {/* Logo and branding */}
      <Box sx={{ 
        p: collapsed ? 1.5 : 3, 
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: collapsed ? 0 : 1.5,
          flex: 1,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
          }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>
              H
            </Typography>
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.1rem' }}>
                HeadwayHQ
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Product Intelligence
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Collapse toggle button - only show on desktop */}
        {!collapsed && (
          <IconButton
            onClick={handleDrawerCollapse}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              width: 32,
              height: 32,
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      
      {/* Expand button positioned within the drawer for collapsed state */}
      {collapsed && (
        <Box sx={{ 
          position: 'absolute', 
          top: 16, 
          right: -12, 
          zIndex: 1000 
        }}>
          <IconButton
            onClick={handleDrawerCollapse}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              width: 24,
              height: 24,
              bgcolor: theme.palette.primary.main,
              color: 'white',
              border: `2px solid ${theme.palette.background.paper}`,
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.3)}`,
              '&:hover': {
                bgcolor: theme.palette.primary.dark,
                transform: 'scale(1.1)',
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.4)}`,
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ px: collapsed ? 1 : 2, py: 3 }}>
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          location.pathname.startsWith(item.path + '/');
          
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={isActive}
                sx={{
                  borderRadius: 1,
                  py: 1.2,
                  px: collapsed ? 1.5 : 2,
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  minHeight: 48,
                  '&.Mui-selected': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 4,
                      height: '60%',
                      borderRadius: '0 4px 4px 0',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      boxShadow: `2px 0 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                    },
                    '&:hover': {
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`,
                      transform: collapsed ? 'scale(1.05)' : 'translateX(2px)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    transform: collapsed ? 'scale(1.05)' : 'translateX(2px)',
                  },
                }}
                title={collapsed ? item.text : undefined} // Show tooltip when collapsed
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? 'inherit' : theme.palette.text.secondary,
                    minWidth: collapsed ? 0 : 36,
                    mr: collapsed ? 0 : 2,
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: '0.01em',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* User info */}
      {user && (
        <Box sx={{ 
          p: collapsed ? 1 : 2, 
          mt: 'auto',
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: collapsed ? 0 : 1.5,
            p: collapsed ? 1 : 1.5,
            borderRadius: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            <Avatar sx={{ 
              width: collapsed ? 36 : 40, 
              height: collapsed ? 36 : 40, 
              fontSize: '0.9rem',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}>
              {user.first_name?.[0] || user.email[0].toUpperCase()}
            </Avatar>
            {!collapsed && (
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }} noWrap>
                  {`${user.first_name} ${user.last_name}` || user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }} noWrap>
                  {user.email}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip 
                    label={user.company_name || 'Workspace'}
                    size="small"
                    sx={{ 
                      height: 20,
                      fontSize: '0.7rem',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                      color: theme.palette.primary.main,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH}px)` },
          ml: { sm: `${collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH}px` },
          transition: 'all 0.3s ease-in-out',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
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

          <Typography variant="h6" noWrap component="div" sx={{ 
            flexGrow: 1, 
            fontWeight: 600, 
            fontSize: '1.1rem',
            color: theme.palette.text.primary,
          }}>
            {navigationItems.find(item => 
              location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            )?.text || 'HeadwayHQ'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ThemeToggle />
            
            <IconButton
              onClick={handleProfileMenuOpen}
              aria-label="account menu"
              sx={{
                p: 0.5,
                borderRadius: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              <Avatar sx={{ 
                width: 36, 
                height: 36,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
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

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ 
          width: { sm: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH }, 
          flexShrink: { sm: 0 },
          transition: 'width 0.3s ease-in-out',
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
              transition: 'width 0.3s ease-in-out',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          width: { sm: `calc(100% - ${collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH}px)` },
          transition: 'all 0.3s ease-in-out',
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${alpha(theme.palette.secondary.main, 0.02)} 0%, transparent 50%)`,
            pointerEvents: 'none',
          },
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}