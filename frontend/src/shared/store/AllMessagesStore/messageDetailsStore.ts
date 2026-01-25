/**
 * Zustand store for Message Details state management
 *
 * Manages the selected message, loading state, and detail panel visibility.
 * Provides actions for fetching message details and managing UI state.
 * Also fetches AI insights for the selected message.
 */

import { create } from 'zustand';
import sourcesService, { MessageDetailsResponse, AIInsightsResponse } from '@/services/sources';

/** Active tab in the message detail panel */
export type MessageDetailTab = 'content';

/** State shape for message details store */
interface MessageDetailsState {
  // Panel visibility
  isOpen: boolean;

  // Selected message
  selectedMessageId: string | null;
  selectedMessage: MessageDetailsResponse | null;

  // AI Insights for the selected message
  aiInsights: AIInsightsResponse | null;
  isLoadingInsights: boolean;

  // Active tab
  activeTab: MessageDetailTab;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  openPanel: (messageId: string, workspaceId: string) => Promise<void>;
  closePanel: () => void;
  setActiveTab: (tab: MessageDetailTab) => void;
  clearError: () => void;
  reset: () => void;
}

/** Initial state */
const initialState = {
  isOpen: false,
  selectedMessageId: null as string | null,
  selectedMessage: null as MessageDetailsResponse | null,
  aiInsights: null as AIInsightsResponse | null,
  isLoadingInsights: false,
  activeTab: 'content' as MessageDetailTab,
  isLoading: false,
  error: null as string | null,
};

/**
 * Zustand store for message details management
 *
 * Usage:
 * ```tsx
 * const { isOpen, selectedMessage, openPanel, closePanel } = useMessageDetailsStore();
 *
 * // Open panel with message
 * openPanel(messageId, workspaceId);
 *
 * // Close panel
 * closePanel();
 * ```
 */
export const useMessageDetailsStore = create<MessageDetailsState>((set, get) => ({
  ...initialState,

  /** Open the detail panel and fetch message details (AI insights included in response) */
  openPanel: async (messageId: string, workspaceId: string) => {
    // If same message is already selected, just open the panel
    if (get().selectedMessageId === messageId && get().selectedMessage) {
      set({ isOpen: true });
      return;
    }

    // Immediately show the panel with loading state
    set({
      isOpen: true,
      selectedMessageId: messageId,
      isLoading: true,
      isLoadingInsights: true,
      aiInsights: null,
      error: null,
    });

    try {
      // Fetch message details (AI insights are now included in the response)
      const details = await sourcesService.getMessageDetails(workspaceId, messageId);

      // Extract AI insights from the response (new Key Insights structure)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiInsights = (details as any).ai_insights || null;

      set({
        selectedMessage: details,
        aiInsights: aiInsights,
        isLoading: false,
        isLoadingInsights: false,
      });
    } catch (err) {
      console.error('Error fetching message details:', err);
      set({
        error: 'Failed to load message details',
        isLoading: false,
        isLoadingInsights: false,
      });
    }
  },

  /** Close the detail panel */
  closePanel: () => {
    set({ isOpen: false });
  },

  /** Set the active tab */
  setActiveTab: (tab: MessageDetailTab) => {
    set({ activeTab: tab });
  },

  /** Clear error state */
  clearError: () => {
    set({ error: null });
  },

  /** Reset store to initial state */
  reset: () => {
    set(initialState);
  },
}));

export default useMessageDetailsStore;
