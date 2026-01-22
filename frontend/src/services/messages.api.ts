/**
 * Messages API Service
 * Handles messages, AI insights, and sync history
 */
import api from './api';
import type {
  Message,
  MessageListResponse,
  MessageWithInsights,
  AIInsight,
  AIInsightListResponse,
  SyncHistoryItem,
  SyncHistoryListResponse,
  MessageStats,
} from '@/shared/types/api.types';

const BASE_URL = '/messages';

export interface ListMessagesParams {
  source?: string;
  connector_id?: string;
  customer_ask_id?: string;
  is_processed?: boolean;
  page?: number;
  page_size?: number;
}

export interface ListInsightsParams {
  theme_id?: string;
  sub_theme_id?: string;
  customer_ask_id?: string;
  page?: number;
  page_size?: number;
}

export interface ListSyncHistoryParams {
  sync_type?: string;
  connector_id?: string;
  page?: number;
  page_size?: number;
}

export const messagesApi = {
  // === Messages ===

  async listMessages(params: ListMessagesParams = {}): Promise<MessageListResponse> {
    const searchParams = new URLSearchParams();

    if (params.source) searchParams.append('source', params.source);
    if (params.connector_id) searchParams.append('connector_id', params.connector_id);
    if (params.customer_ask_id)
      searchParams.append('customer_ask_id', params.customer_ask_id);
    if (params.is_processed !== undefined)
      searchParams.append('is_processed', String(params.is_processed));
    if (params.page) searchParams.append('page', String(params.page));
    if (params.page_size) searchParams.append('page_size', String(params.page_size));

    const response = await api.get<MessageListResponse>(
      `${BASE_URL}?${searchParams.toString()}`
    );
    return response.data;
  },

  async getMessage(messageId: string): Promise<MessageWithInsights> {
    const response = await api.get<MessageWithInsights>(`${BASE_URL}/${messageId}`);
    return response.data;
  },

  async getMessageStats(): Promise<MessageStats> {
    const response = await api.get<MessageStats>(`${BASE_URL}/stats`);
    return response.data;
  },

  async searchMessages(query: string, limit = 50): Promise<Message[]> {
    const response = await api.get<Message[]>(`${BASE_URL}/search`, {
      params: { q: query, limit },
    });
    return response.data;
  },

  async assignToCustomerAsk(
    messageId: string,
    customerAskId: string
  ): Promise<Message> {
    const response = await api.post<Message>(
      `${BASE_URL}/${messageId}/assign-customer-ask`,
      null,
      { params: { customer_ask_id: customerAskId } }
    );
    return response.data;
  },

  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${messageId}`);
  },

  // === AI Insights ===

  async listInsights(params: ListInsightsParams = {}): Promise<AIInsightListResponse> {
    const searchParams = new URLSearchParams();

    if (params.theme_id) searchParams.append('theme_id', params.theme_id);
    if (params.sub_theme_id) searchParams.append('sub_theme_id', params.sub_theme_id);
    if (params.customer_ask_id)
      searchParams.append('customer_ask_id', params.customer_ask_id);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.page_size) searchParams.append('page_size', String(params.page_size));

    const response = await api.get<AIInsightListResponse>(
      `${BASE_URL}/insights?${searchParams.toString()}`
    );
    return response.data;
  },

  async getInsight(insightId: string): Promise<AIInsight> {
    const response = await api.get<AIInsight>(`${BASE_URL}/insights/${insightId}`);
    return response.data;
  },

  // === Sync History ===

  async listSyncHistory(
    params: ListSyncHistoryParams = {}
  ): Promise<SyncHistoryListResponse> {
    const searchParams = new URLSearchParams();

    if (params.sync_type) searchParams.append('sync_type', params.sync_type);
    if (params.connector_id) searchParams.append('connector_id', params.connector_id);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.page_size) searchParams.append('page_size', String(params.page_size));

    const response = await api.get<SyncHistoryListResponse>(
      `${BASE_URL}/sync-history?${searchParams.toString()}`
    );
    return response.data;
  },

  async getSyncHistory(syncId: string): Promise<SyncHistoryItem> {
    const response = await api.get<SyncHistoryItem>(
      `${BASE_URL}/sync-history/${syncId}`
    );
    return response.data;
  },
};

export default messagesApi;
