/**
 * UI slice - Handles UI state including views, dialogs, menus, filters
 */

import { StateCreator } from 'zustand';
import {
  ThemesPageStore,
  ViewState,
  FilterState,
  ThemeDialogState,
  FeatureDialogState,
  DeleteState,
  MenuState,
  SlackDialogState,
  FeedbackState,
  ResizeState,
  ViewActions,
  FilterActions,
  ThemeDialogActions,
  FeatureDialogActions,
  DeleteActions,
  MenuActions,
  SlackDialogActions,
  FeedbackActions,
  ResizeActions,
} from '../types';
import { Theme, Feature, Message, FeatureFilters } from '../../../types/ThemesTypes';
import { themeService } from '@/services/theme';
import { getWorkspaceId } from '../utils';

// ============================================================================
// Initial States
// ============================================================================

export const initialViewState: ViewState = {
  showingAllFeatures: false,
  showingAllFeaturesList: false,
  showingSubThemes: false,
  showMessagesFullPage: false,
  mobileThemesDrawerOpen: false,
  mentionsDrawerOpen: false,
  drawerLevel: 'mentions',
  mentionDetailsTab: 'highlights',
};

export const initialFilters: FeatureFilters = {
  sortBy: 'mention_count',
  sortOrder: 'desc',
  filterStatus: 'all',
  filterUrgency: 'all',
  filterMrrMin: '',
  filterMrrMax: '',
  searchQuery: '',
};

export const initialFilterState: FilterState = {
  filters: initialFilters,
  showFilters: false,
};

export const initialThemeDialogState: ThemeDialogState = {
  dialogOpen: false,
  editingTheme: null,
  formData: { name: '', description: '', parent_theme_id: null },
  suggestions: [],
  selectedThemeSuggestions: new Set(),
  loadingSuggestions: false,
  loadingMoreSuggestions: false,
  savingTheme: false,
  themeError: null,
};

export const initialFeatureDialogState: FeatureDialogState = {
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
  loadingFeatureSuggestions: false,
  loadingMoreFeatureSuggestions: false,
};

export const initialDeleteState: DeleteState = {
  deleteConfirmOpen: false,
  featureToDelete: null,
  deletingFeature: false,
  deleteMentionConfirmOpen: false,
  mentionToDelete: null,
  deletingMention: false,
};

export const initialMenuState: MenuState = {
  menuAnchorEl: null,
  selectedThemeForMenu: null,
};

export const initialSlackDialogState: SlackDialogState = {
  slackConnectDialogOpen: false,
  selectedThemeForSlack: null,
};

export const initialFeedbackState: FeedbackState = {
  error: null,
  snackbarOpen: false,
  snackbarMessage: '',
};

export const initialResizeState: ResizeState = {
  featuresWidth: 35,
  mentionsListWidth: 18,
};

// Combined UI state
export const initialUIState = {
  ...initialViewState,
  ...initialFilterState,
  ...initialThemeDialogState,
  ...initialFeatureDialogState,
  ...initialDeleteState,
  ...initialMenuState,
  ...initialSlackDialogState,
  ...initialFeedbackState,
  ...initialResizeState,
};

// ============================================================================
// UI Slice Type
// ============================================================================

type UIState = ViewState & FilterState & ThemeDialogState & FeatureDialogState &
  DeleteState & MenuState & SlackDialogState & FeedbackState & ResizeState;

type UIActions = ViewActions & FilterActions & ThemeDialogActions & FeatureDialogActions &
  DeleteActions & MenuActions & SlackDialogActions & FeedbackActions & ResizeActions;

// ============================================================================
// UI Slice
// ============================================================================

export const createUISlice: StateCreator<
  ThemesPageStore,
  [],
  [],
  UIState & UIActions
> = (set, get) => ({
  ...initialUIState,

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

  handleThemeClick: (theme: Theme) => {
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

  setShowingSubThemes: (value: boolean) => set({ showingSubThemes: value }),
  setShowMessagesFullPage: (value: boolean) => set({ showMessagesFullPage: value }),
  setMobileThemesDrawerOpen: (open: boolean) => set({ mobileThemesDrawerOpen: open }),
  setMentionsDrawerOpen: (open: boolean) => set({ mentionsDrawerOpen: open }),
  setDrawerLevel: (level) => set({ drawerLevel: level }),
  setMentionDetailsTab: (tab) => set({ mentionDetailsTab: tab }),

  // Filter actions
  setFilters: (filters) => set(state => ({
    filters: { ...state.filters, ...filters }
  })),
  clearFilters: () => set({ filters: initialFilters }),
  setShowFilters: (show: boolean) => set({ showFilters: show }),

  // Theme dialog actions
  openThemeDialog: (theme?: Theme, parentThemeId?: string) => {
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

  toggleThemeSuggestionSelection: (index: number) => {
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

  // Feature dialog actions
  openEditModal: (feature: Feature) => {
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

  toggleSuggestionSelection: (index: number) => {
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

  // Delete actions
  openDeleteConfirm: (feature: Feature) => {
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

  openDeleteMentionConfirm: (message: Message) => {
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
  openMenu: (event: React.MouseEvent<HTMLElement>, theme: Theme) => {
    set({ menuAnchorEl: event.currentTarget, selectedThemeForMenu: theme });
  },

  closeMenu: () => {
    set({ menuAnchorEl: null, selectedThemeForMenu: null });
  },

  handleMenuAction: (action: 'edit' | 'delete' | 'add-sub' | 'slack') => {
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

  // Slack dialog actions
  openSlackConnectDialog: (theme: Theme) => {
    set({ slackConnectDialogOpen: true, selectedThemeForSlack: theme });
  },

  closeSlackConnectDialog: () => {
    set({ slackConnectDialogOpen: false, selectedThemeForSlack: null });
  },

  // Feedback actions
  setError: (error: string | null) => set({ error }),
  showSnackbar: (message: string) => set({ snackbarOpen: true, snackbarMessage: message }),
  closeSnackbar: () => set({ snackbarOpen: false }),

  // Resize actions
  setFeaturesWidth: (width: number) => set({ featuresWidth: width }),
  setMentionsListWidth: (width: number) => set({ mentionsListWidth: width }),
});
