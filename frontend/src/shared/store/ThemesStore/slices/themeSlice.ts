/**
 * Theme slice - Handles theme-related state and actions
 */

import { StateCreator } from 'zustand';
import { ThemesPageStore, ThemeState, ThemeActions } from '../types';
import { Theme, ThemeFormData, ThemeWithChildren } from '../../../types/ThemesTypes';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthToken, getWorkspaceId, buildThemeHierarchy, flattenThemes } from '../utils';

export const initialThemeState: ThemeState = {
  themes: [],
  hierarchicalThemes: [],
  flattenedThemes: [],
  selectedThemeForDrawer: null,
  expandedThemes: new Set(),
  loading: true,
};

export const createThemeSlice: StateCreator<
  ThemesPageStore,
  [],
  [],
  ThemeState & ThemeActions
> = (set, get) => ({
  ...initialThemeState,

  setThemes: (themes: Theme[]) => {
    const hierarchicalThemes = buildThemeHierarchy(themes);
    const flattenedThemes = flattenThemes(hierarchicalThemes);
    set({ themes, hierarchicalThemes, flattenedThemes });
  },

  fetchThemes: async () => {
    try {
      set({ loading: true, error: null });
      const workspaceId = getWorkspaceId();
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch themes: ${response.status}`);
      }

      const themesData = await response.json();
      get().setThemes(themesData);
    } catch (error) {
      console.error('Error fetching themes:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load themes' });
    } finally {
      set({ loading: false });
    }
  },

  createTheme: async (formData: ThemeFormData) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes?workspace_id=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create theme: ${response.status}`);
    }

    await get().fetchThemes();
  },

  createMultipleThemes: async (themes: Array<{ name: string; description: string; parent_theme_id: string | null }>) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();
    const createdThemes: Theme[] = [];

    for (const themeData of themes) {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${workspaceId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(themeData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create theme: ${response.status}`);
      }

      const createdTheme = await response.json();
      createdThemes.push(createdTheme);
    }

    await get().fetchThemes();
  },

  updateTheme: async (themeId: string, formData: ThemeFormData) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes/${themeId}?workspace_id=${workspaceId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update theme: ${response.status}`);
    }

    await get().fetchThemes();
  },

  deleteTheme: async (themeId: string) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes/${themeId}?workspace_id=${workspaceId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete theme: ${response.status}`);
    }

    await get().fetchThemes();
  },

  setSelectedThemeForDrawer: (theme: Theme | null) => set({ selectedThemeForDrawer: theme }),

  toggleThemeExpansion: (themeId: string) => {
    set(state => {
      const newExpandedThemes = new Set(state.expandedThemes);
      if (newExpandedThemes.has(themeId)) {
        newExpandedThemes.delete(themeId);
      } else {
        newExpandedThemes.add(themeId);
      }
      return { expandedThemes: newExpandedThemes };
    });
  },
});
