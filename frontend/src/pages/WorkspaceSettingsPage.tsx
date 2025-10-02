/**
 * Workspace settings page for managing workspace-wide configurations
 */

import React, { useState } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
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

  const getStatusColor = (status: DataSource['status']) => {
    switch (status) {
      case 'connected': return 'success';
      case 'disconnected': return 'default';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: DataSource['status']) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <SettingsIcon color="disabled" />;
    }
  };

  return (
    <AdminLayout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Workspace Settings
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your workspace's data sources, connectors, and preferences.
        </Typography>

        <Grid container spacing={3}>
          {/* Data Sources */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Data Sources & Connectors
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    size="small"
                  >
                    Add Source
                  </Button>
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  Connect external platforms to automatically collect and analyze feature requests.
                </Typography>

                <List>
                  {dataSources.map((source, index) => (
                    <React.Fragment key={source.id}>
                      <ListItem>
                        <Box sx={{ mr: 2 }}>
                          {getStatusIcon(source.status)}
                        </Box>
                        <ListItemText
                          primary={source.name}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={source.status}
                                size="small"
                                color={getStatusColor(source.status)}
                                variant="outlined"
                              />
                              {source.lastSync && (
                                <Typography variant="caption" color="text.secondary">
                                  Last sync: {source.lastSync}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" size="small">
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < dataSources.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>

                {dataSources.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No data sources connected. Add your first source to start collecting feedback in this workspace.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Company Settings */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  General Settings
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                      />
                    }
                    label="Auto-sync data sources"
                  />
                  <Typography variant="caption" display="block" color="text.secondary">
                    Automatically sync new data every hour
                  </Typography>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                      />
                    }
                    label="Email notifications"
                  />
                  <Typography variant="caption" display="block" color="text.secondary">
                    Send weekly summaries and alerts
                  </Typography>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Workspace Information
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  <strong>Workspace:</strong> {user?.company_name || 'Not available'}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Admin:</strong> {user?.first_name} {user?.last_name}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Workspace ID:</strong> {user?.company_id || 'Not available'}
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 3 }}
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Available Connectors */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Available Connectors
                </Typography>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  Connect these platforms to automatically collect feature requests and feedback.
                </Typography>

                <Grid container spacing={2}>
                  {[
                    { name: 'Slack', description: 'Monitor channels for feature requests', available: true },
                    { name: 'Gmail', description: 'Track feature requests from customer emails', available: true },
                    { name: 'Microsoft Teams', description: 'Collect feedback from team conversations', available: false },
                    { name: 'Discord', description: 'Track community suggestions', available: false },
                    { name: 'Intercom', description: 'Import customer feedback', available: false },
                    { name: 'Zendesk', description: 'Analyze support tickets', available: false },
                    { name: 'API Webhook', description: 'Custom integration endpoint', available: false },
                  ].map((connector) => (
                    <Grid item xs={12} sm={6} md={4} key={connector.name}>
                      <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" gutterBottom>
                            {connector.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {connector.description}
                          </Typography>
                          <Button
                            variant={connector.available ? "outlined" : "disabled"}
                            size="small"
                            disabled={!connector.available}
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