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

  // Mentions state
  mentions: MentionItem[];
  totalMentions: number;
  hasMoreMentions: boolean;
  mentionsNextCursor: string | null;
  isLoadingMentions: boolean;
  isLoadingMoreMentions: boolean;
  mentionsError: string | null;

  // Selected CustomerAsk
  selectedCustomerAskId: string | null;

  // Mentions panel state
  isMentionsPanelOpen: boolean;
  expandedMentionId: string | null;
}

export interface CustomerAskActions {
  // CustomerAsk actions
  fetchCustomerAsks: (subThemeId: string) => Promise<void>;
  selectCustomerAsk: (customerAskId: string | null) => void;
  updateCustomerAskStatus: (customerAskId: string, status: CustomerAskStatus) => Promise<void>;
  clearCustomerAsks: () => void;
  clearCustomerAsksError: () => void;

  // Mentions actions
  fetchMentions: (customerAskId: string) => Promise<void>;
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

  mentions: [],
  totalMentions: 0,
  hasMoreMentions: false,
  mentionsNextCursor: null,
  isLoadingMentions: false,
  isLoadingMoreMentions: false,
  mentionsError: null,

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
    set({ isLoadingCustomerAsks: true, customerAsksError: null });

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

      set({
        customerAsks,
        totalCustomerAsks: response.total,
        isLoadingCustomerAsks: false,
      });
    } catch (error) {
      console.error('[Explorer] Failed to fetch customer asks:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch customer asks';
      set({ customerAsksError: message, isLoadingCustomerAsks: false });
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
    set({ isLoadingMentions: true, mentionsError: null });

    try {
      console.log('[Explorer] Fetching mentions for customer ask:', customerAskId);
      const response = await themesApi.getMentionsForCustomerAsk(customerAskId);

      const mentions: MentionItem[] = response.mentions.map((m: Mention) =>
        transformMention(m)
      );

      console.log('[Explorer] Received mentions:', mentions.length, 'items');

      set({
        mentions,
        totalMentions: response.total,
        hasMoreMentions: response.has_more,
        mentionsNextCursor: response.next_cursor,
        isLoadingMentions: false,
      });
    } catch (error) {
      console.error('[Explorer] Failed to fetch mentions:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch mentions';
      set({ mentionsError: message, isLoadingMentions: false });
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
        offset
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
 */
function transformMention(mention: Mention): MentionItem {
  return {
    id: mention.id,
    customerAskId: mention.customer_ask_id,
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
