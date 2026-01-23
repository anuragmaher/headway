/**
 * SourcesPage - Data Sync page for managing message syncing from connected sources
 * Displays All Messages and Sync History tabs
 *
 * This page uses modular components from @/shared/components/AllMessagesComponents
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Alert, Snackbar, useTheme } from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';
import { useLayoutStore } from '@/shared/store/layoutStore';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  PageHeader,
  FilterBar,
  MessagesTabContent,
  SyncHistoryTabContent,
  SyncDetailsDrawer,
} from '@/shared/components/AllMessagesComponents';
import { SourceType, SyncType, Message, SyncHistoryItem } from '../shared/types/AllMessagesTypes';
import { useSyncHistoryPolling, useMessages, useInvalidateMessages } from '@/shared/hooks';
import {
  useMessageDetailsStore,
  useAIInsightsStore,
  selectProgressPercent,
  selectIsProcessing,
} from '../shared/store/AllMessagesStore';
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

  // Sorting state for Messages
  const [messagesSortBy, setMessagesSortBy] = useState<MessageSortField>('timestamp');
  const [messagesSortOrder, setMessagesSortOrder] = useState<SortOrder>('desc');
  const [messagesSortAnchorEl, setMessagesSortAnchorEl] = useState<null | HTMLElement>(null);

  // Sorting state for Sync History
  const [syncHistorySortBy, setSyncHistorySortBy] = useState<SyncHistorySortField>('started_at');
  const [syncHistorySortOrder, setSyncHistorySortOrder] = useState<SortOrder>('desc');

  // Use React Query for messages
  const {
    messages: messagesData,
    total: messagesTotal,
    totalPages: messagesTotalPages,
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
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
    ai_insights: msg.ai_insights || null,
  }));

  // Data state for sync history
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
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

  // Polling intervals
  const syncPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const themePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);

  // Message Details Panel state (Zustand store)
  const { isOpen: messageDetailOpen, openPanel: openMessageDetail } = useMessageDetailsStore();

  // AI Insights store
  const { startPolling: startAIInsightsPolling, stopPolling: stopAIInsightsPolling } = useAIInsightsStore();
  const aiInsightsProgress = useAIInsightsStore(selectProgressPercent);
  const aiInsightsIsProcessing = useAIInsightsStore(selectIsProcessing);

  // Cleanup function
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

  // Set header content on mount
  useEffect(() => {
    setHeaderContent(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
        <Box sx={{ fontWeight: 600, fontSize: '1rem' }}>Sources</Box>
      </Box>
    );
    return () => {
      setHeaderContent(null);
      clearPollingIntervals();
    };
  }, [setHeaderContent, clearPollingIntervals]);

  // Start AI insights polling
  useEffect(() => {
    if (workspaceId) {
      startAIInsightsPolling(workspaceId);
    }
    return () => stopAIInsightsPolling();
  }, [workspaceId, startAIInsightsPolling, stopAIInsightsPolling]);

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
      setSyncHistoryTotalPages(response.total_pages);
    } catch (err) {
      console.error('Error fetching sync history:', err);
      setError('Failed to load sync history');
      setSyncHistory([]);
    } finally {
      setLoadingSyncHistory(false);
    }
  }, [workspaceId, syncHistoryPage, selectedSource, selectedType, syncHistorySortBy, syncHistorySortOrder]);

  // Fetch sync history when tab changes
  useEffect(() => {
    if (activeTab === 1) {
      fetchSyncHistory();
    }
  }, [activeTab, fetchSyncHistory]);

  // Reset page when filter changes
  useEffect(() => {
    setMessagesPage(1);
    setSyncHistoryPage(1);
  }, [selectedSource, selectedType]);

  // Auto-refresh sync history
  useSyncHistoryPolling({
    workspaceId: workspaceId || '',
    enabled: activeTab === 1 && !syncingAll && !syncingThemes,
    onNewSync: fetchSyncHistory,
    pollingInterval: 30000,
  });

  // Handlers
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSyncTheme = async () => {
    if (!workspaceId) return;

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
      setActiveTab(1);

      const syncId = response.sync_id;
      let pollCount = 0;
      const maxPolls = 12;

      themePollingIntervalRef.current = setInterval(async () => {
        pollCount++;
        try {
          const syncStatus = await sourcesService.getSyncStatus(workspaceId, syncId);
          setSyncHistory(prev => {
            const updated = prev.map(item =>
              item.id === syncId
                ? { ...item, status: syncStatus.status as SyncHistoryItem['status'], processed: syncStatus.items_processed, newItems: syncStatus.items_new, errorMessage: syncStatus.error_message }
                : item
            );
            if (!updated.some(item => item.id === syncId)) {
              updated.unshift({
                id: syncId,
                type: 'theme',
                name: syncStatus.source_name || 'Theme Sync',
                sourceType: undefined,
                sourceIcons: undefined,
                status: syncStatus.status as SyncHistoryItem['status'],
                triggerType: 'manual',
                startedAt: syncStatus.started_at || new Date().toISOString(),
                processed: syncStatus.items_processed,
                newItems: syncStatus.items_new,
                errorMessage: syncStatus.error_message,
              });
            }
            return updated;
          });

          if (syncStatus.status === 'success' || syncStatus.status === 'failed') {
            if (themePollingIntervalRef.current) {
              clearInterval(themePollingIntervalRef.current);
              themePollingIntervalRef.current = null;
            }
            setSyncingThemes(false);
            invalidateMessages();
            setSnackbarMessage(syncStatus.status === 'success' ? 'Theme sync completed successfully!' : 'Theme sync failed. Check sync history for details.');
            setSnackbarSeverity(syncStatus.status === 'success' ? 'success' : 'error');
            setSnackbarOpen(true);
          }
        } catch (err) {
          console.error('Error polling sync status:', err);
        }

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
      setSnackbarMessage(errorMessage.includes('503') ? 'Background task service not running. Please ensure Celery worker is started.' : 'Failed to start theme sync');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setSyncingThemes(false);
    }
  };

  const handleSyncAllSources = async () => {
    if (!workspaceId) return;

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
        setActiveTab(1);

        const syncIds = response.sync_operations.map(op => op.sync_id);
        let pollCount = 0;
        const maxPolls = 24;

        syncPollingIntervalRef.current = setInterval(async () => {
          pollCount++;
          try {
            const statusPromises = syncIds.map(syncId => sourcesService.getSyncStatus(workspaceId, syncId).catch(() => null));
            const statuses = await Promise.all(statusPromises);

            setSyncHistory(prev => {
              let updated = [...prev];
              statuses.forEach(syncStatus => {
                if (!syncStatus) return;
                const existingIndex = updated.findIndex(item => item.id === syncStatus.sync_id);
                if (existingIndex >= 0) {
                  updated[existingIndex] = { ...updated[existingIndex], status: syncStatus.status as SyncHistoryItem['status'], processed: syncStatus.items_processed, newItems: syncStatus.items_new, errorMessage: syncStatus.error_message };
                } else {
                  updated.unshift({
                    id: syncStatus.sync_id,
                    type: 'source',
                    name: syncStatus.source_name || syncStatus.source_type || 'Source Sync',
                    sourceType: syncStatus.source_type as SourceType | undefined,
                    sourceIcons: undefined,
                    status: syncStatus.status as SyncHistoryItem['status'],
                    triggerType: 'manual',
                    startedAt: syncStatus.started_at || new Date().toISOString(),
                    processed: syncStatus.items_processed,
                    newItems: syncStatus.items_new,
                    errorMessage: syncStatus.error_message,
                  });
                }
              });
              return updated;
            });

            const allCompleted = statuses.every(s => s && (s.status === 'success' || s.status === 'failed'));
            if (allCompleted) {
              if (syncPollingIntervalRef.current) {
                clearInterval(syncPollingIntervalRef.current);
                syncPollingIntervalRef.current = null;
              }
              setSyncingAll(false);
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
      setSnackbarMessage(errorMessage.includes('503') ? 'Background task service not running. Please ensure Celery worker is started.' : 'Failed to start source sync');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setSyncingAll(false);
    }
  };

  const handleMessagesPageChange = (_: React.ChangeEvent<unknown>, page: number) => setMessagesPage(page);
  const handleSyncHistoryPageChange = (_: React.ChangeEvent<unknown>, page: number) => setSyncHistoryPage(page);

  const handleSyncRowClick = (item: SyncHistoryItem) => {
    setSelectedSyncId(item.id);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedSyncId(null);
  };

  const handleMessageClick = (messageId: string) => {
    if (workspaceId) openMessageDetail(messageId, workspaceId);
  };

  const handleMessagesSortMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMessagesSortAnchorEl(event.currentTarget);
  const handleMessagesSortMenuClose = () => setMessagesSortAnchorEl(null);

  const handleMessagesSortChange = (field: MessageSortField) => {
    if (field === messagesSortBy) {
      setMessagesSortOrder(messagesSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setMessagesSortBy(field);
      setMessagesSortOrder('desc');
    }
    setMessagesPage(1);
    handleMessagesSortMenuClose();
  };

  const handleSyncHistorySortChange = (field: SyncHistorySortField) => {
    if (field === syncHistorySortBy) {
      setSyncHistorySortOrder(syncHistorySortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSyncHistorySortBy(field);
      setSyncHistorySortOrder('desc');
    }
    setSyncHistoryPage(1);
  };

  return (
    <AdminLayout>
      <Box sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s ease' }}>
          {/* Header */}
          <PageHeader
            activeTab={activeTab}
            onTabChange={handleTabChange}
            messagesTotal={messagesTotal}
            syncingThemes={syncingThemes}
            syncingAll={syncingAll}
            workspaceId={workspaceId}
            onSyncTheme={handleSyncTheme}
            onSyncAllSources={handleSyncAllSources}
          />

          {/* Filters */}
          <FilterBar
            activeTab={activeTab}
            selectedSource={selectedSource}
            selectedType={selectedType}
            onSourceChange={setSelectedSource}
            onTypeChange={setSelectedType}
            sortBy={messagesSortBy}
            sortOrder={messagesSortOrder}
            sortAnchorEl={messagesSortAnchorEl}
            onSortMenuOpen={handleMessagesSortMenuOpen}
            onSortMenuClose={handleMessagesSortMenuClose}
            onSortChange={handleMessagesSortChange}
            onSortOrderToggle={() => setMessagesSortOrder(messagesSortOrder === 'desc' ? 'asc' : 'desc')}
            aiProgress={aiInsightsProgress}
            aiIsProcessing={aiInsightsIsProcessing}
          />

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mx: 2.5, mt: 1.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Content */}
          {activeTab === 0 ? (
            <MessagesTabContent
              messages={messages}
              loading={loadingMessages}
              fetching={fetchingMessages}
              totalPages={messagesTotalPages}
              currentPage={messagesPage}
              onPageChange={handleMessagesPageChange}
              onMessageClick={handleMessageClick}
              isDetailOpen={messageDetailOpen}
            />
          ) : (
            <SyncHistoryTabContent
              items={syncHistory}
              loading={loadingSyncHistory}
              totalPages={syncHistoryTotalPages}
              currentPage={syncHistoryPage}
              onPageChange={handleSyncHistoryPageChange}
              onRowClick={handleSyncRowClick}
              sortBy={syncHistorySortBy}
              sortOrder={syncHistorySortOrder}
              onSortChange={handleSyncHistorySortChange}
            />
          )}

          {/* Snackbar */}
          <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
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
