/**
 * Workspace settings page for managing workspace-wide configurations
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  IconButton,
  Alert,
  alpha,
  useTheme,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  DataUsage as DataUsageIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Sync as SyncIcon,
  CloudSync as CloudSyncIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useUser } from '@/features/auth/store/auth-store';

interface DataSource {
  id: string;
  name: string;
  type: 'slack' | 'gmail' | 'teams' | 'discord' | 'api';
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
}

export function WorkspaceSettingsPage(): JSX.Element {
  const user = useUser();
  const theme = useTheme();
  const [autoSync, setAutoSync] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  // Mock data sources - will be replaced with real API calls
  const [dataSources] = useState<DataSource[]>([
    {
      id: '1',
      name: 'Slack Workspace',
      type: 'slack',
      status: 'connected',
      lastSync: '2 hours ago'
    },
    {
      id: '2',
      name: 'Gmail Integration',
      type: 'gmail',
      status: 'disconnected'
    }
  ]);


  const getConnectorIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'slack': return '💬';
      case 'gmail': return '📧';
      case 'microsoft teams': return '🟣';
      case 'discord': return '🟦';
      case 'intercom': return '💭';
      case 'zendesk': return '🎫';
      case 'api webhook': return '🔗';
      default: return '🔧';
    }
  };

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
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
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
                <SettingsIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Workspace Settings
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Manage data sources, integrations, and workspace preferences
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Connected Data Sources */}
          <Grid item xs={12} lg={8}>
            <Card sx={{
              borderRadius: 1,
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <DataUsageIcon sx={{ color: theme.palette.success.main, fontSize: 28 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Connected Data Sources
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dataSources.filter(s => s.status === 'connected').length} active connections
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    sx={{
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      '&:hover': { transform: 'translateY(-1px)' },
                    }}
                  >
                    Add Source
                  </Button>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                  Connect external platforms to automatically collect and analyze feature requests from your team and customers.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(dataSources.filter(s => s.status === 'connected').length / dataSources.length) * 100}
                    sx={{
                      height: 6,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 1,
                        background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Integration Progress: {dataSources.filter(s => s.status === 'connected').length} of {dataSources.length} sources connected
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {dataSources.map((source) => (
                    <Box key={source.id} sx={{
                      p: 2,
                      borderRadius: 1,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateX(4px)',
                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                      },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                          <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: source.status === 'connected' 
                              ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                              : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.3)} 0%, ${alpha(theme.palette.grey[500], 0.1)} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                          }}>
                            {source.type === 'slack' ? '💬' : '📧'}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {source.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Chip
                                label={source.status}
                                size="small"
                                sx={{
                                  bgcolor: source.status === 'connected' 
                                    ? alpha(theme.palette.success.main, 0.1)
                                    : alpha(theme.palette.grey[500], 0.1),
                                  color: source.status === 'connected' 
                                    ? theme.palette.success.main
                                    : theme.palette.grey[600],
                                  fontWeight: 600,
                                  textTransform: 'capitalize',
                                }}
                              />
                              {source.lastSync && (
                                <Typography variant="caption" color="text.secondary">
                                  <SyncIcon sx={{ fontSize: 12, mr: 0.5 }} />
                                  Last sync: {source.lastSync}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                        <IconButton 
                          sx={{ 
                            borderRadius: 2,
                            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>

                {dataSources.length === 0 && (
                  <Alert 
                    severity="info" 
                    sx={{ 
                      mt: 2,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    }}
                  >
                    No data sources connected. Add your first source to start collecting feedback in this workspace.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Workspace Settings Sidebar */}
          <Grid item xs={12} lg={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* General Settings */}
              <Card sx={{
                borderRadius: 1,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 30px ${alpha(theme.palette.warning.main, 0.1)}`,
                },
              }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <NotificationsIcon sx={{ color: theme.palette.warning.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Preferences
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    bgcolor: alpha(theme.palette.warning.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                    mb: 2
                  }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoSync}
                          onChange={(e) => setAutoSync(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-thumb': {
                              bgcolor: autoSync ? theme.palette.success.main : theme.palette.grey[400],
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Auto-sync data sources
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Automatically sync new data every hour
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>

                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                  }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-thumb': {
                              bgcolor: emailNotifications ? theme.palette.success.main : theme.palette.grey[400],
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Email notifications
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Send weekly summaries and alerts
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Workspace Information */}
              <Card sx={{
                borderRadius: 1,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
              }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <SecurityIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Workspace Info
                    </Typography>
                  </Box>

                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    bgcolor: alpha(theme.palette.background.paper, 0.5),
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    mb: 3
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ 
                        width: 40, 
                        height: 40,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
                        fontSize: '1rem',
                        fontWeight: 700,
                      }}>
                        {user?.company_name?.[0] || 'W'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {user?.company_name || 'HeadwayHQ Demo'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Workspace
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          ADMIN
                        </Typography>
                        <Typography variant="caption">
                          {user?.first_name} {user?.last_name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          WORKSPACE ID
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {user?.company_id || 'demo-workspace-1'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      '&:hover': { 
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                      },
                    }}
                  >
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </Box>
          </Grid>

          {/* Available Connectors */}
          <Grid item xs={12}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100())`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 30px ${alpha(theme.palette.info.main, 0.1)}`,
              },
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <CloudSyncIcon sx={{ color: theme.palette.info.main, fontSize: 28 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Available Connectors
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expand your data collection with these integrations
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  {[
                    { name: 'Slack', description: 'Monitor channels for feature requests', available: true },
                    { name: 'Gmail', description: 'Track feature requests from customer emails', available: true },
                    { name: 'Microsoft Teams', description: 'Collect feedback from team conversations', available: false },
                    { name: 'Discord', description: 'Track community suggestions', available: false },
                    { name: 'Intercom', description: 'Import customer feedback', available: false },
                    { name: 'Zendesk', description: 'Analyze support tickets', available: false },
                    { name: 'API Webhook', description: 'Custom integration endpoint', available: false },
                  ].map((connector) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={connector.name}>
                      <Card sx={{
                        borderRadius: 1,
                        background: connector.available 
                          ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`
                          : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.1)} 0%, ${alpha(theme.palette.grey[500], 0.05)} 100%)`,
                        border: connector.available
                          ? `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                          : `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': connector.available ? {
                          transform: 'translateY(-4px)',
                          boxShadow: `0 8px 30px ${alpha(theme.palette.success.main, 0.2)}`,
                        } : {},
                      }}>
                        <CardContent sx={{ p: 2, textAlign: 'center' }}>
                          <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: connector.available
                              ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                              : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.3)} 0%, ${alpha(theme.palette.grey[500], 0.1)} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 2,
                            fontSize: '1.5rem',
                          }}>
                            {getConnectorIcon(connector.name)}
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                            {connector.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                            {connector.description}
                          </Typography>
                          <Button
                            variant={connector.available ? "contained" : "outlined"}
                            size="small"
                            disabled={!connector.available}
                            sx={connector.available ? {
                              background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                              '&:hover': { transform: 'translateY(-1px)' },
                            } : {
                              borderColor: alpha(theme.palette.grey[500], 0.3),
                              color: theme.palette.grey[500],
                            }}
                          >
                            {connector.available ? 'Connect' : 'Coming Soon'}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
}