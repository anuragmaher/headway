/**
 * DataSourcesStep Component
 * Step 3: Connect data sources
 * Clean design for split-layout onboarding
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Check as CheckIcon,
  Email as EmailIcon,
  RecordVoiceOver as GongIcon,
  VideoCall as FathomIcon,
  Forum as SlackIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { connectGmail, getGmailAccounts } from '@/services/gmail';
import { connectorService } from '@/services/connectors';
import {
  useConnectedSources,
  useOnboardingStore,
} from '../../store/onboardingStore';

interface SourceConfig {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  color: string;
  category: 'sales' | 'messaging';
}

const SOURCES: SourceConfig[] = [
  { id: 'gong', name: 'Gong', description: 'Sales call transcripts', icon: <GongIcon />, color: '#7C3AED', category: 'sales' },
  { id: 'fathom', name: 'Fathom', description: 'Meeting insights', icon: <FathomIcon />, color: '#059669', category: 'sales' },
  { id: 'gmail', name: 'Gmail', description: 'Customer emails', icon: <EmailIcon />, color: '#EA4335', category: 'messaging' },
  { id: 'slack', name: 'Slack', description: 'Shared channels', icon: <SlackIcon />, color: '#4A154B', category: 'messaging' },
];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: 1.5,
    '& fieldset': {
      borderColor: '#e2e8f0',
    },
    '&:hover fieldset': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2563eb',
      borderWidth: 2,
    },
  },
};

export function DataSourcesStep(): JSX.Element {
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = tokens?.workspace_id;

  const connectedSources = useConnectedSources();
  const { setConnectedSources, loadConnectedSources } = useOnboardingStore();

  const [gongDialogOpen, setGongDialogOpen] = useState(false);
  const [fathomDialogOpen, setFathomDialogOpen] = useState(false);
  const [gongAccessKey, setGongAccessKey] = useState('');
  const [gongSecretKey, setGongSecretKey] = useState('');
  const [fathomApiToken, setFathomApiToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Helper to check if a source type is connected
  const isSourceConnected = (sourceType: string): boolean => {
    return connectedSources.some((c) => c.connector_type === sourceType);
  };

  useEffect(() => {
    if (workspaceId) {
      loadConnectedSources(workspaceId);
    }
  }, [workspaceId, loadConnectedSources]);

  const handleConnect = async (sourceId: string) => {
    setConnectError(null);

    if (sourceId === 'gmail') {
      try {
        localStorage.setItem('onboarding-gmail-connect', 'true');
        const { auth_url } = await connectGmail();
        const oauthWindow = window.open(auth_url, 'gmail-oauth', 'width=500,height=600');

        if (!oauthWindow) {
          setConnectError('Please allow popups to connect Gmail.');
          return;
        }

        const checkInterval = setInterval(async () => {
          if (oauthWindow?.closed) {
            clearInterval(checkInterval);
            localStorage.removeItem('onboarding-gmail-connect');
            // Reload connected sources after OAuth completes
            if (workspaceId) {
              loadConnectedSources(workspaceId);
            }
          }
        }, 1000);
      } catch {
        setConnectError('Failed to start Gmail connection.');
        localStorage.removeItem('onboarding-gmail-connect');
      }
    } else if (sourceId === 'slack') {
      setConnectError('Connect Slack from Settings after onboarding.');
    } else if (sourceId === 'gong') {
      setGongDialogOpen(true);
    } else if (sourceId === 'fathom') {
      setFathomDialogOpen(true);
    }
  };

  const handleConnectGong = async () => {
    if (!workspaceId) return;
    setIsConnecting(true);
    setConnectError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'gong',
        gong_access_key: gongAccessKey.trim(),
        gong_secret_key: gongSecretKey.trim(),
      });
      // Reload connected sources from server
      await loadConnectedSources(workspaceId);
      setGongDialogOpen(false);
      setGongAccessKey('');
      setGongSecretKey('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setConnectError(error.response?.data?.detail || 'Failed to connect Gong.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectFathom = async () => {
    if (!workspaceId) return;
    setIsConnecting(true);
    setConnectError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'fathom',
        fathom_api_token: fathomApiToken.trim(),
      });
      // Reload connected sources from server
      await loadConnectedSources(workspaceId);
      setFathomDialogOpen(false);
      setFathomApiToken('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setConnectError(error.response?.data?.detail || 'Failed to connect Fathom.');
    } finally {
      setIsConnecting(false);
    }
  };

  const salesSources = SOURCES.filter((s) => s.category === 'sales');
  const messagingSources = SOURCES.filter((s) => s.category === 'messaging');

  const renderSource = (source: SourceConfig) => {
    const isConnected = isSourceConnected(source.id);

    return (
      <Box
        key={source.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'white',
          border: '1px solid',
          borderColor: isConnected ? '#22c55e' : '#e2e8f0',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: isConnected ? '#22c55e' : '#cbd5e1',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: `${source.color}10`,
            color: source.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            '& svg': { fontSize: 20 },
          }}
        >
          {source.icon}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8125rem' }}>
            {source.name}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
            {source.description}
          </Typography>
        </Box>

        {isConnected ? (
          <Chip
            size="small"
            icon={<CheckIcon sx={{ fontSize: '0.875rem !important' }} />}
            label="Connected"
            sx={{
              bgcolor: '#dcfce7',
              color: '#166534',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              '& .MuiChip-icon': {
                color: '#166534',
              },
            }}
          />
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleConnect(source.id)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#e2e8f0',
              color: '#1e293b',
              borderRadius: 1,
              px: 2,
              fontSize: '0.75rem',
              '&:hover': {
                borderColor: '#2563eb',
                bgcolor: '#f8fafc',
              },
            }}
          >
            Connect
          </Button>
        )}
      </Box>
    );
  };

  return (
    <Box>
      {connectError && (
        <Box
          sx={{
            mb: 2,
            px: 2,
            py: 1.5,
            borderRadius: 1.5,
            bgcolor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.8125rem',
          }}
        >
          {connectError}
        </Box>
      )}

      <Typography
        variant="subtitle2"
        sx={{
          color: '#64748b',
          fontWeight: 600,
          mb: 1.5,
          textTransform: 'uppercase',
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
        }}
      >
        Sales & CS Calls
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
        {salesSources.map(renderSource)}
      </Box>

      <Typography
        variant="subtitle2"
        sx={{
          color: '#64748b',
          fontWeight: 600,
          mb: 1.5,
          textTransform: 'uppercase',
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
        }}
      >
        Email & Messaging
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
        {messagingSources.map(renderSource)}
      </Box>

      {/* Gong Dialog */}
      <Dialog
        open={gongDialogOpen}
        onClose={() => !isConnecting && setGongDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#1e293b' }}>Connect Gong</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 3 }}>
            Enter your Gong API credentials from Gong settings.
          </Typography>
          <TextField
            fullWidth
            label="Access Key"
            value={gongAccessKey}
            onChange={(e) => setGongAccessKey(e.target.value)}
            disabled={isConnecting}
            sx={{ ...inputSx, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Secret Key"
            type="password"
            value={gongSecretKey}
            onChange={(e) => setGongSecretKey(e.target.value)}
            disabled={isConnecting}
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setGongDialogOpen(false)}
            disabled={isConnecting}
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConnectGong}
            disabled={isConnecting || !gongAccessKey.trim() || !gongSecretKey.trim()}
            sx={{
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            {isConnecting ? <CircularProgress size={20} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fathom Dialog */}
      <Dialog
        open={fathomDialogOpen}
        onClose={() => !isConnecting && setFathomDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#1e293b' }}>Connect Fathom</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 3 }}>
            Enter your Fathom API token from Fathom settings.
          </Typography>
          <TextField
            fullWidth
            label="API Token"
            type="password"
            value={fathomApiToken}
            onChange={(e) => setFathomApiToken(e.target.value)}
            disabled={isConnecting}
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setFathomDialogOpen(false)}
            disabled={isConnecting}
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConnectFathom}
            disabled={isConnecting || !fathomApiToken.trim()}
            sx={{
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            {isConnecting ? <CircularProgress size={20} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
