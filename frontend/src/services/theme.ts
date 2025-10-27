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

export const themeService = {
  /**
   * Generate AI-powered theme suggestions based on company details
   */
  generateThemeSuggestions: async (
    workspaceId: string,
    alreadySuggested: ThemeSuggestion[] = []
  ): Promise<ThemeSuggestion[]> => {
    const response = await api.post(
      `/api/v1/workspaces/${workspaceId}/generate-theme-suggestions`,
      {
        already_suggested: alreadySuggested,
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
    alreadySuggested: FeatureSuggestion[] = []
  ): Promise<FeatureSuggestion[]> => {
    const response = await api.post(
      `/api/v1/workspaces/${workspaceId}/generate-feature-suggestions`,
      {
        theme_name: themeName,
        already_suggested: alreadySuggested,
      }
    );

    if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
      return response.data.suggestions;
    }

    throw new Error('No suggestions generated');
  },
};
