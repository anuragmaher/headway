/**
 * Connectors API Service
 * Handles all connector-related API calls (Slack, Gmail, Gong, Fathom)
 */
import api from './api';
import type {
  Connector,
  ConnectorListResponse,
  ConnectorLabel,
  SlackChannel,
  GmailLabel,
  ConnectorType,
} from '@/shared/types/api.types';

const BASE_URL = '/connectors';

export interface CreateAPIConnectorRequest {
  connector_type: ConnectorType;
  name: string;
  api_key: string;
  api_secret?: string;
  base_url?: string;
}

export interface UpdateConnectorRequest {
  name?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
}

export interface SyncStatusResponse {
  connector_id: string;
  status: string;
  last_synced_at: string | null;
  items_synced: number;
  error_message?: string;
}

export const connectorsApi = {
  // === List & Get ===

  async listConnectors(
    connectorType?: ConnectorType,
    isActive?: boolean
  ): Promise<ConnectorListResponse> {
    const params = new URLSearchParams();
    if (connectorType) params.append('connector_type', connectorType);
    if (isActive !== undefined) params.append('is_active', String(isActive));

    const response = await api.get<ConnectorListResponse>(
      `${BASE_URL}?${params.toString()}`
    );
    return response.data;
  },

  async getConnector(connectorId: string): Promise<Connector> {
    const response = await api.get<Connector>(`${BASE_URL}/${connectorId}`);
    return response.data;
  },

  // === Create ===

  async createAPIConnector(data: CreateAPIConnectorRequest): Promise<Connector> {
    const response = await api.post<Connector>(`${BASE_URL}/api-connector`, data);
    return response.data;
  },

  // === Update & Delete ===

  async updateConnector(
    connectorId: string,
    data: UpdateConnectorRequest
  ): Promise<Connector> {
    const response = await api.patch<Connector>(`${BASE_URL}/${connectorId}`, data);
    return response.data;
  },

  async deleteConnector(connectorId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${connectorId}`);
  },

  async deactivateConnector(connectorId: string): Promise<Connector> {
    const response = await api.post<Connector>(
      `${BASE_URL}/${connectorId}/deactivate`
    );
    return response.data;
  },

  // === Labels ===

  async getLabels(connectorId: string): Promise<ConnectorLabel[]> {
    const response = await api.get<ConnectorLabel[]>(
      `${BASE_URL}/${connectorId}/labels`
    );
    return response.data;
  },

  async updateEnabledLabels(
    connectorId: string,
    labelIds: string[]
  ): Promise<ConnectorLabel[]> {
    const response = await api.put<ConnectorLabel[]>(
      `${BASE_URL}/${connectorId}/labels`,
      labelIds
    );
    return response.data;
  },

  // === Sync ===

  async triggerSync(
    connectorId: string,
    fullSync = false
  ): Promise<SyncStatusResponse> {
    const response = await api.post<SyncStatusResponse>(
      `${BASE_URL}/${connectorId}/sync`,
      null,
      { params: { full_sync: fullSync } }
    );
    return response.data;
  },

  async getSyncStatus(connectorId: string): Promise<SyncStatusResponse> {
    const response = await api.get<SyncStatusResponse>(
      `${BASE_URL}/${connectorId}/sync-status`
    );
    return response.data;
  },
};

// === Slack-specific API ===

export const slackApi = {
  async getOAuthUrl(): Promise<{ url: string }> {
    const response = await api.get<{ url: string }>('/slack/oauth-url');
    return response.data;
  },

  async handleCallback(code: string, state?: string): Promise<Connector> {
    const response = await api.post<Connector>('/slack/callback', { code, state });
    return response.data;
  },

  async getChannels(connectorId: string): Promise<SlackChannel[]> {
    const response = await api.get<SlackChannel[]>(
      `/slack/${connectorId}/channels`
    );
    return response.data;
  },

  async updateSelectedChannels(
    connectorId: string,
    channelIds: string[]
  ): Promise<ConnectorLabel[]> {
    return connectorsApi.updateEnabledLabels(connectorId, channelIds);
  },

  async disconnect(connectorId: string): Promise<void> {
    await connectorsApi.deleteConnector(connectorId);
  },
};

// === Gmail-specific API ===

export const gmailApi = {
  async getOAuthUrl(): Promise<{ url: string }> {
    const response = await api.get<{ url: string }>('/gmail/oauth-url');
    return response.data;
  },

  async handleCallback(code: string, state?: string): Promise<Connector> {
    const response = await api.post<Connector>('/gmail/callback', { code, state });
    return response.data;
  },

  async getLabels(connectorId: string): Promise<GmailLabel[]> {
    const response = await api.get<GmailLabel[]>(`/gmail/${connectorId}/labels`);
    return response.data;
  },

  async updateSelectedLabels(
    connectorId: string,
    labelIds: string[]
  ): Promise<ConnectorLabel[]> {
    return connectorsApi.updateEnabledLabels(connectorId, labelIds);
  },

  async disconnect(connectorId: string): Promise<void> {
    await connectorsApi.deleteConnector(connectorId);
  },
};

export default connectorsApi;
