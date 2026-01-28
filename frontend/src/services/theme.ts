/**
 * Theme management service
 */

import api from './api';

export interface ThemeSuggestion {
  name: string;
  description: string;
}

export interface FeatureSuggestion {
  name: string;
  description: string;
}

export interface ThemeSlackConnectRequest {
  connector_id: string;
  channel_id: string;
  channel_name: string;
}

export interface ThemeSlackConnectionResponse {
  theme_id: string;
  slack_integration_id: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
  connected: boolean;
}

export const themeService = {
  /**
   * Generate AI-powered theme suggestions based on company details
   */
  generateThemeSuggestions: async (
    workspaceId: string,
    existingThemes: ThemeSuggestion[] = [],
    alreadySuggested: ThemeSuggestion[] = []
  ): Promise<ThemeSuggestion[]> => {
    const response = await api.post(
      `/api/v1/workspaces/${workspaceId}/generate-theme-suggestions`,
      {
        already_suggested: [...existingThemes, ...alreadySuggested],
      }
    );

    if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
      return response.data.suggestions;
    }

    throw new Error('No suggestions generated');
  },

  /**
   * Generate AI-powered feature suggestions based on company details and selected theme
   */
  generateFeatureSuggestions: async (
    workspaceId: string,
    themeName: string,
    existingFeatures: FeatureSuggestion[] = [],
    alreadySuggested: FeatureSuggestion[] = []
  ): Promise<FeatureSuggestion[]> => {
    const response = await api.post(
      `/api/v1/workspaces/${workspaceId}/generate-feature-suggestions`,
      {
        theme_name: themeName,
        existing_features: existingFeatures,
        already_suggested: alreadySuggested,
      }
    );

    if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
      return response.data.suggestions;
    }

    throw new Error('No suggestions generated');
  },

  /**
   * Connect a theme to a Slack channel for notifications
   */
  connectThemeToSlack: async (
    themeId: string,
    request: ThemeSlackConnectRequest
  ): Promise<ThemeSlackConnectionResponse> => {
    const response = await api.post<ThemeSlackConnectionResponse>(
      `/api/v1/themes/${themeId}/slack/connect`,
      {
        connector_id: request.connector_id,
        channel_id: request.channel_id,
        channel_name: request.channel_name,
      }
    );
    return response.data;
  },

  /**
   * Disconnect a theme from Slack
   */
  disconnectThemeFromSlack: async (
    themeId: string
  ): Promise<ThemeSlackConnectionResponse> => {
    const response = await api.delete<ThemeSlackConnectionResponse>(
      `/api/v1/themes/${themeId}/slack/disconnect`
    );
    return response.data;
  },

  /**
   * Get the Slack connection status for a theme
   */
  getThemeSlackStatus: async (
    themeId: string
  ): Promise<ThemeSlackConnectionResponse> => {
    const response = await api.get<ThemeSlackConnectionResponse>(
      `/api/v1/themes/${themeId}/slack/status`
    );
    return response.data;
  },
};
