/**
 * Zustand store for Sync Details state management
 * Manages expanded items, loading states, and fetched data
 */

import { create } from 'zustand';
import { SyncStatusResponse } from '@/services/sources';
import sourcesService from '@/services/sources';

export interface SyncedItem {
  id: string;
  type: 'gmail_thread' | 'slack_message' | 'feature' | 'gong_call' | 'fathom_session';
  // Common fields
  title?: string;
  content?: string;
  created_at?: string;
  // Gmail thread fields
  subject?: string;
  from_name?: string;
  from_email?: string;
  to_emails?: string[];
  label_name?: string;
  snippet?: string;
  thread_date?: string;
  message_count?: number;
  // Slack message fields
  author_name?: string;
  author_email?: string;
  channel_name?: string;
  sent_at?: string;
  // Feature fields (theme sync)
  theme_id?: string;
  theme_name?: string;
  description?: string;
  updated_at?: string;
  // Gong/Fathom fields
  duration?: number;
  duration_formatted?: string;
  duration_seconds?: number;
  participants?: Array<string | { name?: string; email?: string }>;
  parties?: Array<{ name?: string; email?: string; role?: string }>;
  transcript?: string;
  has_transcript?: boolean;
  recording_url?: string;
  call_id?: string;
  session_id?: string;
  customer_info?: { name?: string; email?: string };
}

interface SyncDetailsState {
  // Data
  syncDetails: SyncStatusResponse | null;
  syncedItems: SyncedItem[];
  syncedItemsTotal: number;

  // UI State
  expandedItems: Set<string>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchSyncDetails: (workspaceId: string, syncId: string) => Promise<void>;
  toggleItemExpanded: (itemId: string) => void;
  expandItem: (itemId: string) => void;
  collapseItem: (itemId: string) => void;
  collapseAll: () => void;
  reset: () => void;
}

export const useSyncDetailsStore = create<SyncDetailsState>((set, get) => ({
  // Initial state
  syncDetails: null,
  syncedItems: [],
  syncedItemsTotal: 0,
  expandedItems: new Set(),
  loading: false,
  error: null,

  // Fetch sync details and items
  fetchSyncDetails: async (workspaceId: string, syncId: string) => {
    set({ loading: true, error: null });

    try {
      // Fetch sync status details
      const details = await sourcesService.getSyncStatus(workspaceId, syncId);
      set({ syncDetails: details });

      // If successful, fetch the actual synced items
      if (details.status === 'success') {
        try {
          const itemsResponse = await sourcesService.getSyncedItems(workspaceId, syncId, 1, 50);
          set({
            syncedItems: itemsResponse.items || [],
            syncedItemsTotal: itemsResponse.total || 0,
          });
        } catch (err) {
          console.error('Error fetching synced items:', err);
          // Don't show error, just skip items
        }
      }
    } catch (err) {
      console.error('Error fetching sync details:', err);
      set({ error: 'Failed to load sync details' });
    } finally {
      set({ loading: false });
    }
  },

  // Toggle item expanded state
  toggleItemExpanded: (itemId: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedItems);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return { expandedItems: newExpanded };
    });
  },

  // Expand specific item
  expandItem: (itemId: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedItems);
      newExpanded.add(itemId);
      return { expandedItems: newExpanded };
    });
  },

  // Collapse specific item
  collapseItem: (itemId: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedItems);
      newExpanded.delete(itemId);
      return { expandedItems: newExpanded };
    });
  },

  // Collapse all items
  collapseAll: () => {
    set({ expandedItems: new Set() });
  },

  // Reset store state
  reset: () => {
    set({
      syncDetails: null,
      syncedItems: [],
      syncedItemsTotal: 0,
      expandedItems: new Set(),
      loading: false,
      error: null,
    });
  },
}));

export default useSyncDetailsStore;
