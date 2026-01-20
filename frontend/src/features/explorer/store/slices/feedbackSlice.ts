/**
 * Feedback Slice - Manages feedback items data and actions
 */
import { StateCreator } from 'zustand';
import type {
  FeedbackItem,
  MoveFeedbackInput,
  ExplorerFilters,
  SortOption,
} from '../../types';
import type { ExplorerStore } from '../explorerStore';
import api from '../../../../services/api';

export interface FeedbackState {
  feedbackItems: FeedbackItem[];
  totalFeedback: number;
  hasMoreFeedback: boolean;
  nextCursor: string | null;
  isLoadingFeedback: boolean;
  isLoadingMoreFeedback: boolean;
  feedbackError: string | null;
  filters: ExplorerFilters;
  sortBy: SortOption;
}

export interface FeedbackActions {
  fetchFeedback: (subThemeId: string) => Promise<void>;
  fetchMoreFeedback: () => Promise<void>;
  fetchFeedbackDetail: (feedbackId: string) => Promise<FeedbackItem | null>;
  moveFeedback: (input: MoveFeedbackInput) => Promise<void>;
  setFilters: (filters: Partial<ExplorerFilters>) => void;
  setSortBy: (sortBy: SortOption) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  clearFeedback: () => void;
  clearFeedbackError: () => void;
}

export type FeedbackSlice = FeedbackState & FeedbackActions;

const initialFeedbackState: FeedbackState = {
  feedbackItems: [],
  totalFeedback: 0,
  hasMoreFeedback: false,
  nextCursor: null,
  isLoadingFeedback: false,
  isLoadingMoreFeedback: false,
  feedbackError: null,
  filters: {
    sources: [],
    tags: [],
    urgency: [],
    dateRange: null,
    searchQuery: '',
  },
  sortBy: 'recent',
};

export const createFeedbackSlice: StateCreator<
  ExplorerStore,
  [],
  [],
  FeedbackSlice
> = (set, get) => ({
  ...initialFeedbackState,

  fetchFeedback: async (subThemeId: string) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) return;

    set({ isLoadingFeedback: true, feedbackError: null });

    try {
      const { filters, sortBy } = get();

      // Fetch messages for the selected feature/sub-theme
      // API endpoint: GET /api/v1/features/features/{feature_id}/messages
      // (router mounted at /api/v1/features, route is /features/{feature_id}/messages)
      console.log('[Explorer] Fetching messages for feature:', subThemeId);
      const response = await api.get(`/api/v1/features/features/${subThemeId}/messages`, {
        params: {
          workspace_id: workspaceId,
        },
      });

      // Transform API response to FeedbackItem format
      // API returns List[MessageResponse] directly (not wrapped in an object)
      const messages = response.data || [];
      console.log('[Explorer] Received messages:', messages.length, 'items');

      const feedbackItems: FeedbackItem[] = messages.map((message: Record<string, unknown>) =>
        transformMessageToFeedback(message, subThemeId)
      );

      set({
        feedbackItems,
        totalFeedback: feedbackItems.length,
        hasMoreFeedback: false, // Implement pagination when API supports it
        nextCursor: null,
        isLoadingFeedback: false,
      });
    } catch (error) {
      console.error('[Explorer] Failed to fetch messages:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch feedback';
      set({ feedbackError: message, isLoadingFeedback: false });
    }
  },

  fetchMoreFeedback: async () => {
    const { nextCursor, isLoadingMoreFeedback, selectedSubThemeId } = get();
    if (!nextCursor || isLoadingMoreFeedback || !selectedSubThemeId) return;

    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) return;

    set({ isLoadingMoreFeedback: true });

    try {
      const { filters, sortBy } = get();

      const response = await api.get(`/api/v1/features/features/${selectedSubThemeId}/messages`, {
        params: {
          workspace_id: workspaceId,
          skip: nextCursor ? parseInt(nextCursor) : 0,
        },
      });

      const newItems: FeedbackItem[] = (response.data?.items || []).map((message: Record<string, unknown>) =>
        transformMessageToFeedback(message, selectedSubThemeId)
      );

      set((state) => ({
        feedbackItems: [...state.feedbackItems, ...newItems],
        totalFeedback: response.data?.total || state.totalFeedback,
        hasMoreFeedback: response.data?.has_more || false,
        nextCursor: response.data?.next_cursor || null,
        isLoadingMoreFeedback: false,
      }));
    } catch (error) {
      set({ isLoadingMoreFeedback: false });
    }
  },

  fetchFeedbackDetail: async (feedbackId: string) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) return null;

    try {
      const response = await api.get(`/api/v1/messages/${feedbackId}`, {
        params: { workspace_id: workspaceId },
      });

      const { selectedSubThemeId } = get();
      return transformMessageToFeedback(response.data, selectedSubThemeId || '');
    } catch {
      return null;
    }
  },

  moveFeedback: async (input: MoveFeedbackInput) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      await api.put(`/api/v1/messages/${input.feedbackId}/move`, {
        new_feature_id: input.newSubThemeId,
      }, {
        params: { workspace_id: workspaceId },
      });

      // Remove from current list if moved to different sub-theme
      const { selectedSubThemeId } = get();
      if (selectedSubThemeId !== input.newSubThemeId) {
        set((state) => ({
          feedbackItems: state.feedbackItems.filter((item) => item.id !== input.feedbackId),
          totalFeedback: state.totalFeedback - 1,
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move feedback';
      set({ feedbackError: message });
      throw error;
    }
  },

  setFilters: (newFilters: Partial<ExplorerFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));

    // Re-fetch feedback with new filters
    const { selectedSubThemeId, fetchFeedback } = get();
    if (selectedSubThemeId) {
      fetchFeedback(selectedSubThemeId);
    }
  },

  setSortBy: (sortBy: SortOption) => {
    set({ sortBy });

    // Re-fetch feedback with new sort
    const { selectedSubThemeId, fetchFeedback } = get();
    if (selectedSubThemeId) {
      fetchFeedback(selectedSubThemeId);
    }
  },

  setSearchQuery: (query: string) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    }));
  },

  clearFilters: () => {
    set({
      filters: {
        sources: [],
        tags: [],
        urgency: [],
        dateRange: null,
        searchQuery: '',
      },
    });

    // Re-fetch feedback without filters
    const { selectedSubThemeId, fetchFeedback } = get();
    if (selectedSubThemeId) {
      fetchFeedback(selectedSubThemeId);
    }
  },

  clearFeedback: () => {
    set({
      feedbackItems: [],
      totalFeedback: 0,
      hasMoreFeedback: false,
      nextCursor: null,
      selectedFeedbackId: null,
    });
  },

  clearFeedbackError: () => {
    set({ feedbackError: null });
  },
});

/**
 * Transform API message to FeedbackItem format
 */
function transformMessageToFeedback(
  message: Record<string, unknown>,
  subThemeId: string
): FeedbackItem {
  const aiInsights = message.ai_insights as Record<string, unknown> | null;

  // Extract tags from AI insights
  const tags: FeedbackItem['tags'] = [];
  if (aiInsights?.feature_requests && (aiInsights.feature_requests as unknown[]).length > 0) {
    tags.push('FR');
  }
  if (aiInsights?.bug_reports && (aiInsights.bug_reports as unknown[]).length > 0) {
    tags.push('Bug');
  }
  if (aiInsights?.pain_points && (aiInsights.pain_points as unknown[]).length > 0) {
    tags.push('UX');
  }

  // Determine urgency from AI insights or default
  let urgency: FeedbackItem['urgency'] = 'medium';
  if (aiInsights?.sentiment) {
    const sentiment = aiInsights.sentiment as Record<string, unknown>;
    const score = sentiment.score as number;
    if (score < -0.5) urgency = 'high';
    else if (score < 0) urgency = 'medium';
    else urgency = 'low';
  }

  // Generate title from AI insights or content
  let title = message.title as string || '';
  if (!title && aiInsights?.feature_requests) {
    const requests = aiInsights.feature_requests as Array<{ title: string }>;
    if (requests.length > 0) {
      title = requests[0].title;
    }
  }
  if (!title) {
    const content = message.content as string || '';
    title = content.slice(0, 80) + (content.length > 80 ? '...' : '');
  }

  // Generate summary
  let summary = '';
  if (aiInsights?.summary) {
    summary = aiInsights.summary as string;
  } else {
    const content = message.content as string || '';
    summary = content.slice(0, 150) + (content.length > 150 ? '...' : '');
  }

  return {
    id: message.id as string,
    themeId: '', // Will be set from context
    subThemeId,
    title,
    summary,
    source: (message.source as FeedbackItem['source']) || 'slack',
    sourceChannel: message.channel_name as string | undefined,
    sourceMessageId: message.external_id as string | undefined,
    contactName: (message.sender_name as string) || (message.customer_name as string) || 'Unknown',
    contactEmail: message.customer_email as string | undefined,
    contactCompany: undefined,
    tags,
    urgency,
    sentiment: aiInsights?.sentiment
      ? ((aiInsights.sentiment as Record<string, unknown>).overall as 'positive' | 'neutral' | 'negative')
      : undefined,
    originalContent: message.content as string || '',
    mentionCount: 1,
    matchConfidence: (message.match_confidence as number) || 0.8,
    receivedAt: message.sent_at as string || new Date().toISOString(),
    processedAt: message.processed_at as string || new Date().toISOString(),
    aiInsights: aiInsights ? {
      keyPoints: (aiInsights.key_topics as string[]) || [],
      suggestedActions: undefined,
      relatedFeatures: undefined,
      customerContext: undefined,
    } : undefined,
  };
}
