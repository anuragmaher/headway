/**
 * Zustand store for ThemesPage state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Theme,
  Feature,
  Message,
  ThemeFormData,
  ThemeWithChildren,
  MentionDetailsTab,
  DrawerLevel,
  FeatureFilters,
} from '../types';
import { ThemeSuggestion, FeatureSuggestion, themeService } from '@/services/theme';
import { API_BASE_URL } from '@/config/api.config';
import { useAuthStore } from '@/features/auth/store/auth-store';

interface ThemesPageState {
  // Theme data
  themes: Theme[];
  hierarchicalThemes: ThemeWithChildren[];
  flattenedThemes: Theme[];
  selectedThemeForDrawer: Theme | null;
  expandedThemes: Set<string>;

  // Feature data
  themeFeatures: Feature[];
  selectedFeatureForMessages: Feature | null;

  // Message data
  featureMessages: Message[];
  selectedMessageId: string | null;

  // Loading states
  loading: boolean;
  loadingFeatures: boolean;
  loadingMessages: boolean;
  loadingSuggestions: boolean;
  loadingMoreSuggestions: boolean;
  loadingFeatureSuggestions: boolean;
  loadingMoreFeatureSuggestions: boolean;

  // View states
  showingAllFeatures: boolean;
  showingAllFeaturesList: boolean;
  showingSubThemes: boolean;
  showMessagesFullPage: boolean;

  // Mobile states
  mobileThemesDrawerOpen: boolean;
  mentionsDrawerOpen: boolean;
  drawerLevel: DrawerLevel;

  // Filter and sort state
  filters: FeatureFilters;
  showFilters: boolean;

  // Dialog states
  dialogOpen: boolean;
  editingTheme: Theme | null;
  formData: ThemeFormData;
  suggestions: ThemeSuggestion[];
  selectedThemeSuggestions: Set<number>;
  savingTheme: boolean;
  themeError: string | null;

  // Feature dialog states
  editModalOpen: boolean;
  editingFeature: Feature | null;
  editFormData: { name: string; description: string };
  savingEdit: boolean;
  editError: string | null;

  addModalOpen: boolean;
  addFormData: { name: string; description: string };
  savingAdd: boolean;
  addError: string | null;
  featureSuggestions: FeatureSuggestion[];
  selectedSuggestions: Set<number>;

  // Delete states
  deleteConfirmOpen: boolean;
  featureToDelete: Feature | null;
  deletingFeature: boolean;

  deleteMentionConfirmOpen: boolean;
  mentionToDelete: Message | null;
  deletingMention: boolean;

  // Menu states
  menuAnchorEl: HTMLElement | null;
  selectedThemeForMenu: Theme | null;

  // Slack connect dialog state
  slackConnectDialogOpen: boolean;
  selectedThemeForSlack: Theme | null;

  // Tab state
  mentionDetailsTab: MentionDetailsTab;

  // Error and snackbar
  error: string | null;
  snackbarOpen: boolean;
  snackbarMessage: string;

  // Resizing state
  featuresWidth: number;
  mentionsListWidth: number;
}

interface ThemesPageActions {
  // Theme actions
  setThemes: (themes: Theme[]) => void;
  fetchThemes: () => Promise<void>;
  createTheme: (formData: ThemeFormData) => Promise<void>;
  createMultipleThemes: (themes: Array<{ name: string; description: string; parent_theme_id: string | null }>) => Promise<void>;
  updateTheme: (themeId: string, formData: ThemeFormData) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  setSelectedThemeForDrawer: (theme: Theme | null) => void;
  toggleThemeExpansion: (themeId: string) => void;
  
  // Feature actions
  fetchThemeFeatures: (themeId: string) => Promise<void>;
  fetchAllFeatures: () => Promise<void>;
  updateFeature: (featureId: string, data: { name: string; description: string }) => Promise<void>;
  createFeature: (data: { name: string; description: string; theme_id: string | null }) => Promise<void>;
  createMultipleFeatures: (features: Array<{ name: string; description: string }>, themeId: string | null) => Promise<void>;
  deleteFeature: (featureId: string) => Promise<void>;
  updateFeatureTheme: (featureId: string, newThemeId: string | null) => Promise<void>;
  setSelectedFeatureForMessages: (feature: Feature | null) => void;

  // Message actions
  fetchFeatureMessages: (featureId: string) => Promise<void>;
  deleteMention: (featureId: string, messageId: string) => Promise<void>;
  setSelectedMessageId: (id: string | null) => void;

  // View actions
  handleAllThemesClick: () => void;
  handleAllFeaturesClick: () => void;
  handleThemeClick: (theme: Theme) => void;
  setShowingSubThemes: (value: boolean) => void;
  setShowMessagesFullPage: (value: boolean) => void;

  // Mobile actions
  setMobileThemesDrawerOpen: (open: boolean) => void;
  setMentionsDrawerOpen: (open: boolean) => void;
  setDrawerLevel: (level: DrawerLevel) => void;

  // Filter actions
  setFilters: (filters: Partial<FeatureFilters>) => void;
  clearFilters: () => void;
  setShowFilters: (show: boolean) => void;

  // Dialog actions
  openThemeDialog: (theme?: Theme, parentThemeId?: string) => void;
  closeThemeDialog: () => void;
  setFormData: (data: Partial<ThemeFormData>) => void;
  loadThemeSuggestions: () => Promise<void>;
  loadMoreThemeSuggestions: () => Promise<void>;
  toggleThemeSuggestionSelection: (index: number) => void;
  createMultipleThemes: (themes: Array<{ name: string; description: string; parent_theme_id: string | null }>) => Promise<void>;

  // Feature dialog actions
  openEditModal: (feature: Feature) => void;
  closeEditModal: () => void;
  setEditFormData: (data: { name: string; description: string }) => void;
  saveFeatureEdit: () => Promise<void>;

  openAddModal: () => void;
  closeAddModal: () => void;
  setAddFormData: (data: { name: string; description: string }) => void;
  loadFeatureSuggestions: () => Promise<void>;
  loadMoreFeatureSuggestions: () => Promise<void>;
  toggleSuggestionSelection: (index: number) => void;
  saveFeatureAdd: () => Promise<void>;

  // Delete dialog actions
  openDeleteConfirm: (feature: Feature) => void;
  closeDeleteConfirm: () => void;
  confirmDeleteFeature: () => Promise<void>;

  openDeleteMentionConfirm: (message: Message) => void;
  closeDeleteMentionConfirm: () => void;
  confirmDeleteMention: () => Promise<void>;

  // Menu actions
  openMenu: (event: React.MouseEvent<HTMLElement>, theme: Theme) => void;
  closeMenu: () => void;
  handleMenuAction: (action: 'edit' | 'delete' | 'add-sub' | 'slack') => void;

  // Slack connect dialog actions
  openSlackConnectDialog: (theme: Theme) => void;
  closeSlackConnectDialog: () => void;

  // Tab actions
  setMentionDetailsTab: (tab: MentionDetailsTab) => void;

  // Error and snackbar actions
  setError: (error: string | null) => void;
  showSnackbar: (message: string) => void;
  closeSnackbar: () => void;

  // Resize actions
  setFeaturesWidth: (width: number) => void;
  setMentionsListWidth: (width: number) => void;

  // Utility actions
  reset: () => void;
}

// Helper functions
const getAuthToken = () => {
  const { tokens } = useAuthStore.getState();
  return tokens?.access_token || '';
};

const getWorkspaceId = () => {
  const { tokens } = useAuthStore.getState();
  return tokens?.workspace_id || '';
};

const buildThemeHierarchy = (themes: Theme[]): ThemeWithChildren[] => {
  const themeMap = new Map(themes.map(theme => [theme.id, { ...theme, children: [] as ThemeWithChildren[] }]));
  const rootThemes: ThemeWithChildren[] = [];

  themes.forEach(theme => {
    const themeWithChildren = themeMap.get(theme.id)!;
    if (theme.parent_theme_id && themeMap.has(theme.parent_theme_id)) {
      const parent = themeMap.get(theme.parent_theme_id)!;
      parent.children.push(themeWithChildren);
    } else {
      rootThemes.push(themeWithChildren);
    }
  });

  // Sort root themes alphabetically
  rootThemes.sort((a, b) => a.name.localeCompare(b.name));

  // Sort children alphabetically
  rootThemes.forEach(theme => {
    if (theme.children.length > 0) {
      theme.children.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  return rootThemes;
};

const flattenThemes = (hierarchicalThemes: ThemeWithChildren[]): Theme[] => {
  const result: Theme[] = [];
  const flatten = (themeList: ThemeWithChildren[]) => {
    themeList.forEach(theme => {
      result.push(theme);
      if (theme.children.length > 0) {
        flatten(theme.children);
      }
    });
  };
  flatten(hierarchicalThemes);
  return result;
};

const initialFilters: FeatureFilters = {
  sortBy: 'mention_count',
  sortOrder: 'desc',
  filterStatus: 'all',
  filterUrgency: 'all',
  filterMrrMin: '',
  filterMrrMax: '',
  searchQuery: '',
};

const initialState: ThemesPageState = {
  themes: [],
  hierarchicalThemes: [],
  flattenedThemes: [],
  selectedThemeForDrawer: null,
  expandedThemes: new Set(),

  themeFeatures: [],
  selectedFeatureForMessages: null,

  featureMessages: [],
  selectedMessageId: null,

  loading: true,
  loadingFeatures: false,
  loadingMessages: false,
  loadingSuggestions: false,
  loadingMoreSuggestions: false,
  loadingFeatureSuggestions: false,
  loadingMoreFeatureSuggestions: false,

  showingAllFeatures: false,
  showingAllFeaturesList: false,
  showingSubThemes: false,
  showMessagesFullPage: false,

  mobileThemesDrawerOpen: false,
  mentionsDrawerOpen: false,
  drawerLevel: 'mentions',

  filters: initialFilters,
  showFilters: false,

  dialogOpen: false,
  editingTheme: null,
  formData: { name: '', description: '', parent_theme_id: null },
  suggestions: [],
  selectedThemeSuggestions: new Set(),
  savingTheme: false,
  themeError: null,

  editModalOpen: false,
  editingFeature: null,
  editFormData: { name: '', description: '' },
  savingEdit: false,
  editError: null,

  addModalOpen: false,
  addFormData: { name: '', description: '' },
  savingAdd: false,
  addError: null,
  featureSuggestions: [],
  selectedSuggestions: new Set(),

  deleteConfirmOpen: false,
  featureToDelete: null,
  deletingFeature: false,

  deleteMentionConfirmOpen: false,
  mentionToDelete: null,
  deletingMention: false,

  menuAnchorEl: null,
  selectedThemeForMenu: null,

  slackConnectDialogOpen: false,
  selectedThemeForSlack: null,

  mentionDetailsTab: 'highlights',

  error: null,
  snackbarOpen: false,
  snackbarMessage: '',

  featuresWidth: 35,
  mentionsListWidth: 18,
};

export const useThemesPageStore = create<ThemesPageState & ThemesPageActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Theme actions
      setThemes: (themes) => {
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

      createTheme: async (formData) => {
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

      createMultipleThemes: async (themes) => {
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
        return createdThemes;
      },

      updateTheme: async (themeId, formData) => {
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

      deleteTheme: async (themeId) => {
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

      setSelectedThemeForDrawer: (theme) => set({ selectedThemeForDrawer: theme }),

      toggleThemeExpansion: (themeId) => {
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

      // Feature actions
      fetchThemeFeatures: async (themeId) => {
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

      updateFeature: async (featureId, data) => {
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

      createFeature: async (data) => {
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

      createMultipleFeatures: async (features, themeId) => {
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
        return createdFeatures;
      },

      deleteFeature: async (featureId) => {
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

      updateFeatureTheme: async (featureId, newThemeId) => {
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

      setSelectedFeatureForMessages: (feature) => set({ selectedFeatureForMessages: feature }),

      // Message actions
      fetchFeatureMessages: async (featureId) => {
        try {
          set({ loadingMessages: true });
          const workspaceId = getWorkspaceId();
          const token = getAuthToken();

          const response = await fetch(
            `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${workspaceId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              }
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status}`);
          }

          const messages = await response.json();
          set({ featureMessages: messages });
        } catch (error) {
          console.error('Error fetching feature messages:', error);
          set({ featureMessages: [] });
        } finally {
          set({ loadingMessages: false });
        }
      },

      deleteMention: async (featureId, messageId) => {
        const workspaceId = getWorkspaceId();
        const token = getAuthToken();

        const response = await fetch(
          `${API_BASE_URL}/api/v1/features/features/${featureId}/messages/${messageId}?workspace_id=${workspaceId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete message: ${response.status}`);
        }

        set(state => ({
          featureMessages: state.featureMessages.filter(m => m.id !== messageId),
          selectedMessageId: state.selectedMessageId === messageId ? null : state.selectedMessageId
        }));
      },

      setSelectedMessageId: (id) => set({ selectedMessageId: id }),

      // View actions
      handleAllThemesClick: () => {
        set({
          selectedThemeForDrawer: null,
          showingAllFeatures: true,
          showingAllFeaturesList: false,
          showingSubThemes: false,
          themeFeatures: []
        });
      },

      handleAllFeaturesClick: () => {
        set({
          selectedThemeForDrawer: null,
          showingAllFeatures: false,
          showingAllFeaturesList: true,
          showingSubThemes: false,
        });
        get().fetchAllFeatures();
      },

      handleThemeClick: (theme) => {
        const hasChildren = (theme as any).children && (theme as any).children.length > 0;
        
        set({
          selectedThemeForDrawer: theme,
          showingAllFeatures: false,
          showingAllFeaturesList: false,
        });

        if (hasChildren) {
          set({ showingSubThemes: true, themeFeatures: [] });
        } else {
          set({ showingSubThemes: false });
          get().fetchThemeFeatures(theme.id);
        }
      },

      setShowingSubThemes: (value) => set({ showingSubThemes: value }),
      setShowMessagesFullPage: (value) => set({ showMessagesFullPage: value }),

      // Mobile actions
      setMobileThemesDrawerOpen: (open) => set({ mobileThemesDrawerOpen: open }),
      setMentionsDrawerOpen: (open) => set({ mentionsDrawerOpen: open }),
      setDrawerLevel: (level) => set({ drawerLevel: level }),

      // Filter actions
      setFilters: (filters) => set(state => ({
        filters: { ...state.filters, ...filters }
      })),

      clearFilters: () => set({ filters: initialFilters }),

      setShowFilters: (show) => set({ showFilters: show }),

      // Dialog actions
      openThemeDialog: (theme, parentThemeId) => {
        if (theme) {
          set({
            editingTheme: theme,
            formData: {
              name: theme.name,
              description: theme.description,
              parent_theme_id: theme.parent_theme_id || null,
            },
            suggestions: [],
            dialogOpen: true,
          });
        } else {
          set({
            editingTheme: null,
            formData: {
              name: '',
              description: '',
              parent_theme_id: parentThemeId || null,
            },
            suggestions: [],
            selectedThemeSuggestions: new Set(),
            themeError: null,
            dialogOpen: true,
          });
          get().loadThemeSuggestions();
        }
      },

      closeThemeDialog: () => {
        set({
          dialogOpen: false,
          editingTheme: null,
          formData: { name: '', description: '', parent_theme_id: null },
          suggestions: [],
          selectedThemeSuggestions: new Set(),
          themeError: null,
        });
      },

      toggleThemeSuggestionSelection: (index) => {
        set(state => {
          const newSet = new Set(state.selectedThemeSuggestions);
          if (newSet.has(index)) {
            newSet.delete(index);
          } else {
            newSet.add(index);
          }
          return { selectedThemeSuggestions: newSet };
        });
      },

      setFormData: (data) => set(state => ({
        formData: { ...state.formData, ...data }
      })),

      loadThemeSuggestions: async () => {
        const workspaceId = getWorkspaceId();
        if (!workspaceId) return;

        set({ loadingSuggestions: true });
        try {
          const { themes } = get();
          const existingThemes = themes.map(theme => ({
            name: theme.name,
            description: theme.description
          }));
          const suggestions = await themeService.generateThemeSuggestions(workspaceId, existingThemes);
          set({ suggestions });
        } catch (err) {
          console.error('Failed to load theme suggestions:', err);
          set({ suggestions: [] });
        } finally {
          set({ loadingSuggestions: false });
        }
      },

      loadMoreThemeSuggestions: async () => {
        const workspaceId = getWorkspaceId();
        if (!workspaceId) return;

        set({ loadingMoreSuggestions: true });
        try {
          const { themes, suggestions } = get();
          const existingThemes = themes.map(theme => ({
            name: theme.name,
            description: theme.description
          }));
          const moreSuggestions = await themeService.generateThemeSuggestions(
            workspaceId,
            existingThemes,
            suggestions
          );
          set(state => ({ suggestions: [...state.suggestions, ...moreSuggestions] }));
        } catch (err) {
          console.error('Failed to load more suggestions:', err);
        } finally {
          set({ loadingMoreSuggestions: false });
        }
      },

      // Feature dialog actions
      openEditModal: (feature) => {
        set({
          editingFeature: feature,
          editFormData: { name: feature.name, description: feature.description },
          editModalOpen: true,
          editError: null,
        });
      },

      closeEditModal: () => {
        set({
          editModalOpen: false,
          editingFeature: null,
          editFormData: { name: '', description: '' },
          editError: null,
        });
      },

      setEditFormData: (data) => set({ editFormData: data }),

      saveFeatureEdit: async () => {
        const { editingFeature, editFormData } = get();
        if (!editingFeature || !editFormData.name.trim()) {
          set({ editError: 'Feature name cannot be empty' });
          return;
        }

        try {
          set({ savingEdit: true, editError: null });
          await get().updateFeature(editingFeature.id, editFormData);
          get().closeEditModal();
        } catch (error) {
          console.error('Error saving feature:', error);
          set({ editError: error instanceof Error ? error.message : 'Failed to save feature' });
        } finally {
          set({ savingEdit: false });
        }
      },

      openAddModal: () => {
        set({
          addFormData: { name: '', description: '' },
          addError: null,
          featureSuggestions: [],
          selectedSuggestions: new Set(),
          addModalOpen: true,
        });
        get().loadFeatureSuggestions();
      },

      closeAddModal: () => {
        set({
          addModalOpen: false,
          addFormData: { name: '', description: '' },
          addError: null,
          featureSuggestions: [],
          selectedSuggestions: new Set(),
        });
      },

      setAddFormData: (data) => set({ addFormData: data }),

      loadFeatureSuggestions: async () => {
        const workspaceId = getWorkspaceId();
        const { selectedThemeForDrawer, themeFeatures } = get();
        if (!workspaceId || !selectedThemeForDrawer) return;

        set({ loadingFeatureSuggestions: true });
        try {
          const existingFeaturesForAI = themeFeatures.map(f => ({
            name: f.name,
            description: f.description
          }));
          const suggestions = await themeService.generateFeatureSuggestions(
            workspaceId,
            selectedThemeForDrawer.name,
            existingFeaturesForAI
          );
          set({ featureSuggestions: suggestions });
        } catch (err) {
          console.error('Failed to load feature suggestions:', err);
          set({ featureSuggestions: [] });
        } finally {
          set({ loadingFeatureSuggestions: false });
        }
      },

      loadMoreFeatureSuggestions: async () => {
        const workspaceId = getWorkspaceId();
        const { selectedThemeForDrawer, themeFeatures, featureSuggestions } = get();
        if (!workspaceId || !selectedThemeForDrawer) return;

        set({ loadingMoreFeatureSuggestions: true });
        try {
          const existingFeaturesForAI = themeFeatures.map(f => ({
            name: f.name,
            description: f.description
          }));
          const moreSuggestions = await themeService.generateFeatureSuggestions(
            workspaceId,
            selectedThemeForDrawer.name,
            existingFeaturesForAI,
            featureSuggestions
          );
          set(state => ({ featureSuggestions: [...state.featureSuggestions, ...moreSuggestions] }));
        } catch (err) {
          console.error('Failed to load more feature suggestions:', err);
        } finally {
          set({ loadingMoreFeatureSuggestions: false });
        }
      },

      toggleSuggestionSelection: (index) => {
        set(state => {
          const newSet = new Set(state.selectedSuggestions);
          if (newSet.has(index)) {
            newSet.delete(index);
          } else {
            newSet.add(index);
          }
          return { selectedSuggestions: newSet };
        });
      },

      saveFeatureAdd: async () => {
        const { selectedSuggestions, featureSuggestions, addFormData, selectedThemeForDrawer } = get();
        const hasSelections = selectedSuggestions.size > 0;

        if (!hasSelections && !addFormData.name.trim()) {
          set({ addError: 'Feature name cannot be empty' });
          return;
        }

        try {
          set({ savingAdd: true, addError: null });

          if (hasSelections) {
            const selectedFeatures = Array.from(selectedSuggestions).map(index => featureSuggestions[index]);
            await get().createMultipleFeatures(selectedFeatures, selectedThemeForDrawer?.id || null);
            get().showSnackbar(`Successfully created ${selectedFeatures.length} features`);
          } else {
            await get().createFeature({
              ...addFormData,
              theme_id: selectedThemeForDrawer?.id || null
            });
            get().showSnackbar('Feature created successfully');
          }

          get().closeAddModal();
        } catch (error) {
          console.error('Error creating feature:', error);
          set({ addError: error instanceof Error ? error.message : 'Failed to create feature' });
        } finally {
          set({ savingAdd: false });
        }
      },

      // Delete dialog actions
      openDeleteConfirm: (feature) => {
        set({ featureToDelete: feature, deleteConfirmOpen: true });
      },

      closeDeleteConfirm: () => {
        set({ deleteConfirmOpen: false, featureToDelete: null });
      },

      confirmDeleteFeature: async () => {
        const { featureToDelete } = get();
        if (!featureToDelete) return;

        try {
          set({ deletingFeature: true });
          await get().deleteFeature(featureToDelete.id);
          get().closeDeleteConfirm();
        } catch (error) {
          console.error('Error deleting feature:', error);
          alert(error instanceof Error ? error.message : 'Failed to delete feature');
        } finally {
          set({ deletingFeature: false });
        }
      },

      openDeleteMentionConfirm: (message) => {
        set({ mentionToDelete: message, deleteMentionConfirmOpen: true });
      },

      closeDeleteMentionConfirm: () => {
        set({ deleteMentionConfirmOpen: false, mentionToDelete: null });
      },

      confirmDeleteMention: async () => {
        const { mentionToDelete, selectedFeatureForMessages } = get();
        if (!mentionToDelete || !selectedFeatureForMessages) return;

        try {
          set({ deletingMention: true });
          await get().deleteMention(selectedFeatureForMessages.id, mentionToDelete.id);
          get().closeDeleteMentionConfirm();
          get().showSnackbar('Mention deleted successfully');
        } catch (error) {
          console.error('Error deleting message:', error);
          alert(error instanceof Error ? error.message : 'Failed to delete message');
        } finally {
          set({ deletingMention: false });
        }
      },

      // Menu actions
      openMenu: (event, theme) => {
        set({ menuAnchorEl: event.currentTarget, selectedThemeForMenu: theme });
      },

      closeMenu: () => {
        set({ menuAnchorEl: null, selectedThemeForMenu: null });
      },

      handleMenuAction: (action) => {
        const { selectedThemeForMenu } = get();
        if (!selectedThemeForMenu) return;

        switch (action) {
          case 'edit':
            get().openThemeDialog(selectedThemeForMenu);
            break;
          case 'delete':
            if (confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
              get().deleteTheme(selectedThemeForMenu.id);
            }
            break;
          case 'add-sub':
            get().openThemeDialog(undefined, selectedThemeForMenu.id);
            break;
          case 'slack':
            get().openSlackConnectDialog(selectedThemeForMenu);
            break;
        }
        get().closeMenu();
      },

      // Slack connect dialog actions
      openSlackConnectDialog: (theme: Theme) => {
        set({ slackConnectDialogOpen: true, selectedThemeForSlack: theme });
      },

      closeSlackConnectDialog: () => {
        set({ slackConnectDialogOpen: false, selectedThemeForSlack: null });
      },

      // Tab actions
      setMentionDetailsTab: (tab) => set({ mentionDetailsTab: tab }),

      // Error and snackbar actions
      setError: (error) => set({ error }),
      showSnackbar: (message) => set({ snackbarOpen: true, snackbarMessage: message }),
      closeSnackbar: () => set({ snackbarOpen: false }),

      // Resize actions
      setFeaturesWidth: (width) => set({ featuresWidth: width }),
      setMentionsListWidth: (width) => set({ mentionsListWidth: width }),

      // Utility actions
      reset: () => set(initialState),
    }),
    { name: 'themes-page-store' }
  )
);

// Selectors for computed values
export const useFilteredAndSortedFeatures = () => {
  const themeFeatures = useThemesPageStore(state => state.themeFeatures);
  const filters = useThemesPageStore(state => state.filters);

  return filterAndSortFeatures(themeFeatures, filters);
};

// Filter and sort function
export const filterAndSortFeatures = (features: Feature[], filters: FeatureFilters): Feature[] => {
  let filtered = [...features];

  // Filter by search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(f => {
      if (f.name.toLowerCase().includes(query)) return true;
      if (f.description?.toLowerCase().includes(query)) return true;
      if (f.data_points && f.data_points.length > 0) {
        for (const dp of f.data_points) {
          if (dp.customer_name?.toLowerCase().includes(query)) return true;
          if (dp.customer_email?.toLowerCase().includes(query)) return true;
          if (dp.sender_name?.toLowerCase().includes(query)) return true;
          if (dp.business_metrics) {
            const metricsStr = JSON.stringify(dp.business_metrics).toLowerCase();
            if (metricsStr.includes(query)) return true;
          }
          if (dp.entities) {
            const entitiesStr = JSON.stringify(dp.entities).toLowerCase();
            if (entitiesStr.includes(query)) return true;
          }
          if (dp.ai_insights) {
            if (dp.ai_insights.feature_requests?.length) {
              const featuresStr = JSON.stringify(dp.ai_insights.feature_requests).toLowerCase();
              if (featuresStr.includes(query)) return true;
            }
            if (dp.ai_insights.bug_reports?.length) {
              const bugsStr = JSON.stringify(dp.ai_insights.bug_reports).toLowerCase();
              if (bugsStr.includes(query)) return true;
            }
            if (dp.ai_insights.summary?.toLowerCase().includes(query)) return true;
          }
        }
      }
      return false;
    });
  }

  // Filter by status
  if (filters.filterStatus !== 'all') {
    filtered = filtered.filter(f => f.status === filters.filterStatus);
  }

  // Filter by urgency
  if (filters.filterUrgency !== 'all') {
    filtered = filtered.filter(f => f.urgency === filters.filterUrgency);
  }

  // Filter by MRR range
  if (filters.filterMrrMin || filters.filterMrrMax) {
    filtered = filtered.filter(f => {
      if (!f.data_points) return false;
      for (const dp of f.data_points) {
        if (dp.business_metrics && dp.business_metrics.mrr !== undefined) {
          const mrr = parseFloat(dp.business_metrics.mrr);
          const min = filters.filterMrrMin ? parseFloat(filters.filterMrrMin) : -Infinity;
          const max = filters.filterMrrMax ? parseFloat(filters.filterMrrMax) : Infinity;
          if (mrr >= min && mrr <= max) return true;
        }
      }
      return false;
    });
  }

  // Sort features
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'mention_count':
        comparison = a.mention_count - b.mention_count;
        break;
      case 'last_mentioned':
        comparison = new Date(a.last_mentioned).getTime() - new Date(b.last_mentioned).getTime();
        break;
      case 'status': {
        const statusOrder = { 'new': 1, 'in_progress': 2, 'completed': 3 };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 999;
        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 999;
        comparison = aStatus - bStatus;
        break;
      }
      case 'urgency': {
        const urgencyOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        const aUrgency = urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 999;
        const bUrgency = urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 999;
        comparison = aUrgency - bUrgency;
        break;
      }
      case 'mrr': {
        const aMrr = extractDataPointValue(a, 'mrr');
        const bMrr = extractDataPointValue(b, 'mrr');
        const aMrrNum = aMrr ? parseFloat(aMrr) : 0;
        const bMrrNum = bMrr ? parseFloat(bMrr) : 0;
        comparison = aMrrNum - bMrrNum;
        break;
      }
      case 'company_name': {
        const aCompany = extractDataPointValue(a, 'company_name') || '';
        const bCompany = extractDataPointValue(b, 'company_name') || '';
        comparison = String(aCompany).localeCompare(String(bCompany));
        break;
      }
      default:
        comparison = 0;
    }
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
};

// Helper function to extract data point values
const extractDataPointValue = (feature: Feature, key: string): any => {
  if (!feature.data_points || feature.data_points.length === 0) return null;
  for (const dp of feature.data_points) {
    if (dp.business_metrics && key in dp.business_metrics) {
      return dp.business_metrics[key];
    }
    if (dp.entities && key in dp.entities) {
      return dp.entities[key];
    }
    if (dp.structured_metrics && key in dp.structured_metrics) {
      return dp.structured_metrics[key];
    }
  }
  return null;
};
