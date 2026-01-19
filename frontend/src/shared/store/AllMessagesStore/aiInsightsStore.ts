/**
 * Zustand store for AI Insights state management
 *
 * Manages workspace-level AI insights progress, polling state,
 * and visibility of the global progress indicator.
 *
 * Single source of truth for AI insights UI state.
 */

import { create } from 'zustand';
import sourcesService, {
  AIInsightsProgressResponse,
  AIInsightsResponse,
} from '@/services/sources';

/** Polling interval in milliseconds (10 seconds) */
const POLLING_INTERVAL_MS = 10000;

/** State shape for AI insights store */
interface AIInsightsState {
  // Progress data
  progress: AIInsightsProgressResponse | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Polling state
  isPolling: boolean;
  pollingIntervalId: NodeJS.Timeout | null;

  // Progress indicator visibility
  isProgressIndicatorVisible: boolean;
  isProgressIndicatorDismissed: boolean;

  // Workspace context
  workspaceId: string | null;

  // Message-level insights cache (message_id -> insights)
  messageInsightsCache: Map<string, AIInsightsResponse>;

  // Actions
  fetchProgress: (workspaceId: string) => Promise<void>;
  startPolling: (workspaceId: string) => void;
  stopPolling: () => void;
  setWorkspaceId: (workspaceId: string) => void;
  dismissProgressIndicator: () => void;
  showProgressIndicator: () => void;
  fetchMessageInsights: (workspaceId: string, messageId: string) => Promise<AIInsightsResponse | null>;
  clearCache: () => void;
  reset: () => void;
}

/** Initial state */
const initialState = {
  progress: null as AIInsightsProgressResponse | null,
  isLoading: false,
  error: null as string | null,
  isPolling: false,
  pollingIntervalId: null as NodeJS.Timeout | null,
  isProgressIndicatorVisible: true,
  isProgressIndicatorDismissed: false,
  workspaceId: null as string | null,
  messageInsightsCache: new Map<string, AIInsightsResponse>(),
};

/**
 * Zustand store for AI insights management
 *
 * Usage:
 * ```tsx
 * const { progress, isLoading, startPolling, stopPolling } = useAIInsightsStore();
 *
 * // Start polling when component mounts
 * useEffect(() => {
 *   if (workspaceId) {
 *     startPolling(workspaceId);
 *   }
 *   return () => stopPolling();
 * }, [workspaceId]);
 * ```
 */
export const useAIInsightsStore = create<AIInsightsState>((set, get) => ({
  ...initialState,

  /** Fetch AI insights progress from API */
  fetchProgress: async (workspaceId: string) => {
    if (!workspaceId) return;

    set({ isLoading: true, error: null });

    try {
      const progress = await sourcesService.getAIInsightsProgress(workspaceId);
      set({
        progress,
        isLoading: false,
        // Auto-show indicator if processing is happening and not dismissed
        isProgressIndicatorVisible:
          !get().isProgressIndicatorDismissed &&
          (progress.pending_count > 0 || progress.processing_count > 0),
      });
    } catch (err) {
      console.error('Error fetching AI insights progress:', err);
      set({
        error: 'Failed to load AI insights progress',
        isLoading: false,
      });
    }
  },

  /** Start polling for progress updates */
  startPolling: (workspaceId: string) => {
    const state = get();

    // Don't start if already polling
    if (state.isPolling && state.pollingIntervalId) {
      return;
    }

    // Set workspace and fetch immediately
    set({ workspaceId, isPolling: true });
    get().fetchProgress(workspaceId);

    // Start interval polling
    const intervalId = setInterval(() => {
      const currentWorkspaceId = get().workspaceId;
      if (currentWorkspaceId) {
        get().fetchProgress(currentWorkspaceId);
      }
    }, POLLING_INTERVAL_MS);

    set({ pollingIntervalId: intervalId });
  },

  /** Stop polling */
  stopPolling: () => {
    const { pollingIntervalId } = get();
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
    set({
      isPolling: false,
      pollingIntervalId: null,
    });
  },

  /** Set workspace ID and optionally start polling */
  setWorkspaceId: (workspaceId: string) => {
    const currentWorkspaceId = get().workspaceId;
    if (currentWorkspaceId !== workspaceId) {
      // Clear cache when workspace changes
      set({
        workspaceId,
        progress: null,
        messageInsightsCache: new Map(),
        isProgressIndicatorDismissed: false,
      });
    }
  },

  /** Dismiss the progress indicator (hides until re-shown) */
  dismissProgressIndicator: () => {
    set({
      isProgressIndicatorVisible: false,
      isProgressIndicatorDismissed: true,
    });
  },

  /** Show the progress indicator */
  showProgressIndicator: () => {
    set({
      isProgressIndicatorVisible: true,
      isProgressIndicatorDismissed: false,
    });
  },

  /** Fetch AI insights for a specific message */
  fetchMessageInsights: async (
    workspaceId: string,
    messageId: string
  ): Promise<AIInsightsResponse | null> => {
    // Check cache first
    const cached = get().messageInsightsCache.get(messageId);
    if (cached) {
      return cached;
    }

    try {
      const insights = await sourcesService.getMessageAIInsights(workspaceId, messageId);
      if (insights) {
        // Update cache
        const newCache = new Map(get().messageInsightsCache);
        newCache.set(messageId, insights);
        set({ messageInsightsCache: newCache });
      }
      return insights;
    } catch (err) {
      console.error('Error fetching message AI insights:', err);
      return null;
    }
  },

  /** Clear the message insights cache */
  clearCache: () => {
    set({ messageInsightsCache: new Map() });
  },

  /** Reset store to initial state */
  reset: () => {
    const { pollingIntervalId } = get();
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
    set({
      ...initialState,
      messageInsightsCache: new Map(),
    });
  },
}));

// ============ Selectors ============

/**
 * Selector: Is AI processing in progress?
 * Returns true if there are pending or processing items
 */
export const selectIsProcessing = (state: AIInsightsState): boolean => {
  if (!state.progress) return false;
  return state.progress.pending_count > 0 || state.progress.processing_count > 0;
};

/**
 * Selector: Is AI insights feature enabled for workspace?
 */
export const selectIsAIInsightsEnabled = (state: AIInsightsState): boolean => {
  return state.progress?.ai_insights_enabled ?? true;
};

/**
 * Selector: Get progress percentage (0-100)
 */
export const selectProgressPercent = (state: AIInsightsState): number => {
  return state.progress?.percent_complete ?? 0;
};

/**
 * Selector: Should show progress indicator?
 * Shows when: processing, not dismissed, and has meaningful progress
 */
export const selectShouldShowProgress = (state: AIInsightsState): boolean => {
  if (!state.progress) return false;
  if (state.isProgressIndicatorDismissed) return false;
  if (!state.isProgressIndicatorVisible) return false;

  // Show if actively processing
  const isProcessing = state.progress.pending_count > 0 || state.progress.processing_count > 0;

  // Also show briefly after completion (for success feedback)
  const recentlyCompleted =
    state.progress.percent_complete === 100 && state.progress.completed_count > 0;

  return isProcessing || recentlyCompleted;
};

export default useAIInsightsStore;
