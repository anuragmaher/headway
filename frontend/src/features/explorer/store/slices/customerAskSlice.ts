/**
 * CustomerAsk Slice - Manages customer asks and mentions data
 *
 * This slice handles:
 * - Fetching CustomerAsks for a selected SubTheme
 * - Fetching Mentions for a selected CustomerAsk
 * - Managing the mentions panel state
 */
import { StateCreator } from 'zustand';
import type {
  CustomerAskItem,
  MentionItem,
  LinkedCustomerAsk,
  ExplorerFilters,
  SortOption,
  CustomerAskStatus,
} from '../../types';
import type { ExplorerStore } from '../explorerStore';
import { themesApi } from '../../../../services/themes.api';
import type { Mention, MentionAIInsight } from '../../../../shared/types/api.types';

export interface CustomerAskState {
  // CustomerAsks state
  customerAsks: CustomerAskItem[];
  totalCustomerAsks: number;
  isLoadingCustomerAsks: boolean;
  customerAsksError: string | null;
  // Cache: subThemeId -> customer asks (prevents duplicate fetches)
  customerAsksCache: Record<string, { items: CustomerAskItem[]; total: number }>;
  currentSubThemeIdForAsks: string | null;

  // Mentions state
  mentions: MentionItem[];
  totalMentions: number;
  hasMoreMentions: boolean;
  mentionsNextCursor: string | null;
  isLoadingMentions: boolean;
  isLoadingMoreMentions: boolean;
  mentionsError: string | null;
  // Cache: customerAskId -> mentions (prevents duplicate fetches)
  mentionsCache: Record<string, { items: MentionItem[]; total: number; hasMore: boolean; nextCursor: string | null }>;

  // Selected CustomerAsk
  selectedCustomerAskId: string | null;

  // Mentions panel state
  isMentionsPanelOpen: boolean;
  expandedMentionId: string | null;
}

export interface CustomerAskActions {
  // CustomerAsk actions
  fetchCustomerAsks: (subThemeId: string) => Promise<void>;
  prefetchCustomerAsks: (subThemeId: string) => Promise<void>;  // Cache-only, no visible state update
  selectCustomerAsk: (customerAskId: string | null) => void;
  updateCustomerAskStatus: (customerAskId: string, status: CustomerAskStatus) => Promise<void>;
  clearCustomerAsks: () => void;
  clearCustomerAsksError: () => void;

  // Mentions actions
  fetchMentions: (customerAskId: string) => Promise<void>;
  prefetchMentions: (customerAskId: string) => Promise<void>;  // Cache-only, no visible state update
  fetchMoreMentions: () => Promise<void>;
  clearMentions: () => void;
  clearMentionsError: () => void;

  // Mentions panel actions
  openMentionsPanel: () => void;
  closeMentionsPanel: () => void;
  toggleMentionExpand: (mentionId: string) => void;
}

export type CustomerAskSlice = CustomerAskState & CustomerAskActions;

const initialCustomerAskState: CustomerAskState = {
  customerAsks: [],
  totalCustomerAsks: 0,
  isLoadingCustomerAsks: false,
  customerAsksError: null,
  customerAsksCache: {},
  currentSubThemeIdForAsks: null,

  mentions: [],
  totalMentions: 0,
  hasMoreMentions: false,
  mentionsNextCursor: null,
  isLoadingMentions: false,
  isLoadingMoreMentions: false,
  mentionsError: null,
  mentionsCache: {},

  selectedCustomerAskId: null,
  isMentionsPanelOpen: false,
  expandedMentionId: null,
};

export const createCustomerAskSlice: StateCreator<
  ExplorerStore,
  [],
  [],
  CustomerAskSlice
> = (set, get) => ({
  ...initialCustomerAskState,

  fetchCustomerAsks: async (subThemeId: string) => {
    const { customerAsksCache } = get();

    // OPTIMIZATION: Use cache if available (instant load for previously visited sub-themes)
    if (customerAsksCache[subThemeId]) {
      console.log('[Explorer] Using cached customer asks for sub-theme:', subThemeId);
      const cached = customerAsksCache[subThemeId];
      set({
        customerAsks: cached.items,
        totalCustomerAsks: cached.total,
        currentSubThemeIdForAsks: subThemeId,
        isLoadingCustomerAsks: false,
      });
      return;
    }

    set({ isLoadingCustomerAsks: true, customerAsksError: null, currentSubThemeIdForAsks: subThemeId });

    try {
      console.log('[Explorer] Fetching customer asks for sub-theme:', subThemeId);
      const response = await themesApi.listCustomerAsks(subThemeId);

      const customerAsks: CustomerAskItem[] = response.customer_asks.map((ca) => ({
        id: ca.id,
        subThemeId: ca.sub_theme_id,
        workspaceId: ca.workspace_id,
        name: ca.name,
        description: ca.description || '',
        urgency: ca.urgency,
        status: ca.status,
        matchConfidence: ca.match_confidence || 0,
        mentionCount: ca.message_count || ca.mention_count || 0,
        firstMentionedAt: ca.first_mentioned_at,
        lastMentionedAt: ca.last_mentioned_at,
        createdAt: ca.created_at,
        updatedAt: ca.updated_at,
      }));

      console.log('[Explorer] Received customer asks:', customerAsks.length, 'items');

      // Update state and cache
      set((state) => ({
        customerAsks,
        totalCustomerAsks: response.total,
        isLoadingCustomerAsks: false,
        customerAsksCache: {
          ...state.customerAsksCache,
          [subThemeId]: { items: customerAsks, total: response.total },
        },
      }));

      // OPTIMIZATION: Prefetch first customer ask's mentions in background
      // This makes the first customer ask click instant
      if (customerAsks.length > 0) {
        console.log('[Explorer] Prefetching mentions for first customer ask:', customerAsks[0].id);
        // Fire and forget - don't await to avoid blocking
        // Use prefetchMentions to only update cache, not visible state
        get().prefetchMentions(customerAsks[0].id).catch((err) => {
          console.warn('[Explorer] Failed to prefetch mentions:', err);
        });
      }
    } catch (error) {
      console.error('[Explorer] Failed to fetch customer asks:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch customer asks';
      set({ customerAsksError: message, isLoadingCustomerAsks: false });
    }
  },

  // Prefetch customer asks - only updates cache, doesn't change visible state
  prefetchCustomerAsks: async (subThemeId: string) => {
    const { customerAsksCache } = get();

    // Skip if already cached
    if (customerAsksCache[subThemeId]) {
      console.log('[Explorer] Customer asks already cached for sub-theme:', subThemeId);
      return;
    }

    try {
      console.log('[Explorer] Prefetching customer asks for sub-theme:', subThemeId);
      const response = await themesApi.listCustomerAsks(subThemeId);

      const customerAsks: CustomerAskItem[] = response.customer_asks.map((ca) => ({
        id: ca.id,
        subThemeId: ca.sub_theme_id,
        workspaceId: ca.workspace_id,
        name: ca.name,
        description: ca.description || '',
        urgency: ca.urgency,
        status: ca.status,
        matchConfidence: ca.match_confidence || 0,
        mentionCount: ca.message_count || ca.mention_count || 0,
        firstMentionedAt: ca.first_mentioned_at,
        lastMentionedAt: ca.last_mentioned_at,
        createdAt: ca.created_at,
        updatedAt: ca.updated_at,
      }));

      console.log('[Explorer] Prefetch complete - cached', customerAsks.length, 'customer asks');

      // Only update cache, NOT visible state
      set((state) => ({
        customerAsksCache: {
          ...state.customerAsksCache,
          [subThemeId]: { items: customerAsks, total: response.total },
        },
      }));

      // Chain prefetch: also prefetch mentions for first customer ask
      if (customerAsks.length > 0) {
        get().prefetchMentions(customerAsks[0].id).catch(() => {});
      }
    } catch (error) {
      console.warn('[Explorer] Prefetch customer asks failed:', error);
      // Don't set error state for prefetch failures
    }
  },

  selectCustomerAsk: (customerAskId: string | null) => {
    const previousId = get().selectedCustomerAskId;

    // If deselecting or selecting a different customer ask
    if (!customerAskId || customerAskId !== previousId) {
      set({
        selectedCustomerAskId: customerAskId,
        mentions: [],
        totalMentions: 0,
        hasMoreMentions: false,
        mentionsNextCursor: null,
        expandedMentionId: null,
      });

      // If selecting a customer ask, open the panel and fetch mentions
      if (customerAskId) {
        set({ isMentionsPanelOpen: true });
        get().fetchMentions(customerAskId);
      } else {
        set({ isMentionsPanelOpen: false });
      }
    }
  },

  updateCustomerAskStatus: async (customerAskId: string, status: CustomerAskStatus) => {
    try {
      await themesApi.updateCustomerAsk(customerAskId, { status });

      // Update local state
      set((state) => ({
        customerAsks: state.customerAsks.map((ca) =>
          ca.id === customerAskId ? { ...ca, status } : ca
        ),
      }));
    } catch (error) {
      console.error('[Explorer] Failed to update customer ask status:', error);
      throw error;
    }
  },

  clearCustomerAsks: () => {
    set({
      customerAsks: [],
      totalCustomerAsks: 0,
      selectedCustomerAskId: null,
      mentions: [],
      totalMentions: 0,
      isMentionsPanelOpen: false,
      expandedMentionId: null,
    });
  },

  clearCustomerAsksError: () => {
    set({ customerAsksError: null });
  },

  fetchMentions: async (customerAskId: string) => {
    const { mentionsCache } = get();

    // OPTIMIZATION: Use cache if available (instant load for previously viewed customer asks)
    if (mentionsCache[customerAskId]) {
      console.log('[Explorer] Using cached mentions for customer ask:', customerAskId);
      const cached = mentionsCache[customerAskId];
      set({
        mentions: cached.items,
        totalMentions: cached.total,
        hasMoreMentions: cached.hasMore,
        mentionsNextCursor: cached.nextCursor,
        isLoadingMentions: false,
      });
      return;
    }

    set({ isLoadingMentions: true, mentionsError: null });

    try {
      console.log('[Explorer] Fetching mentions for customer ask:', customerAskId);
      const response = await themesApi.getMentionsForCustomerAsk(customerAskId, 50, 0, true);

      const mentions: MentionItem[] = response.mentions.map((m: Mention) =>
        transformMention(m)
      );

      console.log('[Explorer] Received mentions:', mentions.length, 'items');

      // Update state and cache
      set((state) => ({
        mentions,
        totalMentions: response.total,
        hasMoreMentions: response.has_more,
        mentionsNextCursor: response.next_cursor,
        isLoadingMentions: false,
        mentionsCache: {
          ...state.mentionsCache,
          [customerAskId]: {
            items: mentions,
            total: response.total,
            hasMore: response.has_more,
            nextCursor: response.next_cursor,
          },
        },
      }));
    } catch (error) {
      console.error('[Explorer] Failed to fetch mentions:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch mentions';
      set({ mentionsError: message, isLoadingMentions: false });
    }
  },

  // Prefetch mentions - only updates cache, doesn't change visible state
  prefetchMentions: async (customerAskId: string) => {
    const { mentionsCache } = get();

    // Skip if already cached
    if (mentionsCache[customerAskId]) {
      console.log('[Explorer] Mentions already cached for customer ask:', customerAskId);
      return;
    }

    try {
      console.log('[Explorer] Prefetching mentions for customer ask:', customerAskId);
      const response = await themesApi.getMentionsForCustomerAsk(customerAskId, 50, 0, true);

      const mentions: MentionItem[] = response.mentions.map((m: Mention) =>
        transformMention(m)
      );

      console.log('[Explorer] Prefetch complete - cached', mentions.length, 'mentions');

      // Only update cache, NOT visible state
      set((state) => ({
        mentionsCache: {
          ...state.mentionsCache,
          [customerAskId]: {
            items: mentions,
            total: response.total,
            hasMore: response.has_more,
            nextCursor: response.next_cursor,
          },
        },
      }));
    } catch (error) {
      console.warn('[Explorer] Prefetch mentions failed:', error);
      // Don't set error state for prefetch failures
    }
  },

  fetchMoreMentions: async () => {
    const { mentionsNextCursor, isLoadingMoreMentions, selectedCustomerAskId } = get();
    if (!mentionsNextCursor || isLoadingMoreMentions || !selectedCustomerAskId) return;

    set({ isLoadingMoreMentions: true });

    try {
      const offset = parseInt(mentionsNextCursor) || 0;
      const response = await themesApi.getMentionsForCustomerAsk(
        selectedCustomerAskId,
        50,
        offset,
        true
      );

      const newMentions: MentionItem[] = response.mentions.map((m: Mention) =>
        transformMention(m)
      );

      set((state) => ({
        mentions: [...state.mentions, ...newMentions],
        totalMentions: response.total,
        hasMoreMentions: response.has_more,
        mentionsNextCursor: response.next_cursor,
        isLoadingMoreMentions: false,
      }));
    } catch (error) {
      set({ isLoadingMoreMentions: false });
    }
  },

  clearMentions: () => {
    set({
      mentions: [],
      totalMentions: 0,
      hasMoreMentions: false,
      mentionsNextCursor: null,
      expandedMentionId: null,
    });
  },

  clearMentionsError: () => {
    set({ mentionsError: null });
  },

  openMentionsPanel: () => {
    set({ isMentionsPanelOpen: true });
  },

  closeMentionsPanel: () => {
    set({
      isMentionsPanelOpen: false,
      selectedCustomerAskId: null,
      mentions: [],
      totalMentions: 0,
      expandedMentionId: null,
    });
  },

  toggleMentionExpand: (mentionId: string) => {
    set((state) => ({
      expandedMentionId: state.expandedMentionId === mentionId ? null : mentionId,
    }));
  },
});

/**
 * Transform API mention to MentionItem format
 *
 * Handles many-to-many: one message can link to multiple CustomerAsks
 */
function transformMention(mention: Mention): MentionItem {
  // Transform linked customer asks from API (snake_case) to frontend (camelCase)
  const linkedCustomerAsks: LinkedCustomerAsk[] = (mention.linked_customer_asks || []).map(
    (lca) => ({
      id: lca.id,
      name: lca.name,
      subThemeId: lca.sub_theme_id,
      subThemeName: lca.sub_theme_name,
      themeId: lca.theme_id,
      themeName: lca.theme_name,
    })
  );

  return {
    id: mention.id,
    customerAskId: mention.customer_ask_id,
    customerAskIds: mention.customer_ask_ids || [],  // NEW: All linked CustomerAsk IDs
    linkedCustomerAsks,  // NEW: Other CustomerAsks for UI navigation
    workspaceId: mention.workspace_id,
    source: mention.source,
    externalId: mention.external_id,
    threadId: mention.thread_id,
    content: mention.content,
    title: mention.title,
    channelName: mention.channel_name,
    labelName: mention.label_name,
    authorName: mention.author_name,
    authorEmail: mention.author_email,
    fromEmail: mention.from_email,
    toEmails: mention.to_emails,
    messageCount: mention.message_count,
    sentAt: mention.sent_at,
    isProcessed: mention.is_processed,
    aiInsights: mention.ai_insights ? transformAIInsight(mention.ai_insights) : null,
  };
}

/**
 * Transform API AI insight to MentionAIInsights format
 */
function transformAIInsight(insight: MentionAIInsight): MentionItem['aiInsights'] {
  return {
    id: insight.id,
    messageId: insight.message_id,
    modelVersion: insight.model_version,
    summary: insight.summary,
    painPoint: insight.pain_point,
    painPointQuote: insight.pain_point_quote,
    featureRequest: insight.feature_request,
    customerUsecase: insight.customer_usecase,
    sentiment: insight.sentiment as 'positive' | 'neutral' | 'negative' | null,
    keywords: insight.keywords || [],
    tokensUsed: insight.tokens_used,
    createdAt: insight.created_at,
  };
}
