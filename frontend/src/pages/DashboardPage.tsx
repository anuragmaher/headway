/**
 * Main dashboard page for authenticated users
 */

import { Box, Typography, Grid, Card, CardContent, Chip, Button, alpha, useTheme } from '@mui/material';
import { Settings as SettingsIcon, Add as AddIcon, TrendingUp, Category, FeaturedPlayList, Speed } from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useUser } from '@/features/auth/store/auth-store';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';

export function DashboardPage(): JSX.Element {
  const user = useUser();
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <AdminLayout>
      <Box>
        {/* Hero Section */}
        <Box sx={{ 
          mb: 4,
          p: 4,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            filter: 'blur(20px)',
          },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <Box>
              <Typography variant="h3" sx={{ 
                fontWeight: 800, 
                mb: 1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Welcome back!
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Your product intelligence platform for managing feature requests and themes.
                </Typography>
                {user?.company_name && (
                  <Chip 
                    label={user.company_name}
                    size="medium"
                    sx={{
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      color: 'white',
                      fontWeight: 600,
                      px: 1,
                      boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  />
                )}
              </Box>
            </Box>
            
            <Button
              variant="contained"
              size="large"
              startIcon={<SettingsIcon />}
              onClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                },
                transition: 'all 0.3s ease-in-out',
              }}
            >
              Workspace Settings
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[
            { 
              title: 'Total Requests', 
              value: '247', 
              change: '+12%', 
              icon: FeaturedPlayList,
              color: theme.palette.primary.main 
            },
            { 
              title: 'Active Themes', 
              value: '18', 
              change: '+3%', 
              icon: Category,
              color: theme.palette.success.main 
            },
            { 
              title: 'This Week', 
              value: '42', 
              change: '+8%', 
              icon: TrendingUp,
              color: theme.palette.warning.main 
            },
            { 
              title: 'Response Time', 
              value: '2.4h', 
              change: '-15%', 
              icon: Speed,
              color: theme.palette.error.main 
            },
          ].map((stat) => (
            <Grid item xs={12} sm={6} lg={3} key={stat.title}>
              <Card sx={{
                p: 2,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(stat.color, 0.1)} 0%, ${alpha(stat.color, 0.05)} 100%)`,
                border: `1px solid ${alpha(stat.color, 0.1)}`,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px ${alpha(stat.color, 0.2)}`,
                },
              }}>
                <CardContent sx={{ p: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${stat.color} 0%, ${alpha(stat.color, 0.8)} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 20px ${alpha(stat.color, 0.3)}`,
                    }}>
                      <stat.icon sx={{ color: 'white', fontSize: 24 }} />
                    </Box>
                    <Chip 
                      label={stat.change}
                      size="small"
                      sx={{
                        background: stat.change.startsWith('+') ? 
                          `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)` :
                          `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
                        color: stat.change.startsWith('+') ? theme.palette.success.main : theme.palette.error.main,
                        border: `1px solid ${stat.change.startsWith('+') ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.error.main, 0.2)}`,
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, color: 'text.primary' }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {stat.title}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
              },
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Category sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Themes
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Organize and categorize feature requests by themes. Track trends and identify patterns in user feedback.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 30px ${alpha(theme.palette.success.main, 0.1)}`,
              },
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <FeaturedPlayList sx={{ color: theme.palette.success.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Features
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Manage and prioritize feature requests from your users. Track status and assign development priorities.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 30px ${alpha(theme.palette.warning.main, 0.1)}`,
              },
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <TrendingUp sx={{ color: theme.palette.warning.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Analytics
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Detailed insights and analytics on feature request trends, user engagement, and decision metrics.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Getting Started Section */}
        <Box sx={{ mt: 4 }}>
          <Card sx={{
            borderRadius: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -30,
              left: -30,
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.2)} 0%, ${alpha(theme.palette.success.main, 0.1)} 100%)`,
              filter: 'blur(15px)',
            },
          }}>
            <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 20px ${alpha(theme.palette.success.main, 0.3)}`,
                  }}>
                    <AddIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Getting Started
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(ROUTES.SETTINGS_WORKSPACE)}
                  sx={{
                    borderRadius: 3,
                    px: 3,
                    py: 1.5,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    boxShadow: `0 8px 30px ${alpha(theme.palette.success.main, 0.3)}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 12px 40px ${alpha(theme.palette.success.main, 0.4)}`,
                    },
                    transition: 'all 0.3s ease-in-out',
                  }}
                >
                  Connect Data Source
                </Button>
              </Box>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                Here's what you can do to get the most out of HeadwayHQ:
              </Typography>
              <Grid container spacing={2}>
                {[
                  'Connect your Slack workspace to monitor feature requests',
                  'Organize feedback into themes and categories',
                  'Track feature requests and their details',
                  'Analyze trends in customer feedback',
                  'Prioritize development based on user demand',
                ].map((item, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2, background: alpha(theme.palette.success.main, 0.05) }}>
                      <Box sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: 'white',
                        fontWeight: 700,
                      }}>
                        {index + 1}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </AdminLayout>
  );
}