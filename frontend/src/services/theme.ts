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
  integration_id: string;
  channel_id: string;
  channel_name: string;
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
   * Connect a theme to a Slack channel
   */
  connectThemeToSlack: async (
    themeId: string,
    workspaceId: string,
    request: ThemeSlackConnectRequest
  ): Promise<any> => {
    const response = await api.post(
      `/api/v1/features/themes/${themeId}/slack/connect?workspace_id=${workspaceId}`,
      {
        integration_id: request.integration_id,
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
    themeId: string,
    workspaceId: string
  ): Promise<any> => {
    const response = await api.delete(
      `/api/v1/features/themes/${themeId}/slack/disconnect?workspace_id=${workspaceId}`
    );
    return response.data;
  },
};
