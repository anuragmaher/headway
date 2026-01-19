/**
 * Zustand store for Message Details state management
 *
 * Manages the selected message, loading state, and detail panel visibility.
 * Provides actions for fetching message details and managing UI state.
 *
 * AI Insights Architecture:
 * - AI insights are fetched on-demand when user clicks on a message
 * - Insights are cached in Redis (5 min TTL) and persisted to database
 * - The store manages separate loading states for message details and AI insights
 */

import { create } from 'zustand';
import sourcesService, { MessageDetailsResponse, AIInsights } from '@/services/sources';

/** Active tab in the message detail panel */
export type MessageDetailTab = 'ai-insights' | 'content';

/** AI Insights loading state */
export type AIInsightsStatus = 'idle' | 'loading' | 'success' | 'error';

/** Source of AI insights */
export type AIInsightsSource = 'cache' | 'database' | 'extracted' | 'error' | null;

/** State shape for message details store */
interface MessageDetailsState {
  // Panel visibility
  isOpen: boolean;

  // Selected message
  selectedMessageId: string | null;
  selectedMessage: MessageDetailsResponse | null;

  // Active tab
  activeTab: MessageDetailTab;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // AI Insights state (on-demand)
  aiInsights: AIInsights | null;
  aiInsightsStatus: AIInsightsStatus;
  aiInsightsSource: AIInsightsSource;
  aiInsightsError: string | null;

  // Actions
  openPanel: (messageId: string, workspaceId: string) => Promise<void>;
  closePanel: () => void;
  setActiveTab: (tab: MessageDetailTab) => void;
  clearError: () => void;
  reset: () => void;

  // AI Insights actions
  fetchAIInsights: (workspaceId: string, messageId: string, forceRefresh?: boolean) => Promise<void>;
  clearAIInsights: () => void;
}

/** Initial state */
const initialState = {
  isOpen: false,
  selectedMessageId: null as string | null,
  selectedMessage: null as MessageDetailsResponse | null,
  activeTab: 'ai-insights' as MessageDetailTab,
  isLoading: false,
  error: null as string | null,
  // AI Insights initial state
  aiInsights: null as AIInsights | null,
  aiInsightsStatus: 'idle' as AIInsightsStatus,
  aiInsightsSource: null as AIInsightsSource,
  aiInsightsError: null as string | null,
};

/**
 * Zustand store for message details management
 *
 * Usage:
 * ```tsx
 * const { isOpen, selectedMessage, openPanel, closePanel, fetchAIInsights } = useMessageDetailsStore();
 *
 * // Open panel with message
 * openPanel(messageId, workspaceId);
 *
 * // Fetch AI insights on-demand
 * fetchAIInsights(workspaceId, messageId);
 *
 * // Close panel
 * closePanel();
 * ```
 */
export const useMessageDetailsStore = create<MessageDetailsState>((set, get) => ({
  ...initialState,

  /** Open the detail panel and fetch message details */
  openPanel: async (messageId: string, workspaceId: string) => {
    // If same message is already selected, just open the panel
    if (get().selectedMessageId === messageId && get().selectedMessage) {
      set({ isOpen: true });
      return;
    }

    set({
      isOpen: true,
      selectedMessageId: messageId,
      isLoading: true,
      error: null,
      // Reset AI insights state for new message
      aiInsights: null,
      aiInsightsStatus: 'idle',
      aiInsightsSource: null,
      aiInsightsError: null,
    });

    try {
      const details = await sourcesService.getMessageDetails(workspaceId, messageId);
      set({
        selectedMessage: details,
        isLoading: false,
      });

      // Auto-fetch AI insights after message details are loaded
      // This provides seamless UX when user switches to AI Insights tab
      get().fetchAIInsights(workspaceId, messageId);
    } catch (err) {
      console.error('Error fetching message details:', err);
      set({
        error: 'Failed to load message details',
        isLoading: false,
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

  /**
   * Fetch AI insights for the current message (on-demand extraction)
   *
   * This triggers the backend to:
   * 1. Check Redis cache
   * 2. Check database for persisted insights
   * 3. Extract via AI API if not found
   * 4. Cache and persist the result
   */
  fetchAIInsights: async (workspaceId: string, messageId: string, forceRefresh: boolean = false) => {
    // Don't fetch if already loading
    if (get().aiInsightsStatus === 'loading') {
      return;
    }

    // Don't fetch again if already have insights for this message (unless force refresh)
    if (!forceRefresh && get().aiInsightsStatus === 'success' && get().selectedMessageId === messageId) {
      return;
    }

    set({
      aiInsightsStatus: 'loading',
      aiInsightsError: null,
    });

    try {
      const response = await sourcesService.getMessageAIInsights(workspaceId, messageId, forceRefresh);

      if (response.is_error) {
        throw new Error(response.ai_insights?.error as string || 'Failed to extract AI insights');
      }

      // Parse the AI insights from the response
      const insights = response.ai_insights as AIInsights;

      set({
        aiInsights: insights,
        aiInsightsStatus: 'success',
        aiInsightsSource: response.source,
        aiInsightsError: null,
      });

      console.log(`AI insights loaded from: ${response.source}`);
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      set({
        aiInsights: null,
        aiInsightsStatus: 'error',
        aiInsightsSource: 'error',
        aiInsightsError: err instanceof Error ? err.message : 'Failed to load AI insights',
      });
    }
  },

  /** Clear AI insights state */
  clearAIInsights: () => {
    set({
      aiInsights: null,
      aiInsightsStatus: 'idle',
      aiInsightsSource: null,
      aiInsightsError: null,
    });
  },
}));

export default useMessageDetailsStore;
