/**
 * SourcesPage - Data Sync page for managing message syncing from connected sources
 * Displays All Messages and Sync History tabs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  alpha,
  useTheme,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  Snackbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Sync as SyncIcon,
  AutoAwesome as ThemeSyncIcon,
  ChatBubbleOutline as MessagesIcon,
  History as HistoryIcon,
  Sort as SortIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Source as SourceIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { MessageList, SyncHistoryTable, SourceFilters, TypeFilters, SyncDetailsDrawer, MessageDetailPanel } from './components';
import { SourceType, SyncType, Message, SyncHistoryItem } from './types';
import { useSyncHistoryPolling, useMessages, useInvalidateMessages } from './hooks';
import { useMessageDetailsStore } from './store';
import sourcesService, {
  SyncHistoryListResponse,
  MessageSortField,
  SyncHistorySortField,
  SortOrder,
} from '@/services/sources';

export function SourcesPage(): JSX.Element {
  const theme = useTheme();
  const setHeaderContent = useLayoutStore((state) => state.setHeaderContent);
  const { tokens } = useAuthStore();
  const workspaceId = tokens?.workspace_id;

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Filter states
  const [selectedSource, setSelectedSource] = useState<SourceType>('all');
  const [selectedType, setSelectedType] = useState<SyncType>('all');

  // Pagination state
  const [messagesPage, setMessagesPage] = useState(1);
  const [syncHistoryPage, setSyncHistoryPage] = useState(1);
  const messagesPageSize = 10;
  const syncHistoryPageSize = 10;

  // Sorting state for Messages (moved up for hook dependency)
  const [messagesSortBy, setMessagesSortBy] = useState<MessageSortField>('timestamp');
  const [messagesSortOrder, setMessagesSortOrder] = useState<SortOrder>('desc');
  const [messagesSortAnchorEl, setMessagesSortAnchorEl] = useState<null | HTMLElement>(null);

  // Use React Query for messages - provides caching, prefetching, and deduplication
  const {
    messages: messagesData,
    total: messagesTotal,
    totalPages: messagesTotalPages,
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    refetch: refetchMessages,
  } = useMessages({
    workspaceId,
    page: messagesPage,
    pageSize: messagesPageSize,
    source: selectedSource,
    sortBy: messagesSortBy,
    sortOrder: messagesSortOrder,
    enabled: activeTab === 0,
  });

  // Invalidate messages cache hook
  const invalidateMessages = useInvalidateMessages();

  // Transform API messages to frontend format
  const messages: Message[] = messagesData.map((msg) => ({
    id: msg.id,
    title: msg.title || 'Untitled',
    sender: msg.sender || msg.sender_email || 'Unknown',
    sourceType: msg.source_type as Message['sourceType'],
    preview: msg.preview || '',
    timestamp: msg.timestamp,
    source: msg.source as SourceType,
  }));

  // Data state for sync history (not using React Query for now)
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [syncHistoryTotal, setSyncHistoryTotal] = useState(0);
  const [syncHistoryTotalPages, setSyncHistoryTotalPages] = useState(1);

  // Loading states
  const [loadingSyncHistory, setLoadingSyncHistory] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingThemes, setSyncingThemes] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Polling intervals - store refs to clean them up properly
  const syncPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const themePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync Details Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);

  // Message Details Panel state (Zustand store)
  const { isOpen: messageDetailOpen, openPanel: openMessageDetail, closePanel: closeMessageDetail } = useMessageDetailsStore();

  // Sorting state for Sync History
  const [syncHistorySortBy, setSyncHistorySortBy] = useState<SyncHistorySortField>('started_at');
  const [syncHistorySortOrder, setSyncHistorySortOrder] = useState<SortOrder>('desc');

  // Cleanup function to clear polling intervals
  const clearPollingIntervals = useCallback(() => {
    if (syncPollingIntervalRef.current) {
      clearInterval(syncPollingIntervalRef.current);
      syncPollingIntervalRef.current = null;
    }
    if (themePollingIntervalRef.current) {
      clearInterval(themePollingIntervalRef.current);
      themePollingIntervalRef.current = null;
    }
  }, []);

  // Set custom header content on mount
  useEffect(() => {
    setHeaderContent(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }} noWrap>
          Sources
        </Typography>
      </Box>
    );
    return () => {
      setHeaderContent(null);
      clearPollingIntervals(); // Clean up intervals on unmount
    };
  }, [setHeaderContent, clearPollingIntervals]);

  // Fetch sync history
  const fetchSyncHistory = useCallback(async () => {
    if (!workspaceId) return;

    setLoadingSyncHistory(true);
    setError(null);

    try {
      const response: SyncHistoryListResponse = await sourcesService.getSyncHistory(
        workspaceId,
        syncHistoryPage,
        syncHistoryPageSize,
        selectedSource !== 'all' ? selectedSource : undefined,
        selectedType !== 'all' ? selectedType : undefined,
        syncHistorySortBy,
        syncHistorySortOrder
      );

      // Transform API response to frontend types
      const transformedHistory: SyncHistoryItem[] = response.items.map((item) => ({
        id: item.id,
        type: item.sync_type as 'source' | 'theme',
        name: item.sync_type === 'source' ? (item.source_name || item.source_type || 'Unknown') : (item.theme_name || 'Unknown'),
        sourceType: item.source_type as SourceType | undefined,
        sourceIcons: item.theme_sources as SourceType[] | undefined,
        status: item.status as SyncHistoryItem['status'],
        triggerType: (item.trigger_type as SyncHistoryItem['triggerType']) || 'manual',
        startedAt: item.started_at,
        processed: item.items_processed,
        newItems: item.items_new,
        errorMessage: item.error_message,
      }));

      setSyncHistory(transformedHistory);
      setSyncHistoryTotal(response.total);
      setSyncHistoryTotalPages(response.total_pages);
    } catch (err) {
      console.error('Error fetching sync history:', err);
      setError('Failed to load sync history');
      setSyncHistory([]);
    } finally {
      setLoadingSyncHistory(false);
    }
  }, [workspaceId, syncHistoryPage, selectedSource, selectedType, syncHistorySortBy, syncHistorySortOrder]);

  // Fetch sync history when tab changes (messages handled by React Query)
  useEffect(() => {
    if (activeTab === 1) {
      fetchSyncHistory();
    }
  }, [activeTab, fetchSyncHistory]);

  // Reset page when source filter changes
  useEffect(() => {
    setMessagesPage(1);
    setSyncHistoryPage(1);
  }, [selectedSource, selectedType]);

  // Auto-refresh sync history when Celery runs scheduled syncs (every 15 min)
  // Only poll when on Sync History tab and not manually syncing
  useSyncHistoryPolling({
    workspaceId: workspaceId || '',
    enabled: activeTab === 1 && !syncingAll && !syncingThemes,
    onNewSync: fetchSyncHistory,
    pollingInterval: 30000, // Check every 30 seconds
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSyncTheme = async () => {
    if (!workspaceId) return;

    // Clear any existing theme polling interval
    if (themePollingIntervalRef.current) {
      clearInterval(themePollingIntervalRef.current);
      themePollingIntervalRef.current = null;
    }

    setSyncingThemes(true);
    try {
      const response = await sourcesService.syncThemes(workspaceId);
      setSnackbarMessage(`${response.message} - Tasks queued for background processing`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Switch to Sync History tab to show progress
      setActiveTab(1);

      // Track the sync ID for polling
      const syncId = response.sync_id;

      // Poll the specific sync operation status instead of reloading entire history
      let pollCount = 0;
      const maxPolls = 12; // 12 polls * 5 seconds = 60 seconds max

      themePollingIntervalRef.current = setInterval(async () => {
        pollCount++;

        try {
          const syncStatus = await sourcesService.getSyncStatus(workspaceId, syncId);

          // Update the specific item in sync history without full reload
          setSyncHistory(prevHistory => {
            const updated = prevHistory.map(item => {
              if (item.id === syncId) {
                return {
                  ...item,
                  status: syncStatus.status as SyncHistoryItem['status'],
                  processed: syncStatus.items_processed,
                  newItems: syncStatus.items_new,
                  errorMessage: syncStatus.error_message,
                };
              }
              return item;
            });

            // If item doesn't exist, add it to the front
            if (!updated.some(item => item.id === syncId)) {
              updated.unshift({
                id: syncId,
                type: 'theme',
                name: syncStatus.source_name || 'Theme Sync',
                sourceType: undefined,
                sourceIcons: undefined,
                status: syncStatus.status as SyncHistoryItem['status'],
                triggerType: 'manual',  // User-initiated theme sync
                startedAt: syncStatus.started_at || new Date().toISOString(),
                processed: syncStatus.items_processed,
                newItems: syncStatus.items_new,
                errorMessage: syncStatus.error_message,
              });
            }

            return updated;
          });

          // Stop polling if completed or failed
          if (syncStatus.status === 'success' || syncStatus.status === 'failed') {
            if (themePollingIntervalRef.current) {
              clearInterval(themePollingIntervalRef.current);
              themePollingIntervalRef.current = null;
            }
            setSyncingThemes(false);

            // Invalidate messages cache to refresh with new data
            invalidateMessages();

            if (syncStatus.status === 'success') {
              setSnackbarMessage('Theme sync completed successfully!');
              setSnackbarSeverity('success');
            } else {
              setSnackbarMessage('Theme sync failed. Check sync history for details.');
              setSnackbarSeverity('error');
            }
            setSnackbarOpen(true);
          }
        } catch (err) {
          console.error('Error polling sync status:', err);
        }

        // Stop after max polls
        if (pollCount >= maxPolls) {
          if (themePollingIntervalRef.current) {
            clearInterval(themePollingIntervalRef.current);
            themePollingIntervalRef.current = null;
          }
          setSyncingThemes(false);
        }
      }, 5000);

    } catch (err: unknown) {
      console.error('Error syncing themes:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start theme sync';
      // Check if it's a Celery not running error
      if (errorMessage.includes('503') || errorMessage.includes('service not available')) {
        setSnackbarMessage('Background task service not running. Please ensure Celery worker is started.');
      } else {
        setSnackbarMessage('Failed to start theme sync');
      }
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setSyncingThemes(false);
    }
  };

  const handleSyncAllSources = async () => {
    if (!workspaceId) return;

    // Clear any existing sync polling interval
    if (syncPollingIntervalRef.current) {
      clearInterval(syncPollingIntervalRef.current);
      syncPollingIntervalRef.current = null;
    }

    setSyncingAll(true);
    try {
      const response = await sourcesService.syncAllSources(workspaceId);

      if (response.total_sources === 0) {
        setSnackbarMessage('No connected data sources found. Please connect a data source first.');
        setSnackbarSeverity('error');
        setSyncingAll(false);
      } else {
        setSnackbarMessage(`${response.message} - Tasks queued for background processing`);
        setSnackbarSeverity('success');

        // Switch to Sync History tab to show progress
        setActiveTab(1);

        // Track all sync IDs for polling
        const syncIds = response.sync_operations.map(op => op.sync_id);

        // Poll the specific sync operations status instead of reloading entire history
        let pollCount = 0;
        const maxPolls = 24; // 24 polls * 5 seconds = 120 seconds max

        syncPollingIntervalRef.current = setInterval(async () => {
          pollCount++;

          try {
            // Fetch status for all sync operations
            const statusPromises = syncIds.map(syncId =>
              sourcesService.getSyncStatus(workspaceId, syncId).catch(() => null)
            );
            const statuses = await Promise.all(statusPromises);

            // Update sync history with new statuses
            setSyncHistory(prevHistory => {
              let updated = [...prevHistory];

              statuses.forEach(syncStatus => {
                if (!syncStatus) return;

                const existingIndex = updated.findIndex(item => item.id === syncStatus.sync_id);

                if (existingIndex >= 0) {
                  // Update existing item
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    status: syncStatus.status as SyncHistoryItem['status'],
                    processed: syncStatus.items_processed,
                    newItems: syncStatus.items_new,
                    errorMessage: syncStatus.error_message,
                  };
                } else {
                  // Add new item to the front
                  updated.unshift({
                    id: syncStatus.sync_id,
                    type: 'source',
                    name: syncStatus.source_name || syncStatus.source_type || 'Source Sync',
                    sourceType: syncStatus.source_type as SourceType | undefined,
                    sourceIcons: undefined,
                    status: syncStatus.status as SyncHistoryItem['status'],
                    triggerType: 'manual',  // User-initiated source sync
                    startedAt: syncStatus.started_at || new Date().toISOString(),
                    processed: syncStatus.items_processed,
                    newItems: syncStatus.items_new,
                    errorMessage: syncStatus.error_message,
                  });
                }
              });

              return updated;
            });

            // Check if all syncs are completed
            const allCompleted = statuses.every(
              s => s && (s.status === 'success' || s.status === 'failed')
            );

            if (allCompleted) {
              if (syncPollingIntervalRef.current) {
                clearInterval(syncPollingIntervalRef.current);
                syncPollingIntervalRef.current = null;
              }
              setSyncingAll(false);

              // Invalidate messages cache to refresh with new data
              invalidateMessages();

              const successCount = statuses.filter(s => s?.status === 'success').length;
              const failedCount = statuses.filter(s => s?.status === 'failed').length;

              if (failedCount === 0) {
                setSnackbarMessage(`All ${successCount} source syncs completed successfully!`);
                setSnackbarSeverity('success');
              } else if (successCount === 0) {
                setSnackbarMessage(`All ${failedCount} source syncs failed. Check sync history for details.`);
                setSnackbarSeverity('error');
              } else {
                setSnackbarMessage(`${successCount} succeeded, ${failedCount} failed. Check sync history for details.`);
                setSnackbarSeverity('error');
              }
              setSnackbarOpen(true);
            }
          } catch (err) {
            console.error('Error polling sync statuses:', err);
          }

          // Stop after max polls
          if (pollCount >= maxPolls) {
            if (syncPollingIntervalRef.current) {
              clearInterval(syncPollingIntervalRef.current);
              syncPollingIntervalRef.current = null;
            }
            setSyncingAll(false);
          }
        }, 5000);
      }

      setSnackbarOpen(true);

    } catch (err: unknown) {
      console.error('Error syncing sources:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start source sync';
      // Check if it's a Celery not running error
      if (errorMessage.includes('503') || errorMessage.includes('service not available')) {
        setSnackbarMessage('Background task service not running. Please ensure Celery worker is started.');
      } else {
        setSnackbarMessage('Failed to start source sync');
      }
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setSyncingAll(false);
    }
  };

  const handleMessagesPageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setMessagesPage(page);
  };

  const handleSyncHistoryPageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setSyncHistoryPage(page);
  };

  const handleSyncRowClick = (item: SyncHistoryItem) => {
    setSelectedSyncId(item.id);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedSyncId(null);
  };

  // Message click handler - opens split-screen panel
  const handleMessageClick = (messageId: string) => {
    if (workspaceId) {
      openMessageDetail(messageId, workspaceId);
    }
  };

  // Sorting handlers for Messages
  const handleMessagesSortMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMessagesSortAnchorEl(event.currentTarget);
  };

  const handleMessagesSortMenuClose = () => {
    setMessagesSortAnchorEl(null);
  };

  const handleMessagesSortChange = (field: MessageSortField) => {
    if (field === messagesSortBy) {
      // Toggle order if same field
      setMessagesSortOrder(messagesSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setMessagesSortBy(field);
      setMessagesSortOrder('desc');
    }
    setMessagesPage(1);
    handleMessagesSortMenuClose();
  };

  // Sorting handler for Sync History
  const handleSyncHistorySortChange = (field: SyncHistorySortField) => {
    if (field === syncHistorySortBy) {
      // Toggle order if same field
      setSyncHistorySortOrder(syncHistorySortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSyncHistorySortBy(field);
      setSyncHistorySortOrder('desc');
    }
    setSyncHistoryPage(1);
  };

  // Get sort label for display
  const getMessagesSortLabel = () => {
    const labels: Record<MessageSortField, string> = {
      timestamp: 'Date',
      sender: 'Sender',
      source: 'Source',
    };
    return labels[messagesSortBy];
  };

  return (
    <AdminLayout>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Main Content Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
        {/* Header with Tabs and Actions */}
        <Box
          sx={{
            px: 2.5,
            pt: 1.5,
            pb: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': {
                height: 2,
                borderRadius: '2px 2px 0 0',
              },
            }}
          >
            <Tab
              icon={<MessagesIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>All Messages</span>
                  <Chip
                    label={messagesTotal}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                </Box>
              }
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                minHeight: 40,
                py: 1,
                px: 1.5,
                minWidth: 'auto',
                gap: 0.5,
              }}
            />
            <Tab
              icon={<HistoryIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label="Sync History"
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                minHeight: 40,
                py: 1,
                px: 1.5,
                minWidth: 'auto',
                gap: 0.5,
              }}
            />
          </Tabs>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={syncingThemes ? <CircularProgress size={14} /> : <ThemeSyncIcon sx={{ fontSize: 16 }} />}
              onClick={handleSyncTheme}
              disabled={syncingThemes || !workspaceId}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                borderRadius: 1.5,
                px: 1.5,
                py: 0.5,
                borderColor: alpha(theme.palette.divider, 0.3),
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              {syncingThemes ? 'Syncing...' : 'Sync Theme'}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={syncingAll ? <CircularProgress size={14} color="inherit" /> : <MessagesIcon sx={{ fontSize: 16 }} />}
              onClick={handleSyncAllSources}
              disabled={syncingAll || !workspaceId}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                borderRadius: 1.5,
                px: 1.5,
                py: 0.5,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              }}
            >
              {syncingAll ? 'Syncing...' : 'Sync All Sources'}
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            px: 2.5,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <SourceFilters
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeTab === 1 && (
              <TypeFilters
                selectedType={selectedType}
                onTypeChange={setSelectedType}
              />
            )}

            {/* Sort button for Messages tab */}
            {activeTab === 0 && (
              <>
                <Tooltip title="Sort messages">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SortIcon sx={{ fontSize: 16 }} />}
                    endIcon={messagesSortOrder === 'desc' ? <DescIcon sx={{ fontSize: 14 }} /> : <AscIcon sx={{ fontSize: 14 }} />}
                    onClick={handleMessagesSortMenuOpen}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      borderRadius: 1.5,
                      px: 1.25,
                      py: 0.5,
                      borderColor: alpha(theme.palette.divider, 0.3),
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    {getMessagesSortLabel()}
                  </Button>
                </Tooltip>
                <Menu
                  anchorEl={messagesSortAnchorEl}
                  open={Boolean(messagesSortAnchorEl)}
                  onClose={handleMessagesSortMenuClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  PaperProps={{
                    sx: {
                      minWidth: 180,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      borderRadius: 2,
                    },
                  }}
                >
                  <MenuItem
                    onClick={() => handleMessagesSortChange('timestamp')}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    <ListItemIcon>
                      <TimeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Date</ListItemText>
                    {messagesSortBy === 'timestamp' && (
                      <CheckIcon fontSize="small" color="primary" />
                    )}
                  </MenuItem>
                  <MenuItem
                    onClick={() => handleMessagesSortChange('sender')}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    <ListItemIcon>
                      <PersonIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Sender</ListItemText>
                    {messagesSortBy === 'sender' && (
                      <CheckIcon fontSize="small" color="primary" />
                    )}
                  </MenuItem>
                  <MenuItem
                    onClick={() => handleMessagesSortChange('source')}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    <ListItemIcon>
                      <SourceIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Source</ListItemText>
                    {messagesSortBy === 'source' && (
                      <CheckIcon fontSize="small" color="primary" />
                    )}
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={() => setMessagesSortOrder(messagesSortOrder === 'desc' ? 'asc' : 'desc')}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    <ListItemIcon>
                      {messagesSortOrder === 'desc' ? <DescIcon fontSize="small" /> : <AscIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>
                      {messagesSortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                    </ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mt: 1.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Content Area - Split Screen for Messages tab */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            bgcolor: theme.palette.background.default,
            position: 'relative',
          }}
        >
          {/* Left Panel - Message List */}
          <Box
            sx={{
              width: messageDetailOpen && activeTab === 0 ? '50%' : '100%',
              overflow: 'hidden',
              minWidth: 0,
              pl: 2.5,
              pr: messageDetailOpen && activeTab === 0 ? 0 : 2.5,
              py: 1.5,
              transition: 'width 0.25s ease-out, padding-right 0.25s ease-out',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                bgcolor: theme.palette.background.paper,
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {activeTab === 0 ? (
                loadingMessages && messages.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading messages...
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      position: 'relative',
                      flex: 1,
                      overflow: 'auto',
                      // Hide scrollbar but keep scrollable
                      scrollbarWidth: 'none', // Firefox
                      msOverflowStyle: 'none', // IE
                      '&::-webkit-scrollbar': { display: 'none' }, // Chrome, Safari
                    }}
                  >
                    {/* Show subtle indicator while refreshing */}
                    {fetchingMessages && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          bgcolor: 'primary.main',
                          opacity: 0.6,
                          zIndex: 1,
                          animation: 'pulse 1.5s ease-in-out infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 0.3 },
                            '50%': { opacity: 0.7 },
                          },
                        }}
                      />
                    )}
                    <MessageList messages={messages} onMessageClick={handleMessageClick} />
                  </Box>
                )
              ) : (
                loadingSyncHistory ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading sync history...
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      '&::-webkit-scrollbar': { display: 'none' },
                    }}
                  >
                    <SyncHistoryTable
                      items={syncHistory}
                      onRowClick={handleSyncRowClick}
                      sortBy={syncHistorySortBy}
                      sortOrder={syncHistorySortOrder}
                      onSortChange={handleSyncHistorySortChange}
                    />
                  </Box>
                )
              )}

              {/* Pagination - Inside Paper */}
              {activeTab === 0 && messagesTotalPages > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 1.5,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                  }}
                >
                  <Pagination
                    count={messagesTotalPages}
                    page={messagesPage}
                    onChange={handleMessagesPageChange}
                    size="small"
                    color="primary"
                  />
                </Box>
              )}
              {activeTab === 1 && syncHistoryTotalPages > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 1.5,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                  }}
                >
                  <Pagination
                    count={syncHistoryTotalPages}
                    page={syncHistoryPage}
                    onChange={handleSyncHistoryPageChange}
                    size="small"
                    color="primary"
                  />
                </Box>
              )}
            </Paper>
          </Box>

          {/* Right Panel - Message Detail Split-Screen */}
          {activeTab === 0 && <MessageDetailPanel />}
        </Box>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
        </Box>
      </Box>

      {/* Sync Details Drawer */}
      {workspaceId && (
        <SyncDetailsDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          syncId={selectedSyncId}
          workspaceId={workspaceId}
        />
      )}
    </AdminLayout>
  );
}

export default SourcesPage;
