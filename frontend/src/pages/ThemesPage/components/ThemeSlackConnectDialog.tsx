/**
 * ThemeSlackConnectDialog - Dialog to connect/disconnect theme to Slack channel
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { slackService, type SlackIntegration } from '@/services/slack';
import { themeService } from '@/services/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useThemesPageStore } from '../store';

interface ThemeSlackConnectDialogProps {
  open: boolean;
  onClose: () => void;
  theme: {
    id: string;
    name: string;
    slack_integration_id?: string | null;
    slack_channel_id?: string | null;
    slack_channel_name?: string | null;
  } | null;
}

export const ThemeSlackConnectDialog: React.FC<ThemeSlackConnectDialogProps> = ({
  open,
  onClose,
  theme,
}) => {
  const themeMUI = useTheme();
  const auth = useAuthStore();
  const { fetchThemes } = useThemesPageStore();
  
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedChannelName, setSelectedChannelName] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = auth.tokens?.workspace_id;

  useEffect(() => {
    if (open && theme) {
      loadSlackIntegrations();
      // Pre-select if already connected
      if (theme.slack_integration_id && theme.slack_channel_id) {
        setSelectedIntegrationId(theme.slack_integration_id);
        setSelectedChannelId(theme.slack_channel_id);
        setSelectedChannelName(theme.slack_channel_name || '');
      } else {
        setSelectedIntegrationId('');
        setSelectedChannelId('');
        setSelectedChannelName('');
      }
      setError(null);
    }
  }, [open, theme]);

  const loadSlackIntegrations = async () => {
    if (!workspaceId) return;
    
    setLoadingIntegrations(true);
    setError(null);
    
    try {
      const slackIntegrations = await slackService.getIntegrations();
      setIntegrations(slackIntegrations);
      
      // Auto-select first integration if only one
      if (slackIntegrations.length === 1 && !theme?.slack_integration_id) {
        setSelectedIntegrationId(slackIntegrations[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Slack integrations:', err);
      setError(err.response?.data?.detail || 'Failed to load Slack integrations');
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
  const availableChannels = selectedIntegration?.channels || [];

  const handleConnect = async () => {
    if (!theme || !workspaceId || !selectedIntegrationId || !selectedChannelId) {
      setError('Please select both integration and channel');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const selectedChannel = availableChannels.find(c => c.id === selectedChannelId);
      
      await themeService.connectThemeToSlack(theme.id, workspaceId, {
        integration_id: selectedIntegrationId,
        channel_id: selectedChannelId,
        channel_name: selectedChannel?.name || selectedChannelName,
      });

      await fetchThemes();
      onClose();
    } catch (err: any) {
      console.error('Failed to connect theme to Slack:', err);
      setError(err.response?.data?.detail || 'Failed to connect theme to Slack');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!theme || !workspaceId) return;

    setDisconnecting(true);
    setError(null);

    try {
      await themeService.disconnectThemeFromSlack(theme.id, workspaceId);
      await fetchThemes();
      onClose();
    } catch (err: any) {
      console.error('Failed to disconnect theme from Slack:', err);
      setError(err.response?.data?.detail || 'Failed to disconnect theme from Slack');
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = theme?.slack_integration_id && theme?.slack_channel_id;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        }
      }}
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        px: 3,
        pt: 2.5,
        borderBottom: `1px solid ${alpha(themeMUI.palette.divider, 0.1)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isConnected ? (
            <NotificationsIcon sx={{ color: themeMUI.palette.success.main }} />
          ) : (
            <NotificationsOffIcon sx={{ color: themeMUI.palette.text.secondary }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isConnected ? 'Slack Notifications' : 'Connect to Slack'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isConnected ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              This theme is connected to Slack channel <strong>#{theme.slack_channel_name}</strong>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              When features are created or updated in the <strong>{theme.name}</strong> theme,
              notifications will be sent to the connected Slack channel.
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={handleDisconnect}
              disabled={disconnecting}
              startIcon={disconnecting ? <CircularProgress size={16} /> : <NotificationsOffIcon />}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect from Slack'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loadingIntegrations ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : integrations.length === 0 ? (
              <Alert severity="info">
                No Slack integrations found. Please connect a Slack workspace first from Workspace Settings.
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Connect <strong>{theme?.name}</strong> to a Slack channel to receive notifications
                  when features are created or updated in this theme.
                </Typography>

                <Divider />

                <TextField
                  select
                  label="Slack Workspace"
                  value={selectedIntegrationId}
                  onChange={(e) => {
                    setSelectedIntegrationId(e.target.value);
                    setSelectedChannelId('');
                    setSelectedChannelName('');
                  }}
                  fullWidth
                  required
                  helperText="Select the Slack workspace to connect"
                >
                  {integrations.map((integration) => (
                    <MenuItem key={integration.id} value={integration.id}>
                      {integration.team_name}
                    </MenuItem>
                  ))}
                </TextField>

                {selectedIntegration && (
                  <TextField
                    select
                    label="Slack Channel"
                    value={selectedChannelId}
                    onChange={(e) => {
                      const channelId = e.target.value;
                      setSelectedChannelId(channelId);
                      const channel = availableChannels.find(c => c.id === channelId);
                      setSelectedChannelName(channel?.name || '');
                    }}
                    fullWidth
                    required
                    disabled={!selectedIntegrationId}
                    helperText={`Select a channel from ${selectedIntegration.team_name}`}
                  >
                    {availableChannels.length === 0 ? (
                      <MenuItem disabled>No channels available</MenuItem>
                    ) : (
                      availableChannels.map((channel) => (
                        <MenuItem key={channel.id} value={channel.id}>
                          #{channel.name}
                          {channel.is_private && ' (Private)'}
                        </MenuItem>
                      ))
                    )}
                  </TextField>
                )}

                {selectedIntegration && availableChannels.length === 0 && (
                  <Alert severity="warning">
                    No channels available for this integration. Please select channels when connecting
                    the Slack workspace.
                  </Alert>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      {!isConnected && integrations.length > 0 && (
        <DialogActions sx={{ p: 2, pt: 1.5 }}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            variant="contained"
            disabled={!selectedIntegrationId || !selectedChannelId || connecting}
            startIcon={connecting ? <CircularProgress size={16} /> : <NotificationsIcon />}
            sx={{
              background: `linear-gradient(135deg, ${themeMUI.palette.primary.main} 0%, ${themeMUI.palette.primary.dark} 100%)`,
            }}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
