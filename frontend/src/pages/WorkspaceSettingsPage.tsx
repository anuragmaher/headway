/**
 * Workspace settings page for managing workspace-wide configurations
 */

import { useState, useEffect } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Snackbar,
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
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useUser, useAuthStore } from '@/features/auth/store/auth-store';
import { slackService, type SlackChannel, type SlackIntegration } from '@/services/slack';
import { connectorService, type ConnectorResponse } from '@/services/connectors';
import { CompanyDetailsForm } from '@/shared/components/CompanyDetailsForm';
import { companyService, type CompanyDetails } from '@/services/company';

interface DataSource {
  id: string;
  name: string;
  type: 'slack' | 'gmail' | 'teams' | 'discord' | 'api';
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  channels?: SlackChannel[];
  userToken?: string;
}

export function WorkspaceSettingsPage(): JSX.Element {
  const user = useUser();
  const theme = useTheme();
  const auth = useAuthStore();
  const [autoSync, setAutoSync] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    dataSources: true,
    preferences: false,
    workspaceInfo: false,
    connectors: false,
    availableConnectors: false,
  });

  // Slack connection dialog state
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackTokens, setSlackTokens] = useState({
    userToken: '',
  });
  const [availableChannels, setAvailableChannels] = useState<SlackChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [connectionStep, setConnectionStep] = useState<'tokens' | 'channels'>('tokens');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slackIntegrations, setSlackIntegrations] = useState<SlackIntegration[]>([]);
  const [teamInfo, setTeamInfo] = useState<{ team_id: string; team_name: string } | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);

  // Connector dialog states
  const [gongDialogOpen, setGongDialogOpen] = useState(false);
  const [fathomDialogOpen, setFathomDialogOpen] = useState(false);
  const [gongAccessKey, setGongAccessKey] = useState('');
  const [gongSecretKey, setGongSecretKey] = useState('');
  const [fathomApiToken, setFathomApiToken] = useState('');
  const [isSavingConnectors, setIsSavingConnectors] = useState(false);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [connectorSuccess, setConnectorSuccess] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorResponse[]>([]);
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(true);

  // Company details state
  const [companyData, setCompanyData] = useState<CompanyDetails>({
    name: '',
    website: '',
    size: '',
    description: '',
  });
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  // Load integrations and connectors on component mount
  useEffect(() => {
    loadSlackIntegrations();
    loadConnectors();
    loadCompanyDetails();
  }, []);

  const loadCompanyDetails = async () => {
    try {
      const workspaceId = auth.tokens?.workspace_id;
      if (!workspaceId) return;

      const details = await companyService.getCompanyDetails(workspaceId);
      setCompanyData(details);
    } catch (error: any) {
      console.error('Failed to load company details:', error);
    }
  };

  const loadSlackIntegrations = async () => {
    try {
      setIsLoadingIntegrations(true);
      const integrations = await slackService.getIntegrations();
      setSlackIntegrations(integrations);
    } catch (error) {
      console.error('Failed to load Slack integrations:', error);
    } finally {
      setIsLoadingIntegrations(false);
    }
  };

  const loadConnectors = async () => {
    try {
      setIsLoadingConnectors(true);
      const workspaceId = auth.tokens?.workspace_id;
      if (!workspaceId) return;

      const loadedConnectors = await connectorService.getConnectors(workspaceId);
      setConnectors(loadedConnectors);

      // Populate form fields with existing connector data
      const gongConnector = loadedConnectors.find(c => c.connector_type === 'gong');
      const fathomConnector = loadedConnectors.find(c => c.connector_type === 'fathom');

      if (gongConnector) {
        setGongAccessKey(gongConnector.gong_access_key || '');
        setGongSecretKey(gongConnector.gong_secret_key || '');
      }
      if (fathomConnector) {
        setFathomApiToken(fathomConnector.fathom_api_token || '');
      }
    } catch (error) {
      console.error('Failed to load connectors:', error);
    } finally {
      setIsLoadingConnectors(false);
    }
  };

  const handleSaveConnectors = async () => {
    if (!user?.workspace_id) return;

    setIsSavingConnectors(true);
    setConnectorError(null);
    setConnectorSuccess(false);

    try {
      // Save Gong connector if credentials are provided
      if (gongAccessKey && gongSecretKey) {
        await connectorService.saveConnector(user.workspace_id, {
          connector_type: 'gong',
          gong_access_key: gongAccessKey,
          gong_secret_key: gongSecretKey,
        });
      }

      // Save Fathom connector if token is provided
      if (fathomApiToken) {
        await connectorService.saveConnector(user.workspace_id, {
          connector_type: 'fathom',
          fathom_api_token: fathomApiToken,
        });
      }

      setConnectorSuccess(true);
      // Reload connectors to refresh the UI
      await loadConnectors();

      // Clear success message after 3 seconds
      setTimeout(() => setConnectorSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save connectors:', error);
      setConnectorError(
        error.response?.data?.detail || 'Failed to save connectors. Please try again.'
      );
    } finally {
      setIsSavingConnectors(false);
    }
  };

  const handleAccordionChange = (section: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: isExpanded,
    }));
  };

  const handleSaveCompanyDetails = async (data: CompanyDetails) => {
    setIsLoadingCompany(true);
    try {
      const workspaceId = auth.tokens?.workspace_id;
      if (!workspaceId) {
        throw new Error('No workspace selected');
      }

      await companyService.updateCompanyDetails(workspaceId, data);
      // Reload the company details from the database to ensure we have the latest data
      await loadCompanyDetails();
    } catch (error: any) {
      console.error('Failed to save company details:', error);
      throw error;
    } finally {
      setIsLoadingCompany(false);
    }
  };

  const handleGenerateDescription = async (websiteUrl: string): Promise<string> => {
    try {
      const workspaceId = auth.tokens?.workspace_id;
      if (!workspaceId) {
        throw new Error('No workspace selected');
      }

      return await companyService.generateDescription(workspaceId, websiteUrl);
    } catch (error: any) {
      console.error('Failed to generate description:', error);
      throw error;
    }
  };

  // Convert SlackIntegrations and Connectors to DataSource format for UI
  const dataSources: DataSource[] = [
    // Slack integrations
    ...slackIntegrations.map(integration => ({
      id: integration.id,
      name: integration.team_name,
      type: 'slack' as const,
      status: integration.status === 'pending' || integration.status === 'connected' ? 'connected' as const : 'disconnected' as const,
      lastSync: integration.last_synced ? 'Just now' : undefined,
      channels: integration.channels
    })),
    // Gong connector
    ...(connectors.some(c => c.connector_type === 'gong') ? [{
      id: connectors.find(c => c.connector_type === 'gong')?.id || 'gong',
      name: '🎤 Gong',
      type: 'gong' as const,
      status: 'connected' as const,
    }] : []),
    // Fathom connector
    ...(connectors.some(c => c.connector_type === 'fathom') ? [{
      id: connectors.find(c => c.connector_type === 'fathom')?.id || 'fathom',
      name: '📹 Fathom',
      type: 'fathom' as const,
      status: 'connected' as const,
    }] : []),
    // Static Gmail entry (placeholder)
    {
      id: 'gmail-placeholder',
      name: 'Gmail Integration',
      type: 'gmail',
      status: 'disconnected'
    }
  ];


  const getConnectorIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'slack': return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.522-2.523h2.52v2.523zM6.313 15.165a2.528 2.528 0 0 1 2.521-2.523 2.528 2.528 0 0 1 2.521 2.523v6.312A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.523v-6.312zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.528 2.528 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
      );
      case 'gmail': return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
        </svg>
      );
      case 'gong': return '🎤';
      case 'fathom': return '📹';
      case 'microsoft teams': return '🟣';
      case 'discord': return '🟦';
      case 'intercom': return '💭';
      case 'zendesk': return '🎫';
      case 'api webhook': return '🔗';
      default: return '🔧';
    }
  };

  // Slack connection handlers
  const handleSlackConnect = () => {
    setSlackDialogOpen(true);
    setConnectionStep('tokens');
    setSlackTokens({ userToken: '' });
    setSelectedChannels([]);
    setAvailableChannels([]);
    setChannelSearch('');
  };

  const handleSlackTokensNext = async () => {
    if (!slackTokens.userToken) {
      return;
    }

    setIsLoadingChannels(true);
    setError(null);

    try {
      const response = await slackService.validateTokensAndGetChannels({
        user_token: slackTokens.userToken,
      });

      setAvailableChannels(response.channels);
      setTeamInfo({ team_id: response.team_id, team_name: response.team_name });
      setConnectionStep('channels');
    } catch (error: any) {
      console.error('Failed to fetch Slack channels:', error);
      setError(error.response?.data?.detail || 'Failed to validate tokens or fetch channels');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else if (prev.length < 5) {
        return [...prev, channelId];
      }
      return prev;
    });
  };

  const handleSlackConnectionComplete = async () => {
    if (selectedChannels.length === 0) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await slackService.connectWorkspace({
        user_token: slackTokens.userToken,
        selected_channels: selectedChannels,
      });

      // Reload integrations to reflect the new connection
      await loadSlackIntegrations();

      setSlackDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to connect Slack:', error);
      setError(error.response?.data?.detail || 'Failed to connect Slack workspace');
    } finally {
      setIsConnecting(false);
    }
  };

  // Gong and Fathom connector handlers
  const handleGongConnect = () => {
    setGongDialogOpen(true);
    setGongAccessKey('');
    setGongSecretKey('');
    setConnectorError(null);
  };

  const handleGongSave = async () => {
    const workspaceId = auth.tokens?.workspace_id;
    if (!workspaceId) {
      setConnectorError('Workspace ID not found. Please refresh the page.');
      return;
    }
    if (!gongAccessKey || !gongSecretKey) {
      setConnectorError('Please enter both Gong Access Key and Secret Key');
      return;
    }

    setIsSavingConnectors(true);
    setConnectorError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'gong',
        gong_access_key: gongAccessKey,
        gong_secret_key: gongSecretKey,
      });

      setConnectorSuccess(true);
      setGongDialogOpen(false);
      await loadConnectors();
      setTimeout(() => setConnectorSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save Gong connector:', error);
      setConnectorError(error.response?.data?.detail || 'Failed to save Gong connector');
    } finally {
      setIsSavingConnectors(false);
    }
  };

  const handleFathomConnect = () => {
    setFathomDialogOpen(true);
    setFathomApiToken('');
    setConnectorError(null);
  };

  const handleFathomSave = async () => {
    const workspaceId = auth.tokens?.workspace_id;
    if (!workspaceId) {
      setConnectorError('Workspace ID not found. Please refresh the page.');
      return;
    }
    if (!fathomApiToken) {
      setConnectorError('Please enter your Fathom API token');
      return;
    }

    setIsSavingConnectors(true);
    setConnectorError(null);

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: 'fathom',
        fathom_api_token: fathomApiToken,
      });

      setConnectorSuccess(true);
      setFathomDialogOpen(false);
      await loadConnectors();
      setTimeout(() => setConnectorSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save Fathom connector:', error);
      setConnectorError(error.response?.data?.detail || 'Failed to save Fathom connector');
    } finally {
      setIsSavingConnectors(false);
    }
  };

  // Filter channels based on search
  const filteredChannels = availableChannels.filter(channel =>
    channel.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
    channel.purpose?.toLowerCase().includes(channelSearch.toLowerCase()) ||
    channel.topic?.toLowerCase().includes(channelSearch.toLowerCase())
  );

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

        {/* Company Details Section */}
        <Box sx={{ mb: 3 }}>
          <CompanyDetailsForm
            companyData={companyData}
            onSave={handleSaveCompanyDetails}
            onGenerateDescription={handleGenerateDescription}
            isLoading={isLoadingCompany}
          />
        </Box>

        <Grid container spacing={2}>
          {/* Connected Data Sources */}
          <Grid item xs={12} lg={8}>
            <Accordion
              expanded={expandedSections.dataSources}
              onChange={handleAccordionChange('dataSources')}
              sx={{
                borderRadius: 1,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: 'none',
                '&:before': { display: 'none' },
                '&.Mui-expanded': {
                  margin: 0,
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  p: 2,
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <DataUsageIcon sx={{ color: theme.palette.success.main, fontSize: 28 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Connected Data Sources
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isLoadingIntegrations ? (
                        'Loading...'
                      ) : (
                        `${dataSources.filter(s => s.status === 'connected').length} active connections`
                      )}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    '&:hover': { transform: 'translateY(-1px)' },
                  }}
                >
                  Add Source
                </Button>
              </AccordionSummary>
              
              <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
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
                    {isLoadingIntegrations ? (
                      'Loading integrations...'
                    ) : (
                      `Integration Progress: ${dataSources.filter(s => s.status === 'connected').length} of ${dataSources.length} sources connected`
                    )}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {isLoadingIntegrations ? (
                    // Shimmer loading state
                    Array.from({ length: 2 }).map((_, index) => (
                      <Box key={`shimmer-${index}`} sx={{
                        p: 2,
                        borderRadius: 1,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        animation: 'pulse 1.5s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 1 },
                          '50%': { opacity: 0.4 },
                          '100%': { opacity: 1 },
                        },
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            background: alpha(theme.palette.grey[500], 0.2),
                          }} />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{
                              height: 20,
                              width: '60%',
                              borderRadius: 1,
                              background: alpha(theme.palette.grey[500], 0.2),
                              mb: 1,
                            }} />
                            <Box sx={{
                              height: 16,
                              width: '40%',
                              borderRadius: 1,
                              background: alpha(theme.palette.grey[500], 0.15),
                            }} />
                          </Box>
                        </Box>
                      </Box>
                    ))
                  ) : (
                    dataSources.map((source) => (
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
{source.type === 'slack' ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.522-2.523h2.52v2.523zM6.313 15.165a2.528 2.528 0 0 1 2.521-2.523 2.528 2.528 0 0 1 2.521 2.523v6.312A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.523v-6.312zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.528 2.528 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                              </svg>
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                              </svg>
                            )}
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
                  ))
                  )}
                </Box>

                {!isLoadingIntegrations && dataSources.length === 0 && (
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
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Workspace Settings Sidebar */}
          <Grid item xs={12} lg={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Preferences */}
              <Accordion
                expanded={expandedSections.preferences}
                onChange={handleAccordionChange('preferences')}
                sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <NotificationsIcon sx={{ color: theme.palette.warning.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Preferences
                    </Typography>
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
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
                </AccordionDetails>
              </Accordion>

              {/* Workspace Information */}
              <Accordion
                expanded={expandedSections.workspaceInfo}
                onChange={handleAccordionChange('workspaceInfo')}
                sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <SecurityIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Workspace Info
                    </Typography>
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
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
                </AccordionDetails>
              </Accordion>

              {/* Connectors Configuration */}
              <Accordion
                id="connectors-config-accordion"
                expanded={expandedSections.connectors}
                onChange={handleAccordionChange('connectors')}
                sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CloudSyncIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Connectors Configuration
                    </Typography>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                  {isLoadingConnectors ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={40} />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      {/* Gong Connector */}
                      <Box sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: theme.palette.primary.main }}>
                          🎤 Gong Credentials
                        </Typography>
                        <TextField
                          label="Access Key"
                          value={gongAccessKey}
                          onChange={(e) => setGongAccessKey(e.target.value)}
                          fullWidth
                          size="small"
                          type="password"
                          placeholder="Enter your Gong access key"
                          sx={{
                            mb: 1.5,
                            '& .MuiOutlinedInput-root': { borderRadius: 1.5 }
                          }}
                        />
                        <TextField
                          label="Secret Key"
                          value={gongSecretKey}
                          onChange={(e) => setGongSecretKey(e.target.value)}
                          fullWidth
                          size="small"
                          type="password"
                          placeholder="Enter your Gong secret key"
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 1.5 }
                          }}
                        />
                      </Box>

                      {/* Fathom Connector */}
                      <Box sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: theme.palette.info.main }}>
                          📹 Fathom Credentials
                        </Typography>
                        <TextField
                          label="API Token"
                          value={fathomApiToken}
                          onChange={(e) => setFathomApiToken(e.target.value)}
                          fullWidth
                          size="small"
                          type="password"
                          placeholder="Enter your Fathom API token"
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: 1.5 }
                          }}
                        />
                      </Box>

                      {/* Error Alert */}
                      {connectorError && (
                        <Alert
                          severity="error"
                          sx={{ borderRadius: 1.5 }}
                          onClose={() => setConnectorError(null)}
                        >
                          {connectorError}
                        </Alert>
                      )}

                      {/* Save Button */}
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleSaveConnectors}
                        disabled={isSavingConnectors || ((!gongAccessKey || !gongSecretKey) && !fathomApiToken)}
                        sx={{
                          borderRadius: 1.5,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                          },
                          '&:disabled': {
                            background: alpha(theme.palette.primary.main, 0.3),
                          },
                        }}
                      >
                        {isSavingConnectors ? (
                          <>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            Saving...
                          </>
                        ) : (
                          'Save Connectors'
                        )}
                      </Button>

                      {/* Configured Connectors Status */}
                      {connectors.length > 0 && (
                        <Box sx={{ pt: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                            CONFIGURED CONNECTORS
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {connectors.map(connector => (
                              <Chip
                                key={connector.id}
                                label={connector.connector_type === 'gong' ? '🎤 Gong' : '📹 Fathom'}
                                size="small"
                                sx={{
                                  bgcolor: connector.connector_type === 'gong'
                                    ? alpha(theme.palette.primary.main, 0.2)
                                    : alpha(theme.palette.info.main, 0.2),
                                  color: connector.connector_type === 'gong'
                                    ? theme.palette.primary.main
                                    : theme.palette.info.main,
                                  fontWeight: 600,
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          </Grid>

          {/* Available Connectors */}
          <Grid item xs={12}>
            <Accordion
              expanded={expandedSections.availableConnectors}
              onChange={handleAccordionChange('availableConnectors')}
              sx={{
                borderRadius: 1,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: 'none',
                '&:before': { display: 'none' },
                '&.Mui-expanded': {
                  margin: 0,
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ p: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              </AccordionSummary>
              
              <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                <Grid container spacing={3}>
                  {[
                    { name: 'Slack', description: 'Monitor channels for feature requests', available: true },
                    { name: 'Gmail', description: 'Track feature requests from customer emails', available: true },
                    { name: 'Gong', description: 'Analyze sales calls and conversations', available: true },
                    { name: 'Fathom', description: 'Track session recordings and user behavior', available: true },
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
                            color: 'white',
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
                            onClick={() => {
                              if (connector.available && connector.name === 'Slack') {
                                handleSlackConnect();
                              } else if (connector.available && connector.name === 'Gong') {
                                handleGongConnect();
                              } else if (connector.available && connector.name === 'Fathom') {
                                handleFathomConnect();
                              }
                            }}
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
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>

        {/* Slack Connection Dialog */}
        <Dialog
          open={slackDialogOpen}
          onClose={() => setSlackDialogOpen(false)}
          maxWidth="lg"
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
              backdropFilter: 'blur(10px)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.522-2.523h2.52v2.523zM6.313 15.165a2.528 2.528 0 0 1 2.521-2.523 2.528 2.528 0 0 1 2.521 2.523v6.312A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.523v-6.312zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.528 2.528 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.528 2.528 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Connect Slack Workspace
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {connectionStep === 'tokens' ? 'Enter your Slack tokens' : `Select channels from ${teamInfo?.team_name || 'your workspace'}`}
                </Typography>
              </Box>
              <IconButton
                onClick={() => setSlackDialogOpen(false)}
                sx={{ ml: 'auto' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {connectionStep === 'tokens' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  To connect your Slack workspace, you'll need your user token. This token allows HeadwayHQ to read messages from your selected channels.
                </Typography>

                <TextField
                  label="User Token (xoxp-...)"
                  value={slackTokens.userToken}
                  onChange={(e) => setSlackTokens(prev => ({ ...prev, userToken: e.target.value }))}
                  fullWidth
                  placeholder="xoxp-your-user-token"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

              </Box>
            )}

            {connectionStep === 'channels' && (
              <Box>
                {isLoadingChannels ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Loading channels from {teamInfo?.team_name}...
                    </Typography>
                  </Box>
                ) : (
                  <>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                      Select up to 5 channels to monitor for feature requests and customer feedback.
                    </Typography>

                    <TextField
                      placeholder="Search channels..."
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      fullWidth
                      size="small"
                      sx={{ 
                        mb: 2,
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.paper, 0.8)
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                            🔍
                          </Box>
                        ),
                      }}
                    />

                    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {filteredChannels.length === 0 ? (
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          py: 4,
                          color: 'text.secondary'
                        }}>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            No channels found
                          </Typography>
                          <Typography variant="caption">
                            Try adjusting your search terms
                          </Typography>
                        </Box>
                      ) : (
                        <List>
                          {filteredChannels.map((channel) => (
                          <ListItem
                            key={channel.id}
                            sx={{
                              borderRadius: 2,
                              mb: 1,
                              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                              background: selectedChannels.includes(channel.id)
                                ? alpha(theme.palette.primary.main, 0.1)
                                : 'transparent',
                            }}
                          >
                            <ListItemIcon>
                              <Checkbox
                                checked={selectedChannels.includes(channel.id)}
                                onChange={() => handleChannelToggle(channel.id)}
                                disabled={!selectedChannels.includes(channel.id) && selectedChannels.length >= 5}
                              />
                            </ListItemIcon>
                            <ListItemIcon>
                              {channel.is_private ? <LockIcon /> : <PublicIcon />}
                            </ListItemIcon>
                            <ListItemText
                              primary={`#${channel.name}`}
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <GroupIcon sx={{ fontSize: 14 }} />
                                  <Typography variant="caption">
                                    {channel.member_count || 0} members
                                  </Typography>
                                  {channel.purpose && (
                                    <Typography variant="caption" sx={{ ml: 1 }}>
                                      • {channel.purpose}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Selected: {selectedChannels.length}/5 channels
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Showing {filteredChannels.length} of {availableChannels.length} channels
                      </Typography>
                    </Box>
                  </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={() => setSlackDialogOpen(false)}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            
            {connectionStep === 'tokens' ? (
              <Button
                variant="contained"
                onClick={handleSlackTokensNext}
                disabled={!slackTokens.userToken || isLoadingChannels}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                }}
              >
                {isLoadingChannels ? <CircularProgress size={20} /> : 'Next'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSlackConnectionComplete}
                disabled={selectedChannels.length === 0 || isConnecting}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100())`,
                }}
              >
                {isConnecting ? <CircularProgress size={20} /> : 'Connect'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Gong Connector Dialog */}
        <Dialog
          open={gongDialogOpen}
          onClose={() => setGongDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.3rem', pb: 1 }}>
            🎤 Connect Gong
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your Gong API credentials to connect your account
            </Typography>
            {connectorError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                {connectorError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Access Key"
              value={gongAccessKey}
              onChange={(e) => setGongAccessKey(e.target.value)}
              placeholder="Enter your Gong access key"
              margin="normal"
              type="password"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              fullWidth
              label="Secret Key"
              value={gongSecretKey}
              onChange={(e) => setGongSecretKey(e.target.value)}
              placeholder="Enter your Gong secret key"
              margin="normal"
              type="password"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button onClick={() => setGongDialogOpen(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleGongSave}
              disabled={isSavingConnectors || !gongAccessKey || !gongSecretKey}
              sx={{
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              }}
            >
              {isSavingConnectors ? <CircularProgress size={20} /> : 'Connect'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Fathom Connector Dialog */}
        <Dialog
          open={fathomDialogOpen}
          onClose={() => setFathomDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.3rem', pb: 1 }}>
            📹 Connect Fathom
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your Fathom API credentials to connect your account
            </Typography>
            {connectorError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                {connectorError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="API Token"
              value={fathomApiToken}
              onChange={(e) => setFathomApiToken(e.target.value)}
              placeholder="Enter your Fathom API token"
              margin="normal"
              type="password"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button onClick={() => setFathomDialogOpen(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleFathomSave}
              disabled={isSavingConnectors || !fathomApiToken}
              sx={{
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
              }}
            >
              {isSavingConnectors ? <CircularProgress size={20} /> : 'Connect'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        </Snackbar>

        {/* Success Snackbar for Connectors */}
        <Snackbar
          open={connectorSuccess}
          autoHideDuration={4000}
          onClose={() => setConnectorSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setConnectorSuccess(false)} severity="success" sx={{ borderRadius: 2 }}>
            Connectors saved successfully!
          </Alert>
        </Snackbar>
      </Box>
    </AdminLayout>
  );
}