/**
 * Explorer Store - Main Zustand store combining all slices
 * Manages the three-column Theme Explorer state
 */
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  createThemeSlice,
  createSubThemeSlice,
  createFeedbackSlice,
  createCustomerAskSlice,
  createTranscriptClassificationSlice,
  createUISlice,
  type ThemeSlice,
  type SubThemeSlice,
  type FeedbackSlice,
  type CustomerAskSlice,
  type TranscriptClassificationSlice,
  type UISlice,
} from './slices';
import { useAuthStore } from '../../../features/auth/store/auth-store';

// ============================================================================
// Store Type Definition
// ============================================================================

export interface ExplorerStore extends ThemeSlice, SubThemeSlice, FeedbackSlice, CustomerAskSlice, TranscriptClassificationSlice, UISlice {
  // Utility methods
  getWorkspaceId: () => string | null;
  getAuthToken: () => string | null;

  // Initialization
  initialize: () => Promise<void>;
  reset: () => void;

  // Global loading state
  isInitializing: boolean;
  isInitialized: boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useExplorerStore = create<ExplorerStore>()(
  devtools(
    subscribeWithSelector((set, get, api) => ({
      // Combine all slices
      ...createThemeSlice(set, get, api),
      ...createSubThemeSlice(set, get, api),
      ...createFeedbackSlice(set, get, api),
      ...createCustomerAskSlice(set, get, api),
      ...createTranscriptClassificationSlice(set, get, api),
      ...createUISlice(set, get, api),

      // Global state
      isInitializing: false,
      isInitialized: false,

      // Utility methods
      getWorkspaceId: () => {
        const authState = useAuthStore.getState();
        return authState.tokens?.workspace_id || null;
      },

      getAuthToken: () => {
        const authState = useAuthStore.getState();
        return authState.tokens?.access_token || null;
      },

      // Initialize the explorer
      initialize: async () => {
        const { isInitialized, isInitializing } = get();
        if (isInitialized || isInitializing) return;

        set({ isInitializing: true });

        try {
          await get().fetchThemes();
          
          // Fetch transcript counts once on initial load (lightweight, shared across all components)
          console.log('[Explorer] Fetching transcript counts on initial load');
          get().fetchTranscriptCounts().catch((err) => {
            console.warn('[Explorer] Failed to fetch transcript counts:', err);
          });
          
          set({ isInitialized: true, isInitializing: false });

          // OPTIMIZATION: Prefetch first theme's sub-themes in background
          // This makes the first theme click instant
          // Use prefetchSubThemes to only update cache, not visible state
          const themes = get().themes;
          if (themes.length > 0) {
            console.log('[Explorer] Prefetching sub-themes for first theme:', themes[0].id);
            // Fire and forget - don't await to avoid blocking
            get().prefetchSubThemes(themes[0].id).catch((err) => {
              console.warn('[Explorer] Failed to prefetch sub-themes:', err);
            });
          }
        } catch (error) {
          set({ isInitializing: false });
          throw error;
        }
      },

      // Reset all state
      reset: () => {
        set({
          // Theme state
          themes: [],
          isLoadingThemes: false,
          themesError: null,

          // SubTheme state
          subThemes: [],
          isLoadingSubThemes: false,
          subThemesError: null,
          subThemesCache: {},
          currentThemeIdForSubThemes: null,

          // Feedback state
          feedbackItems: [],
          totalFeedback: 0,
          hasMoreFeedback: false,
          nextCursor: null,
          isLoadingFeedback: false,
          isLoadingMoreFeedback: false,
          feedbackError: null,
          filters: {
            sources: [],
            tags: [],
            urgency: [],
            status: [],
            dateRange: null,
            searchQuery: '',
          },
          sortBy: 'recent',

          // CustomerAsk state
          customerAsks: [],
          totalCustomerAsks: 0,
          isLoadingCustomerAsks: false,
          customerAsksError: null,
          customerAsksCache: {},
          currentSubThemeIdForAsks: null,
          mentions: [],
          totalMentions: 0,
          hasMoreMentions: false,
          mentionsNextCursor: null,
          isLoadingMentions: false,
          isLoadingMoreMentions: false,
          mentionsError: null,
          mentionsCache: {},
          selectedCustomerAskId: null,
          isMentionsPanelOpen: false,
          expandedMentionId: null,

          // UI state
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

          // Global state
          isInitializing: false,
          isInitialized: false,
        });
      },
    })),
    { name: 'explorer-store' }
  )
);

// ============================================================================
// Selector Hooks for Performance Optimization
// ============================================================================

// Theme selectors
export const useThemes = () => useExplorerStore((state) => state.themes);
export const useSelectedTheme = () => {
  const themes = useExplorerStore((state) => state.themes);
  const selectedThemeId = useExplorerStore((state) => state.selectedThemeId);
  return themes.find((t) => t.id === selectedThemeId) || null;
};
export const useIsLoadingThemes = () => useExplorerStore((state) => state.isLoadingThemes);
export const useThemesError = () => useExplorerStore((state) => state.themesError);

// SubTheme selectors
export const useSubThemes = () => useExplorerStore((state) => state.subThemes);
export const useSelectedSubTheme = () => {
  const subThemes = useExplorerStore((state) => state.subThemes);
  const selectedSubThemeId = useExplorerStore((state) => state.selectedSubThemeId);
  return subThemes.find((st) => st.id === selectedSubThemeId) || null;
};
export const useIsLoadingSubThemes = () => useExplorerStore((state) => state.isLoadingSubThemes);
export const useSubThemesError = () => useExplorerStore((state) => state.subThemesError);

// Feedback selectors
export const useFeedbackItems = () => useExplorerStore((state) => state.feedbackItems);
export const useSelectedFeedback = () => {
  const feedbackItems = useExplorerStore((state) => state.feedbackItems);
  const selectedFeedbackId = useExplorerStore((state) => state.selectedFeedbackId);
  return feedbackItems.find((f) => f.id === selectedFeedbackId) || null;
};
export const useExpandedFeedback = () => {
  const feedbackItems = useExplorerStore((state) => state.feedbackItems);
  const expandedFeedbackId = useExplorerStore((state) => state.expandedFeedbackId);
  return feedbackItems.find((f) => f.id === expandedFeedbackId) || null;
};
export const useIsLoadingFeedback = () => useExplorerStore((state) => state.isLoadingFeedback);
export const useFeedbackError = () => useExplorerStore((state) => state.feedbackError);
export const useFilters = () => useExplorerStore((state) => state.filters);
export const useSortBy = () => useExplorerStore((state) => state.sortBy);

// CustomerAsk selectors
export const useCustomerAsks = () => useExplorerStore((state) => state.customerAsks);
export const useSelectedCustomerAsk = () => {
  const customerAsks = useExplorerStore((state) => state.customerAsks);
  const selectedCustomerAskId = useExplorerStore((state) => state.selectedCustomerAskId);
  return customerAsks.find((ca) => ca.id === selectedCustomerAskId) || null;
};
export const useIsLoadingCustomerAsks = () => useExplorerStore((state) => state.isLoadingCustomerAsks);
export const useCustomerAsksError = () => useExplorerStore((state) => state.customerAsksError);
export const useSelectedCustomerAskId = () => useExplorerStore((state) => state.selectedCustomerAskId);

// TranscriptClassification selectors
export const useTranscriptClassifications = () => useExplorerStore((state) => state.transcriptClassifications);
export const useSelectedTranscriptClassification = () => {
  const transcriptClassifications = useExplorerStore((state) => state.transcriptClassifications);
  const selectedTranscriptClassificationId = useExplorerStore((state) => state.selectedTranscriptClassificationId);
  return transcriptClassifications.find((tc) => tc.id === selectedTranscriptClassificationId) || null;
};
export const useIsLoadingTranscriptClassifications = () => useExplorerStore((state) => state.isLoadingTranscriptClassifications);
export const useTranscriptClassificationsError = () => useExplorerStore((state) => state.transcriptClassificationsError);
export const useSelectedTranscriptClassificationId = () => useExplorerStore((state) => state.selectedTranscriptClassificationId);

// Mentions selectors
export const useMentions = () => useExplorerStore((state) => state.mentions);
export const useIsLoadingMentions = () => useExplorerStore((state) => state.isLoadingMentions);
export const useMentionsError = () => useExplorerStore((state) => state.mentionsError);
export const useIsMentionsPanelOpen = () => useExplorerStore((state) => state.isMentionsPanelOpen);
export const useExpandedMentionId = () => useExplorerStore((state) => state.expandedMentionId);
export const useExpandedMention = () => {
  const mentions = useExplorerStore((state) => state.mentions);
  const expandedMentionId = useExplorerStore((state) => state.expandedMentionId);
  return mentions.find((m) => m.id === expandedMentionId) || null;
};

// UI selectors
export const useSelectedThemeId = () => useExplorerStore((state) => state.selectedThemeId);
export const useSelectedSubThemeId = () => useExplorerStore((state) => state.selectedSubThemeId);
export const useSelectedFeedbackId = () => useExplorerStore((state) => state.selectedFeedbackId);
export const useActiveColumn = () => useExplorerStore((state) => state.activeColumn);
export const useIsSearchOpen = () => useExplorerStore((state) => state.isSearchOpen);
export const useIsFilterPanelOpen = () => useExplorerStore((state) => state.isFilterPanelOpen);
export const useIsDetailPanelOpen = () => useExplorerStore((state) => state.isDetailPanelOpen);

// Dialog selectors
export const useIsAddThemeDialogOpen = () => useExplorerStore((state) => state.isAddThemeDialogOpen);
export const useIsAddSubThemeDialogOpen = () => useExplorerStore((state) => state.isAddSubThemeDialogOpen);
export const useIsEditThemeDialogOpen = () => useExplorerStore((state) => state.isEditThemeDialogOpen);
export const useIsEditSubThemeDialogOpen = () => useExplorerStore((state) => state.isEditSubThemeDialogOpen);
export const useEditingThemeId = () => useExplorerStore((state) => state.editingThemeId);
export const useEditingSubThemeId = () => useExplorerStore((state) => state.editingSubThemeId);

// Action selectors
export const useExplorerActions = () => {
  const store = useExplorerStore();
  return {
    // Theme actions
    fetchThemes: store.fetchThemes,
    createTheme: store.createTheme,
    updateTheme: store.updateTheme,
    deleteTheme: store.deleteTheme,
    lockTheme: store.lockTheme,
    unlockTheme: store.unlockTheme,

    // SubTheme actions
    fetchSubThemes: store.fetchSubThemes,
    prefetchSubThemes: store.prefetchSubThemes,
    createSubTheme: store.createSubTheme,
    updateSubTheme: store.updateSubTheme,
    deleteSubTheme: store.deleteSubTheme,
    mergeSubThemes: store.mergeSubThemes,
    lockSubTheme: store.lockSubTheme,
    unlockSubTheme: store.unlockSubTheme,

    // Feedback actions
    fetchFeedback: store.fetchFeedback,
    moveFeedback: store.moveFeedback,
    setFilters: store.setFilters,
    setSortBy: store.setSortBy,
    setSearchQuery: store.setSearchQuery,
    clearFilters: store.clearFilters,

    // CustomerAsk actions
    fetchCustomerAsks: store.fetchCustomerAsks,
    prefetchCustomerAsks: store.prefetchCustomerAsks,
    selectCustomerAsk: store.selectCustomerAsk,
    updateCustomerAskStatus: store.updateCustomerAskStatus,
    clearCustomerAsks: store.clearCustomerAsks,

    // TranscriptClassification actions
    fetchTranscriptCounts: store.fetchTranscriptCounts,
    fetchTranscriptClassifications: store.fetchTranscriptClassifications,
    selectTranscriptClassification: store.selectTranscriptClassification,
    clearTranscriptClassifications: store.clearTranscriptClassifications,

    // Mentions actions
    fetchMentions: store.fetchMentions,
    prefetchMentions: store.prefetchMentions,
    fetchMoreMentions: store.fetchMoreMentions,
    clearMentions: store.clearMentions,
    openMentionsPanel: store.openMentionsPanel,
    closeMentionsPanel: store.closeMentionsPanel,
    toggleMentionExpand: store.toggleMentionExpand,

    // Selection actions
    selectTheme: store.selectTheme,
    selectSubTheme: store.selectSubTheme,
    selectFeedback: store.selectFeedback,
    expandFeedback: store.expandFeedback,

    // Navigation actions
    navigateToTheme: store.navigateToTheme,
    navigateToSubTheme: store.navigateToSubTheme,
    navigateToFeedback: store.navigateToFeedback,
    navigateBack: store.navigateBack,

    // Panel actions
    toggleSearch: store.toggleSearch,
    toggleFilterPanel: store.toggleFilterPanel,
    openDetailPanel: store.openDetailPanel,
    closeDetailPanel: store.closeDetailPanel,

    // Dialog actions
    openAddThemeDialog: store.openAddThemeDialog,
    closeAddThemeDialog: store.closeAddThemeDialog,
    openAddSubThemeDialog: store.openAddSubThemeDialog,
    closeAddSubThemeDialog: store.closeAddSubThemeDialog,
    openEditThemeDialog: store.openEditThemeDialog,
    closeEditThemeDialog: store.closeEditThemeDialog,
    openEditSubThemeDialog: store.openEditSubThemeDialog,
    closeEditSubThemeDialog: store.closeEditSubThemeDialog,
    openMergeDialog: store.openMergeDialog,
    closeMergeDialog: store.closeMergeDialog,
    openDeleteConfirm: store.openDeleteConfirm,
    closeDeleteConfirm: store.closeDeleteConfirm,

    // Global actions
    initialize: store.initialize,
    reset: store.reset,
  };
};
