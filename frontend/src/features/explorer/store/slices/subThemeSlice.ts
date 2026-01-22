/**
 * SubTheme Slice - Manages sub-theme data and actions
 * Uses the themes API for sub-theme CRUD operations
 */
import { StateCreator } from 'zustand';
import type {
  ExplorerSubTheme,
  CreateSubThemeInput,
  UpdateSubThemeInput,
  MergeSubThemesInput,
} from '../../types';
import type { ExplorerStore } from '../explorerStore';
import { themesApi } from '../../../../services/themes.api';

export interface SubThemeState {
  subThemes: ExplorerSubTheme[];
  isLoadingSubThemes: boolean;
  subThemesError: string | null;
}

export interface SubThemeActions {
  fetchSubThemes: (themeId: string) => Promise<void>;
  createSubTheme: (input: CreateSubThemeInput) => Promise<ExplorerSubTheme>;
  updateSubTheme: (subThemeId: string, input: UpdateSubThemeInput) => Promise<void>;
  deleteSubTheme: (subThemeId: string) => Promise<void>;
  mergeSubThemes: (input: MergeSubThemesInput) => Promise<void>;
  lockSubTheme: (subThemeId: string) => Promise<void>;
  unlockSubTheme: (subThemeId: string) => Promise<void>;
  setSubThemes: (subThemes: ExplorerSubTheme[]) => void;
  clearSubThemes: () => void;
  clearSubThemesError: () => void;
}

export type SubThemeSlice = SubThemeState & SubThemeActions;

const initialSubThemeState: SubThemeState = {
  subThemes: [],
  isLoadingSubThemes: false,
  subThemesError: null,
};

export const createSubThemeSlice: StateCreator<
  ExplorerStore,
  [],
  [],
  SubThemeSlice
> = (set, get) => ({
  ...initialSubThemeState,

  fetchSubThemes: async (themeId: string) => {
    set({ isLoadingSubThemes: true, subThemesError: null });

    try {
      console.log('[Explorer] Fetching sub-themes for theme:', themeId);
      const response = await themesApi.listSubThemes(themeId);

      // Transform API response to ExplorerSubTheme format
      const subThemes: ExplorerSubTheme[] = response.sub_themes.map((st) => ({
        id: st.id,
        themeId: st.theme_id,
        name: st.name,
        description: st.description || '',
        feedbackCount: st.customer_ask_count || 0,
        customerAskCount: st.customer_ask_count || 0,
        isAIGenerated: false,
        isLocked: false,
        topFeedbackPreview: st.description?.slice(0, 100),
        createdAt: st.created_at,
        updatedAt: st.updated_at || st.created_at,
      }));

      console.log('[Explorer] Received sub-themes:', subThemes.length, 'items');
      set({ subThemes, isLoadingSubThemes: false });
    } catch (error) {
      console.error('[Explorer] Failed to fetch sub-themes:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch sub-themes';
      set({ subThemesError: message, isLoadingSubThemes: false });
    }
  },

  createSubTheme: async (input: CreateSubThemeInput) => {
    set({ isLoadingSubThemes: true });

    try {
      const subTheme = await themesApi.createSubTheme({
        name: input.name,
        description: input.description,
        theme_id: input.themeId,
      });

      const newSubTheme: ExplorerSubTheme = {
        id: subTheme.id,
        themeId: subTheme.theme_id,
        name: subTheme.name,
        description: subTheme.description || '',
        feedbackCount: 0,
        customerAskCount: 0,
        isAIGenerated: false,
        isLocked: false,
        createdAt: subTheme.created_at,
        updatedAt: subTheme.updated_at || subTheme.created_at,
      };

      set((state) => ({
        subThemes: [...state.subThemes, newSubTheme],
        isLoadingSubThemes: false,
      }));

      return newSubTheme;
    } catch (error) {
      set({ isLoadingSubThemes: false });
      throw error;
    }
  },

  updateSubTheme: async (subThemeId: string, input: UpdateSubThemeInput) => {
    try {
      await themesApi.updateSubTheme(subThemeId, {
        name: input.name,
        description: input.description,
      });

      set((state) => ({
        subThemes: state.subThemes.map((subTheme) =>
          subTheme.id === subThemeId
            ? { ...subTheme, ...input, updatedAt: new Date().toISOString() }
            : subTheme
        ),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update sub-theme';
      set({ subThemesError: message });
      throw error;
    }
  },

  deleteSubTheme: async (subThemeId: string) => {
    try {
      await themesApi.deleteSubTheme(subThemeId);

      set((state) => ({
        subThemes: state.subThemes.filter((subTheme) => subTheme.id !== subThemeId),
        selectedSubThemeId: state.selectedSubThemeId === subThemeId ? null : state.selectedSubThemeId,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete sub-theme';
      set({ subThemesError: message });
      throw error;
    }
  },

  mergeSubThemes: async (input: MergeSubThemesInput) => {
    try {
      // Merge functionality - move sub-theme to another theme
      await themesApi.moveSubTheme(input.sourceId, input.targetId);

      // Remove source sub-theme and update target's feedback count
      set((state) => {
        const sourceSubTheme = state.subThemes.find((st) => st.id === input.sourceId);
        const additionalCount = sourceSubTheme?.feedbackCount || 0;

        return {
          subThemes: state.subThemes
            .filter((subTheme) => subTheme.id !== input.sourceId)
            .map((subTheme) =>
              subTheme.id === input.targetId
                ? { ...subTheme, feedbackCount: subTheme.feedbackCount + additionalCount }
                : subTheme
            ),
          selectedSubThemeId: state.selectedSubThemeId === input.sourceId
            ? input.targetId
            : state.selectedSubThemeId,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to merge sub-themes';
      set({ subThemesError: message });
      throw error;
    }
  },

  lockSubTheme: async (subThemeId: string) => {
    await get().updateSubTheme(subThemeId, { isLocked: true });
  },

  unlockSubTheme: async (subThemeId: string) => {
    await get().updateSubTheme(subThemeId, { isLocked: false });
  },

  setSubThemes: (subThemes: ExplorerSubTheme[]) => {
    set({ subThemes });
  },

  clearSubThemes: () => {
    set({ subThemes: [], selectedSubThemeId: null });
  },

  clearSubThemesError: () => {
    set({ subThemesError: null });
  },
});
