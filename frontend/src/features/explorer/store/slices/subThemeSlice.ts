/**
 * SubTheme Slice - Manages sub-theme data and actions
 */
import { StateCreator } from 'zustand';
import type {
  ExplorerSubTheme,
  CreateSubThemeInput,
  UpdateSubThemeInput,
  MergeSubThemesInput,
} from '../../types';
import type { ExplorerStore } from '../explorerStore';
import api from '../../../../services/api';

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
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) return;

    set({ isLoadingSubThemes: true, subThemesError: null });

    try {
      // Fetch features that belong to this theme (they act as sub-themes)
      const response = await api.get(`/api/v1/features/features`, {
        params: {
          workspace_id: workspaceId,
          theme_id: themeId,
        },
      });

      // Transform API response to ExplorerSubTheme format
      // Features under a theme act as sub-themes (feature requests grouped under a theme)
      const subThemes: ExplorerSubTheme[] = (response.data || []).map((feature: Record<string, unknown>) => ({
        id: feature.id as string,
        themeId: (feature.theme_id as string) || themeId,
        name: feature.name as string,
        description: (feature.description as string) || '',
        feedbackCount: (feature.mention_count as number) || 0,
        isAIGenerated: (feature.is_ai_generated as boolean) || false,
        isLocked: (feature.is_locked as boolean) || false,
        topFeedbackPreview: (feature.description as string)?.slice(0, 100),
        createdAt: feature.created_at as string,
        updatedAt: feature.updated_at as string,
        urgency: (feature.urgency as string) || 'medium',
        status: (feature.status as string) || 'new',
      }));

      set({ subThemes, isLoadingSubThemes: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sub-themes';
      set({ subThemesError: message, isLoadingSubThemes: false });
    }
  },

  createSubTheme: async (input: CreateSubThemeInput) => {
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    set({ isLoadingSubThemes: true });

    try {
      const response = await api.post(`/api/v1/features/features`, {
        name: input.name,
        description: input.description,
        theme_id: input.themeId,
      }, {
        params: { workspace_id: workspaceId },
      });

      const newSubTheme: ExplorerSubTheme = {
        id: response.data.id,
        themeId: input.themeId,
        name: response.data.name,
        description: response.data.description || '',
        feedbackCount: 0,
        isAIGenerated: false,
        isLocked: false,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
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
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      await api.put(`/api/v1/features/features/${subThemeId}`, input, {
        params: { workspace_id: workspaceId },
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
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      await api.delete(`/api/v1/features/features/${subThemeId}`, {
        params: { workspace_id: workspaceId },
      });

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
    const workspaceId = get().getWorkspaceId();
    if (!workspaceId) throw new Error('No workspace selected');

    try {
      // Call merge API endpoint
      await api.post(`/api/v1/features/features/${input.targetId}/merge`, {
        source_feature_id: input.sourceId,
      }, {
        params: { workspace_id: workspaceId },
      });

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
