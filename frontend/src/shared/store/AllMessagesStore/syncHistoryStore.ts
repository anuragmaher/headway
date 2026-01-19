/**
 * Zustand store for Sync History state management
 *
 * Manages sync history data, filtering, pagination, and real-time updates.
 * Separates concerns from the main SourcesPage component for better maintainability.
 */

import { create } from 'zustand';
import sourcesService, {
  SyncHistorySortField,
  SortOrder,
  SyncHistoryListResponse,
} from '@/services/sources';
import { SyncHistoryItem, SourceType, SyncType, TriggerType } from '../../types/AllMessagesTypes';

/** Filter options for sync history */
export interface SyncHistoryFilters {
  sourceFilter: SourceType | 'all';
  typeFilter: SyncType;
  triggerFilter: TriggerType | 'all';
}

/** State shape for sync history store */
interface SyncHistoryState {
  // Data
  items: SyncHistoryItem[];
  total: number;
  totalPages: number;

  // Pagination
  page: number;
  pageSize: number;

  // Sorting
  sortBy: SyncHistorySortField;
  sortOrder: SortOrder;

  // Filters
  filters: SyncHistoryFilters;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSyncHistory: (workspaceId: string) => Promise<void>;
  setPage: (page: number) => void;
  setSortBy: (field: SyncHistorySortField) => void;
  toggleSortOrder: () => void;
  setFilters: (filters: Partial<SyncHistoryFilters>) => void;
  updateItem: (id: string, updates: Partial<SyncHistoryItem>) => void;
  addItem: (item: SyncHistoryItem) => void;
  reset: () => void;
}

/** Transform API response to frontend types */
function transformApiResponse(response: SyncHistoryListResponse): SyncHistoryItem[] {
  return response.items.map((item) => ({
    id: item.id,
    type: item.sync_type as 'source' | 'theme',
    name:
      item.sync_type === 'source'
        ? item.source_name || item.source_type || 'Unknown'
        : item.theme_name || 'Unknown',
    sourceType: item.source_type as SourceType | undefined,
    sourceIcons: item.theme_sources as SourceType[] | undefined,
    status: item.status as SyncHistoryItem['status'],
    triggerType: (item.trigger_type as TriggerType) || 'manual',
    startedAt: item.started_at,
    processed: item.items_processed,
    newItems: item.items_new,
    errorMessage: item.error_message,
  }));
}

/** Initial state */
const initialState = {
  items: [] as SyncHistoryItem[],
  total: 0,
  totalPages: 1,
  page: 1,
  pageSize: 10,
  sortBy: 'started_at' as SyncHistorySortField,
  sortOrder: 'desc' as SortOrder,
  filters: {
    sourceFilter: 'all' as const,
    typeFilter: 'all' as SyncType,
    triggerFilter: 'all' as const,
  },
  isLoading: false,
  error: null as string | null,
};

/**
 * Zustand store for sync history management
 *
 * Usage:
 * ```tsx
 * const { items, isLoading, fetchSyncHistory, setFilters } = useSyncHistoryStore();
 *
 * useEffect(() => {
 *   fetchSyncHistory(workspaceId);
 * }, [workspaceId, fetchSyncHistory]);
 * ```
 */
export const useSyncHistoryStore = create<SyncHistoryState>((set, get) => ({
  ...initialState,

  /** Fetch sync history from API */
  fetchSyncHistory: async (workspaceId: string) => {
    const { page, pageSize, sortBy, sortOrder, filters } = get();

    set({ isLoading: true, error: null });

    try {
      const response = await sourcesService.getSyncHistory(
        workspaceId,
        page,
        pageSize,
        filters.sourceFilter !== 'all' ? filters.sourceFilter : undefined,
        filters.typeFilter !== 'all' ? filters.typeFilter : undefined,
        sortBy,
        sortOrder
      );

      // Transform and filter by trigger type on client side
      // (Backend doesn't support trigger_type filter yet for backwards compatibility)
      let transformedItems = transformApiResponse(response);

      if (filters.triggerFilter !== 'all') {
        transformedItems = transformedItems.filter(
          (item) => item.triggerType === filters.triggerFilter
        );
      }

      set({
        items: transformedItems,
        total: response.total,
        totalPages: response.total_pages,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error fetching sync history:', err);
      set({
        error: 'Failed to load sync history',
        items: [],
        isLoading: false,
      });
    }
  },

  /** Set current page */
  setPage: (page: number) => {
    set({ page });
  },

  /** Set sort field (toggles order if same field) */
  setSortBy: (field: SyncHistorySortField) => {
    const { sortBy, sortOrder } = get();

    if (sortBy === field) {
      // Toggle order if clicking same column
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      // Default to descending for new field
      set({ sortBy: field, sortOrder: 'desc' });
    }
  },

  /** Toggle sort order */
  toggleSortOrder: () => {
    const { sortOrder } = get();
    set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
  },

  /** Update filters */
  setFilters: (newFilters: Partial<SyncHistoryFilters>) => {
    const { filters } = get();
    set({
      filters: { ...filters, ...newFilters },
      page: 1, // Reset to first page when filters change
    });
  },

  /** Update a single item in the list */
  updateItem: (id: string, updates: Partial<SyncHistoryItem>) => {
    const { items } = get();
    set({
      items: items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  },

  /** Add a new item to the beginning of the list */
  addItem: (item: SyncHistoryItem) => {
    const { items } = get();
    // Check if item already exists
    if (items.some((existing) => existing.id === item.id)) {
      // Update existing instead
      set({
        items: items.map((existing) =>
          existing.id === item.id ? item : existing
        ),
      });
    } else {
      set({ items: [item, ...items] });
    }
  },

  /** Reset store to initial state */
  reset: () => {
    set(initialState);
  },
}));

export default useSyncHistoryStore;
