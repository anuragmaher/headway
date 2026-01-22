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
    console.log('[Explorer] Fetching themes...');
    set({ isLoadingThemes: true, themesError: null });

    try {
      // Use /api/v1/themes endpoint which gets workspace from auth context
      const response = await api.get(`/api/v1/themes`);

      // Transform API response to ExplorerTheme format
      // Response is { themes: [...], total: N }
      const themesData = response.data?.themes || response.data || [];
      const themes: ExplorerTheme[] = themesData.map((theme: Record<string, unknown>) => ({
        id: theme.id as string,
        name: theme.name as string,
        description: (theme.description as string) || '',
        color: (theme.color as string) || '#1976D2',
        feedbackCount: (theme.customer_ask_count as number) || 0,
        subThemeCount: (theme.sub_theme_count as number) || 0,
        isAIGenerated: false,
        isLocked: false,
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
    set({ isLoadingThemes: true });

    try {
      // Use /api/v1/themes endpoint
      const response = await api.post(`/api/v1/themes`, {
        name: input.name,
        description: input.description,
      });

      const newTheme: ExplorerTheme = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description || '',
        color: input.color || '#1976D2',
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
    try {
      // Use /api/v1/themes endpoint with PATCH
      await api.patch(`/api/v1/themes/${themeId}`, {
        name: input.name,
        description: input.description,
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
    try {
      // Use /api/v1/themes endpoint
      await api.delete(`/api/v1/themes/${themeId}`);

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
