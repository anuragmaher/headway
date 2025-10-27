/**
 * Theme management service
 */

import api from './api';

export interface ThemeSuggestion {
  name: string;
  description: string;
}

export const themeService = {
  /**
   * Generate AI-powered theme suggestions based on company details
   */
  generateThemeSuggestions: async (workspaceId: string): Promise<ThemeSuggestion[]> => {
    const response = await api.post(`/api/v1/workspaces/${workspaceId}/generate-theme-suggestions`, {});

    if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
      return response.data.suggestions;
    }

    throw new Error('No suggestions generated');
  },
};
