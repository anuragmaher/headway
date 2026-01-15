/**
 * Data Sources Step Component
 * Step 2: Connect data sources (Slack, Gmail, Gong, Fathom)
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Check as CheckIcon,
  Email as EmailIcon,
  CloudSync as GongIcon,
  RecordVoiceOver as FathomIcon,
} from '@mui/icons-material';
import { connectGmail, getGmailAccounts } from '@/services/gmail';
import { connectorService } from '@/services/connectors';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { DataSourceOption } from './types';

// Slack icon component
const SlackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

// Default data sources configuration
export const DEFAULT_DATA_SOURCES: DataSourceOption[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack to analyze customer conversations',
    icon: <SlackIcon />,
    color: '#4A154B',
    connected: false,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Import feedback from your email inbox',
    icon: <EmailIcon />,
    color: '#EA4335',
    connected: false,
  },
  {
    id: 'gong',
    name: 'Gong',
    description: 'Analyze sales call recordings',
    icon: <GongIcon />,
    color: '#7C3AED',
    connected: false,
  },
  {
    id: 'fathom',
    name: 'Fathom',
    description: 'Import meeting transcripts',
    icon: <FathomIcon />,
    color: '#059669',
    connected: false,
  },
];

interface DataSourcesStepProps {
  dataSources: DataSourceOption[];
  setError: (error: string | null) => void;
  workspaceId?: string;
}

export function DataSourcesStep({
  dataSources,
  setError,
  workspaceId: propWorkspaceId,
}: DataSourcesStepProps): JSX.Element {
  const theme = useTheme();
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = propWorkspaceId || tokens?.workspace_id;
  
  const [currentDataSources, setCurrentDataSources] = useState<DataSourceOption[]>(dataSources);
  
  // Dialog states for Gong and Fathom
  const [gongDialogOpen, setGongDialogOpen] = useState(false);
  const [fathomDialogOpen, setFathomDialogOpen] = useState(false);
  const [gongAccessKey, setGongAccessKey] = useState('');
  const [gongSecretKey, setGongSecretKey] = useState('');
  const [fathomApiToken, setFathomApiToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Check all data source connections when component mounts
  useEffect(() => {
    const checkConnections = async () => {
      if (!workspaceId) return;

      try {
        // Check Gmail
        const accounts = await getGmailAccounts();
        const isGmailConnected = accounts.length > 0;
        
        // Check Gong and Fathom connectors
        const connectors = await connectorService.getConnectors(workspaceId);
        const hasGong = connectors.some(c => c.connector_type === 'gong' && c.is_active);
        const hasFathom = connectors.some(c => c.connector_type === 'fathom' && c.is_active);
        
        setCurrentDataSources(prev => 
          prev.map(source => {
            if (source.id === 'gmail') {
              return { ...source, connected: isGmailConnected };
            } else if (source.id === 'gong') {
              return { ...source, connected: hasGong };
            } else if (source.id === 'fathom') {
              return { ...source, connected: hasFathom };
            }
            return source;
          })
        );
      } catch (err) {
        console.error('Failed to check connections:', err);
      }
    };

    checkConnections();
  }, [workspaceId]);

  const handleConnectDataSource = async (sourceId: string) => {
    setError(null);

    if (sourceId === 'gmail') {
      try {
        // Store flag in localStorage (accessible across tabs) that we're connecting Gmail from onboarding
        localStorage.setItem('onboarding-gmail-connect', 'true');
        const { auth_url } = await connectGmail();
        
        // Open Gmail OAuth in a new tab/window
        const oauthWindow = window.open(
          auth_url,
          'gmail-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        if (!oauthWindow) {
          setError('Please allow popups to connect Gmail.');
          return;
        }

        // Listen for OAuth completion via storage event (works across tabs)
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'gmail-oauth-complete' && e.newValue === 'true') {
            // Clear the flags
            localStorage.removeItem('gmail-oauth-complete');
            localStorage.removeItem('gmail-oauth-success');
            
            // Close the OAuth window if still open
            if (oauthWindow && !oauthWindow.closed) {
              oauthWindow.close();
            }
            
            // Trigger label selection screen in the original tab
            window.dispatchEvent(new CustomEvent('gmail-oauth-complete'));
            
            // Remove the listener
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(checkWindowClosed);
          }
        };

        // Also check if window was closed manually (user cancelled)
        const checkWindowClosed = setInterval(() => {
          if (oauthWindow?.closed) {
            clearInterval(checkWindowClosed);
            window.removeEventListener('storage', handleStorageChange);
            // Clear the onboarding flag if user closed the window
            localStorage.removeItem('onboarding-gmail-connect');
          }
        }, 1000);

        window.addEventListener('storage', handleStorageChange);
      } catch (err) {
        console.error('Failed to connect Gmail:', err);
        setError('Failed to start Gmail connection. Please try again.');
        localStorage.removeItem('onboarding-gmail-connect');
      }
    } else if (sourceId === 'slack') {
      setError('Please connect Slack from the Workspace Settings page after completing onboarding.');
    } else if (sourceId === 'gong') {
      setGongDialogOpen(true);
    } else if (sourceId === 'fathom') {
      setFathomDialogOpen(true);
    }
  };

  const handleConnectGong = async () => {
    if (!workspaceId) {
      setError('Workspace not found. Please try again.');
      return;
    }

    if (!gongAccessKey.trim() || !gongSecretKey.trim()) {
      setError('Please enter both Access Key and Secret Key.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'gong',
        gong_access_key: gongAccessKey.trim(),
        gong_secret_key: gongSecretKey.trim(),
      });

      // Update connection status
      setCurrentDataSources(prev => 
        prev.map(source => 
          source.id === 'gong' ? { ...source, connected: true } : source
        )
      );

      setGongDialogOpen(false);
      setGongAccessKey('');
      setGongSecretKey('');
    } catch (err: any) {
      console.error('Failed to connect Gong:', err);
      setError(err.response?.data?.detail || 'Failed to connect Gong. Please check your credentials and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectFathom = async () => {
    if (!workspaceId) {
      setError('Workspace not found. Please try again.');
      return;
    }

    if (!fathomApiToken.trim()) {
      setError('Please enter your Fathom API token.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'fathom',
        fathom_api_token: fathomApiToken.trim(),
      });

      // Update connection status
      setCurrentDataSources(prev => 
        prev.map(source => 
          source.id === 'fathom' ? { ...source, connected: true } : source
        )
      );

      setFathomDialogOpen(false);
      setFathomApiToken('');
    } catch (err: any) {
      console.error('Failed to connect Fathom:', err);
      setError(err.response?.data?.detail || 'Failed to connect Fathom. Please check your API token and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Connect your data sources to start analyzing customer feedback. You can skip this step and add them later.
      </Typography>

      <Grid container spacing={2}>
        {currentDataSources.map((source) => (
          <Grid item xs={12} sm={6} key={source.id}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: source.connected ? theme.palette.success.main : alpha(theme.palette.divider, 0.3),
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: source.connected ? theme.palette.success.main : theme.palette.primary.main,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                },
              }}
            >
              <CardActionArea
                onClick={() => !source.connected && handleConnectDataSource(source.id)}
                disabled={source.connected}
                sx={{ p: 2 }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        backgroundColor: alpha(source.color, 0.1),
                        color: source.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {source.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {source.name}
                      </Typography>
                    </Box>
                    {source.connected && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 16 }} />}
                        label="Connected"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {source.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          mt: 3,
          p: 2,
          borderRadius: 2,
          background: alpha(theme.palette.info.main, 0.1),
          border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Tip: You can connect more data sources later from Workspace Settings. Click "Skip" to continue without connecting any sources.
        </Typography>
      </Box>

      {/* Gong Connection Dialog */}
      <Dialog
        open={gongDialogOpen}
        onClose={() => !isConnecting && setGongDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
          🎤 Connect Gong
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your Gong API credentials to connect your account. You can find these in your Gong settings.
          </Typography>
          <TextField
            fullWidth
            label="Access Key"
            value={gongAccessKey}
            onChange={(e) => setGongAccessKey(e.target.value)}
            placeholder="Enter your Gong access key"
            disabled={isConnecting}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Secret Key"
            type="password"
            value={gongSecretKey}
            onChange={(e) => setGongSecretKey(e.target.value)}
            placeholder="Enter your Gong secret key"
            disabled={isConnecting}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setGongDialogOpen(false)}
            disabled={isConnecting}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConnectGong}
            disabled={isConnecting || !gongAccessKey.trim() || !gongSecretKey.trim()}
            startIcon={isConnecting ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              borderRadius: 2,
              px: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fathom Connection Dialog */}
      <Dialog
        open={fathomDialogOpen}
        onClose={() => !isConnecting && setFathomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
          📹 Connect Fathom
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your Fathom API token to connect your account. You can find this in your Fathom settings.
          </Typography>
          <TextField
            fullWidth
            label="API Token"
            type="password"
            value={fathomApiToken}
            onChange={(e) => setFathomApiToken(e.target.value)}
            placeholder="Enter your Fathom API token"
            disabled={isConnecting}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setFathomDialogOpen(false)}
            disabled={isConnecting}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConnectFathom}
            disabled={isConnecting || !fathomApiToken.trim()}
            startIcon={isConnecting ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              borderRadius: 2,
              px: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
