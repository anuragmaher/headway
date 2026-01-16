import api from './api';

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  member_count?: number;
  purpose?: string;
  topic?: string;
}

export interface SlackTokensRequest {
  user_token: string;
}

export interface SlackChannelsResponse {
  channels: SlackChannel[];
  team_id: string;
  team_name: string;
}

export interface SlackConnectionRequest {
  user_token: string;
  selected_channels: string[];
}

export interface SlackConnectionResponse {
  integration_id: string;
  team_name: string;
  channels: SlackChannel[];
  status: string;
}

export interface SlackIntegration {
  id: string;
  name: string;
  team_name: string;
  team_id: string;
  status: string;
  last_synced?: string;
  channels: Array<{
    id: string;
    name: string;
    is_private: boolean;
    member_count?: number;
  }>;
  created_at: string;
}

class SlackService {
  /**
   * Validate Slack tokens and get available channels
   */
  async validateTokensAndGetChannels(tokens: SlackTokensRequest): Promise<SlackChannelsResponse> {
    const response = await api.post<SlackChannelsResponse>('/api/v1/slack/validate-tokens', tokens);
    return response.data;
  }

  /**
   * Connect Slack workspace with selected channels
   */
  async connectWorkspace(request: SlackConnectionRequest): Promise<SlackConnectionResponse> {
    const response = await api.post<SlackConnectionResponse>('/api/v1/slack/connect', request);
    return response.data;
  }

  /**
   * Get all Slack integrations for the workspace
   */
  async getIntegrations(): Promise<SlackIntegration[]> {
    const response = await api.get<SlackIntegration[]>('/api/v1/slack/integrations');
    return response.data;
  }

  /**
   * Disconnect a Slack integration
   */
  async disconnectIntegration(integrationId: string): Promise<{ message: string }> {
    console.log("slackService.disconnectIntegration called with ID:", integrationId);
    try {
      const response = await api.delete<{ message: string }>(`/api/v1/slack/integrations/${integrationId}`);
      console.log("Disconnect API response:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("Disconnect API error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
      });
      throw error;
    }
  }
}

export const slackService = new SlackService();