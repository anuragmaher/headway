/**
 * Messages Store
 * Manages state for messages, AI insights, and sync history
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { messagesApi } from '@/services/messages.api';
import type {
  Message,
  MessageWithInsights,
  AIInsight,
  SyncHistoryItem,
  MessageStats,
} from '@/shared/types/api.types';

interface MessagesState {
  // Data
  messages: Message[];
  selectedMessage: MessageWithInsights | null;
  insights: AIInsight[];
  syncHistory: SyncHistoryItem[];
  stats: MessageStats | null;

  // Pagination
  totalMessages: number;
  currentPage: number;
  pageSize: number;

  // Loading states
  isLoading: boolean;
  isLoadingMessage: boolean;
  isLoadingInsights: boolean;
  isLoadingSyncHistory: boolean;

  // Filters
  filters: {
    source?: string;
    connector_id?: string;
    customer_ask_id?: string;
    is_processed?: boolean;
  };

  // Error state
  error: string | null;

  // Message Actions
  fetchMessages: (page?: number, pageSize?: number) => Promise<void>;
  fetchMessage: (messageId: string) => Promise<void>;
  searchMessages: (query: string) => Promise<Message[]>;
  assignToCustomerAsk: (messageId: string, customerAskId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  fetchStats: () => Promise<void>;

  // Filter Actions
  setFilters: (filters: MessagesState['filters']) => void;
  clearFilters: () => void;

  // Insight Actions
  fetchInsights: (params?: {
    theme_id?: string;
    sub_theme_id?: string;
    customer_ask_id?: string;
    page?: number;
  }) => Promise<void>;

  // Sync History Actions
  fetchSyncHistory: (params?: {
    sync_type?: string;
    connector_id?: string;
    page?: number;
  }) => Promise<void>;

  // Selection
  setSelectedMessage: (message: MessageWithInsights | null) => void;

  // Utility
  clearError: () => void;
}

export const useMessagesStore = create<MessagesState>()(
  devtools(
    (set, get) => ({
      // Initial state
      messages: [],
      selectedMessage: null,
      insights: [],
      syncHistory: [],
      stats: null,
      totalMessages: 0,
      currentPage: 1,
      pageSize: 50,
      isLoading: false,
      isLoadingMessage: false,
      isLoadingInsights: false,
      isLoadingSyncHistory: false,
      filters: {},
      error: null,

      // Message Actions
      fetchMessages: async (page = 1, pageSize = 50) => {
        set({ isLoading: true, error: null, currentPage: page, pageSize });
        try {
          const { filters } = get();
          const response = await messagesApi.listMessages({
            ...filters,
            page,
            page_size: pageSize,
          });
          set({
            messages: response.messages,
            totalMessages: response.total,
            isLoading: false,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to fetch messages',
            isLoading: false,
          });
        }
      },

      fetchMessage: async (messageId) => {
        set({ isLoadingMessage: true, error: null });
        try {
          const message = await messagesApi.getMessage(messageId);
          set({ selectedMessage: message, isLoadingMessage: false });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to fetch message',
            isLoadingMessage: false,
          });
        }
      },

      searchMessages: async (query) => {
        try {
          return await messagesApi.searchMessages(query);
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to search messages',
          });
          return [];
        }
      },

      assignToCustomerAsk: async (messageId, customerAskId) => {
        try {
          const updated = await messagesApi.assignToCustomerAsk(
            messageId,
            customerAskId
          );
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === messageId ? updated : m
            ),
            selectedMessage:
              state.selectedMessage?.id === messageId
                ? { ...state.selectedMessage, ...updated }
                : state.selectedMessage,
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to assign message to customer ask',
          });
          throw error;
        }
      },

      deleteMessage: async (messageId) => {
        try {
          await messagesApi.deleteMessage(messageId);
          set((state) => ({
            messages: state.messages.filter((m) => m.id !== messageId),
            selectedMessage:
              state.selectedMessage?.id === messageId
                ? null
                : state.selectedMessage,
            totalMessages: state.totalMessages - 1,
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to delete message',
          });
          throw error;
        }
      },

      fetchStats: async () => {
        try {
          const stats = await messagesApi.getMessageStats();
          set({ stats });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch message stats',
          });
        }
      },

      // Filter Actions
      setFilters: (filters) => {
        set({ filters });
        // Refetch with new filters
        get().fetchMessages(1, get().pageSize);
      },

      clearFilters: () => {
        set({ filters: {} });
        get().fetchMessages(1, get().pageSize);
      },

      // Insight Actions
      fetchInsights: async (params = {}) => {
        set({ isLoadingInsights: true, error: null });
        try {
          const response = await messagesApi.listInsights(params);
          set({ insights: response.insights, isLoadingInsights: false });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to fetch insights',
            isLoadingInsights: false,
          });
        }
      },

      // Sync History Actions
      fetchSyncHistory: async (params = {}) => {
        set({ isLoadingSyncHistory: true, error: null });
        try {
          const response = await messagesApi.listSyncHistory(params);
          set({ syncHistory: response.history, isLoadingSyncHistory: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch sync history',
            isLoadingSyncHistory: false,
          });
        }
      },

      // Selection
      setSelectedMessage: (message) => set({ selectedMessage: message }),

      // Utility
      clearError: () => set({ error: null }),
    }),
    { name: 'messages-store' }
  )
);

export default useMessagesStore;
