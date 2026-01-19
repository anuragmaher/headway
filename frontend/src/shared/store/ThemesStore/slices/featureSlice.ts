/**
 * Feature slice - Handles feature-related state and actions
 */

import { StateCreator } from 'zustand';
import { ThemesPageStore, FeatureState, FeatureActions } from '../types';
import { Feature } from '../../../types/ThemesTypes';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthToken, getWorkspaceId } from '../utils';

export const initialFeatureState: FeatureState = {
  themeFeatures: [],
  selectedFeatureForMessages: null,
  loadingFeatures: false,
};

export const createFeatureSlice: StateCreator<
  ThemesPageStore,
  [],
  [],
  FeatureState & FeatureActions
> = (set, get) => ({
  ...initialFeatureState,

  fetchThemeFeatures: async (themeId: string) => {
    try {
      set({ loadingFeatures: true });
      const workspaceId = getWorkspaceId();
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${workspaceId}&theme_id=${themeId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const features = await response.json();
      set({ themeFeatures: features });
    } catch (error) {
      console.error('Error fetching theme features:', error);
      set({ themeFeatures: [] });
    } finally {
      set({ loadingFeatures: false });
    }
  },

  fetchAllFeatures: async () => {
    try {
      set({ loadingFeatures: true });
      const workspaceId = getWorkspaceId();
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const features = await response.json();
      set({ themeFeatures: features });
    } catch (error) {
      console.error('Error fetching all features:', error);
      set({ themeFeatures: [] });
    } finally {
      set({ loadingFeatures: false });
    }
  },

  updateFeature: async (featureId: string, data: { name: string; description: string }) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${workspaceId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update feature: ${response.status}`);
    }

    const updatedFeature = await response.json();
    set(state => ({
      themeFeatures: state.themeFeatures.map(f => f.id === featureId ? updatedFeature : f)
    }));

    await get().fetchThemes();
  },

  createFeature: async (data: { name: string; description: string; theme_id: string | null }) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/features?workspace_id=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create feature: ${response.status}`);
    }

    const newFeature = await response.json();
    set(state => ({
      themeFeatures: [...state.themeFeatures, newFeature]
    }));

    await get().fetchThemes();
  },

  createMultipleFeatures: async (features: Array<{ name: string; description: string }>, themeId: string | null) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();
    const createdFeatures: Feature[] = [];

    for (const feature of features) {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${workspaceId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...feature,
            theme_id: themeId
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create feature "${feature.name}": ${response.status}`);
      }

      const newFeature = await response.json();
      createdFeatures.push(newFeature);
    }

    set(state => ({
      themeFeatures: [...state.themeFeatures, ...createdFeatures]
    }));

    await get().fetchThemes();
  },

  deleteFeature: async (featureId: string) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${workspaceId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete feature: ${response.status}`);
    }

    set(state => ({
      themeFeatures: state.themeFeatures.filter(f => f.id !== featureId)
    }));

    await get().fetchThemes();
  },

  updateFeatureTheme: async (featureId: string, newThemeId: string | null) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${workspaceId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme_id: newThemeId })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update feature theme: ${response.status}`);
    }

    const { selectedThemeForDrawer, showingAllFeatures } = get();
    if (selectedThemeForDrawer) {
      await get().fetchThemeFeatures(selectedThemeForDrawer.id);
    } else if (showingAllFeatures) {
      await get().fetchAllFeatures();
    }

    await get().fetchThemes();
  },

  setSelectedFeatureForMessages: (feature: Feature | null) => set({ selectedFeatureForMessages: feature }),
});
