/**
 * Sources API Service
 * Handles all API calls related to data sources and sync operations
 */

import api from './api';

// ============ Types ============

export interface Message {
  id: string;
  title: string | null;
  sender: string | null;
  sender_email: string | null;
  source_type: string;
  source: string;
  preview: string | null;
  content: string | null;
  timestamp: string;
  channel_name: string | null;
  is_processed: boolean;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SyncHistoryItem {
  id: string;
  sync_type: 'source' | 'theme';
  source_type: string | null;
  source_name: string | null;
  theme_name: string | null;
  theme_sources: string[] | null;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  items_processed: number;
  items_new: number;
  error_message: string | null;
}

export interface SyncHistoryListResponse {
  items: SyncHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface DataSourceStatus {
  source_type: string;
  source_name: string;
  is_active: boolean;
  last_synced_at: string | null;
  sync_status: string | null;
  message_count: number;
}

export interface DataSourcesStatusResponse {
  sources: DataSourceStatus[];
  total_messages: number;
  last_sync_at: string | null;
}

export interface SyncOperationResponse {
  sync_id: string;
  status: string;
  message: string;
  source_type: string | null;
  estimated_items: number | null;
  task_id: string | null;
}

export interface SyncAllSourcesResponse {
  message: string;
  sync_operations: SyncOperationResponse[];
  total_sources: number;
}

export interface SyncThemesResponse {
  message: string;
  sync_id: string;
  status: string;
  themes_to_process: number;
  task_id: string | null;
}

export interface SyncStatusResponse {
  sync_id: string;
  status: string;
  sync_type: string;
  source_type: string | null;
  source_name: string | null;
  items_processed: number;
  items_new: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface RelatedFeature {
  id: string;
  title: string;
  theme_id: string | null;
}

export interface PartyInfo {
  name?: string;
  email?: string;
  role?: string;
}

export interface CustomerInfo {
  name?: string;
  email?: string;
}

export interface MessageDetailsResponse {
  id: string;
  type: string;
  source: string;
  title: string;
  content: string | null;
  sender: string;
  sender_email: string | null;
  channel_name: string | null;
  sent_at: string | null;
  created_at: string | null;
  is_processed: boolean;
  processed_at: string | null;
  // Metadata
  metadata: Record<string, unknown>;
  ai_insights: Record<string, unknown> | null;
  thread_id: string | null;
  is_thread_reply: boolean;
  // Gong/Fathom fields
  duration: number | null;
  duration_formatted: string | null;
  parties: PartyInfo[];
  participants: (string | PartyInfo)[];
  customer_info: CustomerInfo | null;
  recording_url: string | null;
  has_transcript: boolean;
  call_id: string | null;
  session_id: string | null;
  // Gmail fields
  subject?: string;
  from_name?: string;
  from_email?: string;
  to_emails?: string[];
  snippet?: string;
  message_count?: number;
  thread_date?: string;
  label_name?: string;
  gmail_thread_id?: string;
  // Related features
  related_features: RelatedFeature[];
}

// ============ Sorting Types ============

export type MessageSortField = 'timestamp' | 'sender' | 'source';
export type SyncHistorySortField = 'type' | 'status' | 'started_at';
export type SortOrder = 'asc' | 'desc';

// ============ API Functions ============

/**
 * Get full details of a specific message
 */
export async function getMessageDetails(
  workspaceId: string,
  messageId: string
): Promise<MessageDetailsResponse> {
  const response = await api.get<MessageDetailsResponse>(
    `/api/v1/sources/${workspaceId}/messages/${messageId}`
  );
  return response.data;
}

/**
 * Get paginated messages from all data sources
 */
export async function getMessages(
  workspaceId: string,
  page: number = 1,
  pageSize: number = 5,
  source?: string,
  sortBy: MessageSortField = 'timestamp',
  sortOrder: SortOrder = 'desc'
): Promise<MessageListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  if (source && source !== 'all') {
    params.append('source', source);
  }

  const response = await api.get<MessageListResponse>(
    `/api/v1/sources/${workspaceId}/messages?${params.toString()}`
  );
  return response.data;
}

/**
 * Get paginated sync history
 */
export async function getSyncHistory(
  workspaceId: string,
  page: number = 1,
  pageSize: number = 10,
  source?: string,
  syncType?: string,
  sortBy: SyncHistorySortField = 'started_at',
  sortOrder: SortOrder = 'desc'
): Promise<SyncHistoryListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  if (source && source !== 'all') {
    params.append('source', source);
  }

  if (syncType && syncType !== 'all') {
    params.append('sync_type', syncType);
  }

  const response = await api.get<SyncHistoryListResponse>(
    `/api/v1/sources/${workspaceId}/sync-history?${params.toString()}`
  );
  return response.data;
}

/**
 * Get status of all connected data sources
 */
export async function getDataSourcesStatus(
  workspaceId: string
): Promise<DataSourcesStatusResponse> {
  const response = await api.get<DataSourcesStatusResponse>(
    `/api/v1/sources/${workspaceId}/status`
  );
  return response.data;
}

/**
 * Trigger sync for all connected data sources
 */
export async function syncAllSources(
  workspaceId: string,
  hoursBack: number = 24
): Promise<SyncAllSourcesResponse> {
  const response = await api.post<SyncAllSourcesResponse>(
    `/api/v1/sources/${workspaceId}/sync-all`,
    { hours_back: hoursBack }
  );
  return response.data;
}

/**
 * Trigger theme synchronization
 */
export async function syncThemes(
  workspaceId: string,
  themeIds?: string[],
  reprocessAll: boolean = false
): Promise<SyncThemesResponse> {
  const response = await api.post<SyncThemesResponse>(
    `/api/v1/sources/${workspaceId}/sync-themes`,
    { theme_ids: themeIds, reprocess_all: reprocessAll }
  );
  return response.data;
}

/**
 * Get status of a specific sync operation
 */
export async function getSyncStatus(
  workspaceId: string,
  syncId: string
): Promise<SyncStatusResponse> {
  const response = await api.get<SyncStatusResponse>(
    `/api/v1/sources/${workspaceId}/sync-status/${syncId}`
  );
  return response.data;
}

/**
 * Get synced items for a specific sync operation
 */
export async function getSyncedItems(
  workspaceId: string,
  syncId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<any> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  const response = await api.get(
    `/api/v1/sources/${workspaceId}/sync-items/${syncId}?${params.toString()}`
  );
  return response.data;
}

/**
 * Poll for sync completion with automatic retry
 * Returns when all syncs are complete or failed
 */
export async function pollSyncCompletion(
  workspaceId: string,
  syncIds: string[],
  onStatusUpdate?: (statuses: SyncStatusResponse[]) => void,
  maxAttempts: number = 60, // 5 minutes max at 5 second intervals
  intervalMs: number = 5000
): Promise<SyncStatusResponse[]> {
  let attempts = 0;

  const checkStatuses = async (): Promise<SyncStatusResponse[]> => {
    const statuses = await Promise.all(
      syncIds.map(id => getSyncStatus(workspaceId, id).catch(() => null))
    );
    return statuses.filter((s): s is SyncStatusResponse => s !== null);
  };

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;
        const statuses = await checkStatuses();

        if (onStatusUpdate) {
          onStatusUpdate(statuses);
        }

        // Check if all syncs are complete (success or failed)
        const allComplete = statuses.every(
          s => s.status === 'success' || s.status === 'failed'
        );

        if (allComplete) {
          resolve(statuses);
          return;
        }

        if (attempts >= maxAttempts) {
          resolve(statuses); // Return whatever we have after max attempts
          return;
        }

        // Continue polling
        setTimeout(poll, intervalMs);
      } catch (error) {
        if (attempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(poll, intervalMs);
        }
      }
    };

    poll();
  });
}

export const sourcesService = {
  getMessages,
  getMessageDetails,
  getSyncHistory,
  getDataSourcesStatus,
  syncAllSources,
  syncThemes,
  getSyncStatus,
  getSyncedItems,
  pollSyncCompletion,
};

export default sourcesService;
