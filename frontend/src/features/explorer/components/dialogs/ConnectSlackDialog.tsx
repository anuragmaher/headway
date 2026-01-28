/**
 * ConnectSlackDialog - Dialog for connecting a theme to a Slack channel
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import { slackService, type SlackIntegration } from '@/services/slack';
import { themeService } from '@/services/theme';

interface ConnectSlackDialogProps {
  open: boolean;
  onClose: () => void;
  themeId: string;
  themeName: string;
  onSuccess: () => void;
}

export const ConnectSlackDialog: React.FC<ConnectSlackDialogProps> = ({
  open,
  onClose,
  themeId,
  themeName,
  onSuccess,
}) => {
  const muiTheme = useTheme();
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Slack integrations when dialog opens
  useEffect(() => {
    if (open) {
      loadIntegrations();
    }
  }, [open]);

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await slackService.getIntegrations();
      setIntegrations(data);
      // Auto-select first integration if only one exists
      if (data.length === 1) {
        setSelectedIntegration(data[0].id);
      }
    } catch (err) {
      setError('Failed to load Slack integrations');
      console.error('Error loading Slack integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedIntegration || !selectedChannel) {
      return;
    }

    const integration = integrations.find((i) => i.id === selectedIntegration);
    const channel = integration?.channels.find((c) => c.id === selectedChannel);

    if (!channel) {
      setError('Please select a channel');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await themeService.connectThemeToSlack(themeId, {
        connector_id: selectedIntegration,
        channel_id: selectedChannel,
        channel_name: channel.name,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect to Slack');
      console.error('Error connecting theme to Slack:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedIntegration('');
    setSelectedChannel('');
    setError(null);
    onClose();
  };

  const selectedIntegrationData = integrations.find((i) => i.id === selectedIntegration);
  const availableChannels = selectedIntegrationData?.channels || [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Connect to Slack
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Connect "{themeName}" to a Slack channel to receive notifications when new insights are discovered.
        </Typography>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : integrations.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No Slack integrations found. Please connect a Slack workspace first in Settings.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Workspace selector (if multiple integrations) */}
            {integrations.length > 1 && (
              <FormControl fullWidth size="small">
                <InputLabel>Slack Workspace</InputLabel>
                <Select
                  value={selectedIntegration}
                  label="Slack Workspace"
                  onChange={(e) => {
                    setSelectedIntegration(e.target.value);
                    setSelectedChannel('');
                  }}
                >
                  {integrations.map((integration) => (
                    <MenuItem key={integration.id} value={integration.id}>
                      {integration.team_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Channel selector */}
            <FormControl fullWidth size="small" disabled={!selectedIntegration}>
              <InputLabel>Slack Channel</InputLabel>
              <Select
                value={selectedChannel}
                label="Slack Channel"
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                {availableChannels.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>
                        {channel.is_private ? '🔒' : '#'} {channel.name}
                      </Typography>
                      {channel.member_count && (
                        <Typography variant="caption" color="text.secondary">
                          ({channel.member_count} members)
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Info about what will happen */}
            {selectedChannel && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  When new transcript insights are classified under "{themeName}", a notification will be sent to this channel with:
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Key insights and topics
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Risk assessment and health signals
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Customer and company information
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConnect}
          variant="contained"
          disabled={!selectedIntegration || !selectedChannel || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? 'Connecting...' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectSlackDialog;
