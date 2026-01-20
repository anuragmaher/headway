/**
 * Theme Slice - Manages theme data and actions
 */
import { StateCreator } from 'zustand';
import type {
  ExplorerTheme,
  CreateThemeInput,
  UpdateThemeInput,
} from '../../types';
import type { ExplorerStore } from '../explorerStore';
import api from '../../../../services/api';

export interface ThemeState {
  themes: ExplorerTheme[];
  isLoadingThemes: boolean;
  themesError: string | null;
}

export interface ThemeActions {
  fetchThemes: () => Promise<void>;
  createTheme: (input: CreateThemeInput) => Promise<ExplorerTheme>;
  updateTheme: (themeId: string, input: UpdateThemeInput) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  lockTheme: (themeId: string) => Promise<void>;
  unlockTheme: (themeId: string) => Promise<void>;
  setThemes: (themes: ExplorerTheme[]) => void;
  clearThemesError: () => void;
}

export type ThemeSlice = ThemeState & ThemeActions;

const initialThemeState: ThemeState = {
  themes: [],
  isLoadingThemes: false,
  themesError: null,
};

export const createThemeSlice: StateCreator<
  ExplorerStore,
  [],
  [],
  ThemeSlice
> = (set, get) => ({
  ...initialThemeState,

  fetchThemes: async () => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) {
      console.warn('[Explorer] No workspace ID available, cannot fetch themes');
      set({ themesError: 'No workspace selected', isLoadingThemes: false });
      return;
    }

    console.log('[Explorer] Fetching themes for workspace:', workspaceId);
    set({ isLoadingThemes: true, themesError: null });

    try {
      const response = await api.get(`/api/v1/features/themes`, {
        params: { workspace_id: workspaceId },
      });

      // Transform API response to ExplorerTheme format
      // Filter to only show root themes (parent_theme_id is null)
      const themes: ExplorerTheme[] = (response.data || [])
        .filter((theme: Record<string, unknown>) => !theme.parent_theme_id)
        .map((theme: Record<string, unknown>) => ({
          id: theme.id as string,
          name: theme.name as string,
          description: (theme.description as string) || '',
          color: (theme.color as string) || '#1976D2',
          feedbackCount: (theme.mention_count as number) || 0,
          subThemeCount: (theme.feature_count as number) || 0,
          isAIGenerated: (theme.is_ai_generated as boolean) || false,
          isLocked: (theme.is_locked as boolean) || false,
          createdAt: theme.created_at as string,
          updatedAt: theme.updated_at as string,
        }));

      console.log('[Explorer] Fetched themes:', themes.length, 'items');
      set({ themes, isLoadingThemes: false });
    } catch (error) {
      console.error('[Explorer] Failed to fetch themes:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch themes';
      set({ themesError: message, isLoadingThemes: false });
    }
  },

  createTheme: async (input: CreateThemeInput) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    set({ isLoadingThemes: true });

    try {
      const response = await api.post(`/api/v1/features/themes`, {
        name: input.name,
        description: input.description,
        color: input.color,
      }, {
        params: { workspace_id: workspaceId },
      });

      const newTheme: ExplorerTheme = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description || '',
        color: response.data.color || '#1976D2',
        feedbackCount: 0,
        subThemeCount: 0,
        isAIGenerated: false,
        isLocked: false,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };

      set((state) => ({
        themes: [...state.themes, newTheme],
        isLoadingThemes: false,
      }));

      return newTheme;
    } catch (error) {
      set({ isLoadingThemes: false });
      throw error;
    }
  },

  updateTheme: async (themeId: string, input: UpdateThemeInput) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      await api.put(`/api/v1/features/themes/${themeId}`, input, {
        params: { workspace_id: workspaceId },
      });

      set((state) => ({
        themes: state.themes.map((theme) =>
          theme.id === themeId
            ? { ...theme, ...input, updatedAt: new Date().toISOString() }
            : theme
        ),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update theme';
      set({ themesError: message });
      throw error;
    }
  },

  deleteTheme: async (themeId: string) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      await api.delete(`/api/v1/features/themes/${themeId}`, {
        params: { workspace_id: workspaceId },
      });

      set((state) => ({
        themes: state.themes.filter((theme) => theme.id !== themeId),
        // Clear selection if deleted theme was selected
        selectedThemeId: state.selectedThemeId === themeId ? null : state.selectedThemeId,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete theme';
      set({ themesError: message });
      throw error;
    }
  },

  lockTheme: async (themeId: string) => {
    await get().updateTheme(themeId, { isLocked: true });
  },

  unlockTheme: async (themeId: string) => {
    await get().updateTheme(themeId, { isLocked: false });
  },

  setThemes: (themes: ExplorerTheme[]) => {
    set({ themes });
  },

  clearThemesError: () => {
    set({ themesError: null });
  },
});
