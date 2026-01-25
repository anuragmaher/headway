/**
 * UI Slice - Manages UI state, selection, and navigation
 */
import { StateCreator } from 'zustand';
import type { ColumnType } from '../../types';
import type { ExplorerStore } from '../explorerStore';

export interface MobileNavigationItem {
  view: 'themes' | 'subThemes' | 'customerAsks' | 'mentions';
  title: string;
  selectedId?: string | null;
}

export interface UIState {
  // Selection state
  selectedThemeId: string | null;
  selectedSubThemeId: string | null;
  selectedFeedbackId: string | null;
  expandedFeedbackId: string | null;
  activeColumn: ColumnType;

  // Mobile navigation state
  isMobile: boolean;
  mobileActiveView: 'themes' | 'subThemes' | 'customerAsks' | 'mentions';
  mobileNavigationStack: MobileNavigationItem[];

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

  // Mobile-specific actions
  setIsMobile: (isMobile: boolean) => void;
  setMobileActiveView: (view: 'themes' | 'subThemes' | 'customerAsks' | 'mentions') => void;
  pushMobileNavigation: (item: MobileNavigationItem) => void;
  popMobileNavigation: () => void;
  clearMobileNavigationStack: () => void;

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
  isMobile: false,
  mobileActiveView: 'themes',
  mobileNavigationStack: [{ view: 'themes', title: 'Themes' }],
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
    const { isMobile } = get();
    
    set({
      selectedThemeId: themeId,
      selectedSubThemeId: null,
      selectedFeedbackId: null,
      expandedFeedbackId: null,
      activeColumn: themeId ? 'subThemes' : 'themes',
    });

    // Mobile navigation
    if (isMobile && themeId) {
      const theme = get().themes.find(t => t.id === themeId);
      get().pushMobileNavigation({
        view: 'subThemes',
        title: theme?.name || 'Sub-Themes',
        selectedId: themeId
      });
    }

    // Fetch sub-themes when theme is selected
    if (themeId) {
      get().fetchSubThemes(themeId);
      get().clearTranscriptClassifications();  // Clear when theme changes
    } else {
      get().clearSubThemes();
      get().clearTranscriptClassifications();
    }
  },

  selectSubTheme: (subThemeId: string | null) => {
    const { isMobile, selectedThemeId } = get();
    
    set({
      selectedSubThemeId: subThemeId,
      selectedFeedbackId: null,
      expandedFeedbackId: null,
      activeColumn: subThemeId ? 'customerAsks' : 'subThemes',
    });

    // Mobile navigation
    if (isMobile && subThemeId) {
      const subTheme = get().subThemes.find(st => st.id === subThemeId);
      get().pushMobileNavigation({
        view: 'customerAsks',
        title: subTheme?.name || 'Transcript Classifications',
        selectedId: subThemeId
      });
    }

    // Fetch transcript classifications when sub-theme is selected
    if (subThemeId) {
      get().fetchTranscriptClassifications(subThemeId, selectedThemeId || undefined);
    } else {
      get().clearTranscriptClassifications();
    }
  },

  selectFeedback: (feedbackId: string | null) => {
    const { isMobile } = get();
    
    set({
      selectedFeedbackId: feedbackId,
      activeColumn: 'feedback',
    });

    // Mobile navigation - mentions now handled by drawer, no need to push navigation
    // if (isMobile && feedbackId) {
    //   get().pushMobileNavigation({
    //     view: 'mentions',
    //     title: 'Mentions',
    //     selectedId: feedbackId
    //   });
    //   
    //   // Explicitly set the mobile active view to ensure transition
    //   get().setMobileActiveView('mentions');
    // }
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
    const { 
      isMobile, 
      mobileNavigationStack, 
      mobileActiveView,
      activeColumn, 
      selectedThemeId, 
      selectedSubThemeId 
    } = get();

    if (isMobile) {
      // Mobile navigation - guard against empty stack and fix state synchronization
      if (mobileNavigationStack.length > 1) {
        // Calculate the new stack BEFORE mutating state to avoid stale closure bug
        const newStack = mobileNavigationStack.slice(0, -1);
        const previousItem = newStack[newStack.length - 1];
        
        // Ensure we have a valid previousItem before proceeding
        if (previousItem) {
          // Update the navigation state atomically
          get().popMobileNavigation();
          get().setMobileActiveView(previousItem.view);

          // Update selections based on navigation
          switch (previousItem.view) {
            case 'themes':
              set({ 
                selectedThemeId: null, 
                selectedSubThemeId: null, 
                selectedFeedbackId: null 
              });
              break;
            case 'subThemes':
              set({ 
                selectedSubThemeId: null, 
                selectedFeedbackId: null 
              });
              break;
            case 'customerAsks':
              set({ selectedFeedbackId: null });
              break;
            case 'mentions':
              // Mentions handled by drawer, shouldn't reach here
              set({ selectedFeedbackId: null });
              break;
          }
        }
      }
    } else {
      // Desktop navigation (existing logic)
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

  // Mobile-specific actions
  setIsMobile: (isMobile: boolean) => {
    set({ isMobile });
    if (!isMobile) {
      // Reset mobile navigation when switching to desktop
      set({ 
        mobileActiveView: 'themes',
        mobileNavigationStack: [{ view: 'themes', title: 'Themes' }]
      });
    }
  },

  setMobileActiveView: (view: 'themes' | 'subThemes' | 'customerAsks' | 'mentions') => {
    set({ mobileActiveView: view });
  },

  pushMobileNavigation: (item: MobileNavigationItem) => {
    set((state) => ({
      mobileNavigationStack: [...state.mobileNavigationStack, item],
      mobileActiveView: item.view,
    }));
  },

  popMobileNavigation: () => {
    set((state) => ({
      mobileNavigationStack: state.mobileNavigationStack.length > 1 
        ? state.mobileNavigationStack.slice(0, -1) 
        : state.mobileNavigationStack,
    }));
  },

  clearMobileNavigationStack: () => {
    set({ 
      mobileNavigationStack: [{ view: 'themes', title: 'Themes' }],
      mobileActiveView: 'themes'
    });
  },

  // Reset
  resetUIState: () => set(initialUIState),
});
