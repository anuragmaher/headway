/**
 * UI Slice - Manages UI state, selection, and navigation
 */
import { StateCreator } from 'zustand';
import type { ColumnType } from '../../types';
import type { ExplorerStore } from '../explorerStore';

export interface UIState {
  // Selection state
  selectedThemeId: string | null;
  selectedSubThemeId: string | null;
  selectedFeedbackId: string | null;
  expandedFeedbackId: string | null;
  activeColumn: ColumnType;

  // Panel state
  isSearchOpen: boolean;
  isFilterPanelOpen: boolean;
  isDetailPanelOpen: boolean;

  // Dialog state
  isAddThemeDialogOpen: boolean;
  isAddSubThemeDialogOpen: boolean;
  isEditThemeDialogOpen: boolean;
  isEditSubThemeDialogOpen: boolean;
  isMergeDialogOpen: boolean;
  isDeleteConfirmOpen: boolean;

  // Edit targets
  editingThemeId: string | null;
  editingSubThemeId: string | null;
  deletingItemId: string | null;
  deletingItemType: 'theme' | 'subTheme' | 'feedback' | null;
  mergeSourceId: string | null;
}

export interface UIActions {
  // Selection actions
  selectTheme: (themeId: string | null) => void;
  selectSubTheme: (subThemeId: string | null) => void;
  selectFeedback: (feedbackId: string | null) => void;
  expandFeedback: (feedbackId: string | null) => void;
  setActiveColumn: (column: ColumnType) => void;

  // Navigation actions
  navigateToTheme: (themeId: string) => void;
  navigateToSubTheme: (subThemeId: string) => void;
  navigateToFeedback: (feedbackId: string) => void;
  navigateBack: () => void;

  // Panel actions
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  toggleFilterPanel: () => void;
  openDetailPanel: () => void;
  closeDetailPanel: () => void;

  // Dialog actions
  openAddThemeDialog: () => void;
  closeAddThemeDialog: () => void;
  openAddSubThemeDialog: () => void;
  closeAddSubThemeDialog: () => void;
  openEditThemeDialog: (themeId: string) => void;
  closeEditThemeDialog: () => void;
  openEditSubThemeDialog: (subThemeId: string) => void;
  closeEditSubThemeDialog: () => void;
  openMergeDialog: (sourceId: string) => void;
  closeMergeDialog: () => void;
  openDeleteConfirm: (itemId: string, itemType: 'theme' | 'subTheme' | 'feedback') => void;
  closeDeleteConfirm: () => void;

  // Reset
  resetUIState: () => void;
}

export type UISlice = UIState & UIActions;

const initialUIState: UIState = {
  selectedThemeId: null,
  selectedSubThemeId: null,
  selectedFeedbackId: null,
  expandedFeedbackId: null,
  activeColumn: 'themes',
  isSearchOpen: false,
  isFilterPanelOpen: false,
  isDetailPanelOpen: false,
  isAddThemeDialogOpen: false,
  isAddSubThemeDialogOpen: false,
  isEditThemeDialogOpen: false,
  isEditSubThemeDialogOpen: false,
  isMergeDialogOpen: false,
  isDeleteConfirmOpen: false,
  editingThemeId: null,
  editingSubThemeId: null,
  deletingItemId: null,
  deletingItemType: null,
  mergeSourceId: null,
};

export const createUISlice: StateCreator<
  ExplorerStore,
  [],
  [],
  UISlice
> = (set, get) => ({
  ...initialUIState,

  // Selection actions
  selectTheme: (themeId: string | null) => {
    set({
      selectedThemeId: themeId,
      selectedSubThemeId: null,
      selectedFeedbackId: null,
      expandedFeedbackId: null,
      activeColumn: themeId ? 'subThemes' : 'themes',
    });

    // Fetch sub-themes when theme is selected
    if (themeId) {
      get().fetchSubThemes(themeId);
      get().clearCustomerAsks();
    } else {
      get().clearSubThemes();
      get().clearCustomerAsks();
    }
  },

  selectSubTheme: (subThemeId: string | null) => {
    set({
      selectedSubThemeId: subThemeId,
      selectedFeedbackId: null,
      expandedFeedbackId: null,
      activeColumn: subThemeId ? 'customerAsks' : 'subThemes',
    });

    // Fetch customer asks when sub-theme is selected
    if (subThemeId) {
      get().fetchCustomerAsks(subThemeId);
    } else {
      get().clearCustomerAsks();
    }
  },

  selectFeedback: (feedbackId: string | null) => {
    set({
      selectedFeedbackId: feedbackId,
      activeColumn: 'feedback',
    });
  },

  expandFeedback: (feedbackId: string | null) => {
    set({
      expandedFeedbackId: feedbackId,
      isDetailPanelOpen: !!feedbackId,
    });
  },

  setActiveColumn: (column: ColumnType) => {
    set({ activeColumn: column });
  },

  // Navigation actions
  navigateToTheme: (themeId: string) => {
    get().selectTheme(themeId);
  },

  navigateToSubTheme: (subThemeId: string) => {
    get().selectSubTheme(subThemeId);
  },

  navigateToFeedback: (feedbackId: string) => {
    get().selectFeedback(feedbackId);
    get().expandFeedback(feedbackId);
  },

  navigateBack: () => {
    const { activeColumn, selectedThemeId, selectedSubThemeId } = get();

    switch (activeColumn) {
      case 'feedback':
        if (selectedSubThemeId) {
          set({ activeColumn: 'subThemes', selectedFeedbackId: null, expandedFeedbackId: null });
        }
        break;
      case 'subThemes':
        if (selectedThemeId) {
          set({ activeColumn: 'themes', selectedSubThemeId: null });
          get().clearFeedback();
        }
        break;
      case 'themes':
      default:
        // Already at root
        break;
    }
  },

  // Panel actions
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  openFilterPanel: () => set({ isFilterPanelOpen: true }),
  closeFilterPanel: () => set({ isFilterPanelOpen: false }),
  toggleFilterPanel: () => set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen })),

  openDetailPanel: () => set({ isDetailPanelOpen: true }),
  closeDetailPanel: () => set({ isDetailPanelOpen: false, expandedFeedbackId: null }),

  // Dialog actions
  openAddThemeDialog: () => set({ isAddThemeDialogOpen: true }),
  closeAddThemeDialog: () => set({ isAddThemeDialogOpen: false }),

  openAddSubThemeDialog: () => set({ isAddSubThemeDialogOpen: true }),
  closeAddSubThemeDialog: () => set({ isAddSubThemeDialogOpen: false }),

  openEditThemeDialog: (themeId: string) => set({
    isEditThemeDialogOpen: true,
    editingThemeId: themeId,
  }),
  closeEditThemeDialog: () => set({
    isEditThemeDialogOpen: false,
    editingThemeId: null,
  }),

  openEditSubThemeDialog: (subThemeId: string) => set({
    isEditSubThemeDialogOpen: true,
    editingSubThemeId: subThemeId,
  }),
  closeEditSubThemeDialog: () => set({
    isEditSubThemeDialogOpen: false,
    editingSubThemeId: null,
  }),

  openMergeDialog: (sourceId: string) => set({
    isMergeDialogOpen: true,
    mergeSourceId: sourceId,
  }),
  closeMergeDialog: () => set({
    isMergeDialogOpen: false,
    mergeSourceId: null,
  }),

  openDeleteConfirm: (itemId: string, itemType: 'theme' | 'subTheme' | 'feedback') => set({
    isDeleteConfirmOpen: true,
    deletingItemId: itemId,
    deletingItemType: itemType,
  }),
  closeDeleteConfirm: () => set({
    isDeleteConfirmOpen: false,
    deletingItemId: null,
    deletingItemType: null,
  }),

  // Reset
  resetUIState: () => set(initialUIState),
});
