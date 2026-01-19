/**
 * Type definitions for ThemesPage store
 */

import {
  Theme,
  Feature,
  Message,
  ThemeFormData,
  ThemeWithChildren,
  MentionDetailsTab,
  DrawerLevel,
  FeatureFilters,
} from '../../types/ThemesTypes';
import { ThemeSuggestion, FeatureSuggestion } from '@/services/theme';

// ============================================================================
// State Slices
// ============================================================================

/** Theme-related state */
export interface ThemeState {
  themes: Theme[];
  hierarchicalThemes: ThemeWithChildren[];
  flattenedThemes: Theme[];
  selectedThemeForDrawer: Theme | null;
  expandedThemes: Set<string>;
  loading: boolean;
}

/** Feature-related state */
export interface FeatureState {
  themeFeatures: Feature[];
  selectedFeatureForMessages: Feature | null;
  loadingFeatures: boolean;
}

/** Message-related state */
export interface MessageState {
  featureMessages: Message[];
  selectedMessageId: string | null;
  loadingMessages: boolean;
}

/** View and navigation state */
export interface ViewState {
  showingAllFeatures: boolean;
  showingAllFeaturesList: boolean;
  showingSubThemes: boolean;
  showMessagesFullPage: boolean;
  mobileThemesDrawerOpen: boolean;
  mentionsDrawerOpen: boolean;
  drawerLevel: DrawerLevel;
  mentionDetailsTab: MentionDetailsTab;
}

/** Filter and sort state */
export interface FilterState {
  filters: FeatureFilters;
  showFilters: boolean;
}

/** Theme dialog state */
export interface ThemeDialogState {
  dialogOpen: boolean;
  editingTheme: Theme | null;
  formData: ThemeFormData;
  suggestions: ThemeSuggestion[];
  selectedThemeSuggestions: Set<number>;
  loadingSuggestions: boolean;
  loadingMoreSuggestions: boolean;
  savingTheme: boolean;
  themeError: string | null;
}

/** Feature dialog state */
export interface FeatureDialogState {
  // Edit modal
  editModalOpen: boolean;
  editingFeature: Feature | null;
  editFormData: { name: string; description: string };
  savingEdit: boolean;
  editError: string | null;
  // Add modal
  addModalOpen: boolean;
  addFormData: { name: string; description: string };
  savingAdd: boolean;
  addError: string | null;
  featureSuggestions: FeatureSuggestion[];
  selectedSuggestions: Set<number>;
  loadingFeatureSuggestions: boolean;
  loadingMoreFeatureSuggestions: boolean;
}

/** Delete confirmation state */
export interface DeleteState {
  deleteConfirmOpen: boolean;
  featureToDelete: Feature | null;
  deletingFeature: boolean;
  deleteMentionConfirmOpen: boolean;
  mentionToDelete: Message | null;
  deletingMention: boolean;
}

/** Menu state */
export interface MenuState {
  menuAnchorEl: HTMLElement | null;
  selectedThemeForMenu: Theme | null;
}

/** Slack connect dialog state */
export interface SlackDialogState {
  slackConnectDialogOpen: boolean;
  selectedThemeForSlack: Theme | null;
}

/** UI feedback state */
export interface FeedbackState {
  error: string | null;
  snackbarOpen: boolean;
  snackbarMessage: string;
}

/** Resizing state */
export interface ResizeState {
  featuresWidth: number;
  mentionsListWidth: number;
}

// ============================================================================
// Combined State
// ============================================================================

export interface ThemesPageState extends
  ThemeState,
  FeatureState,
  MessageState,
  ViewState,
  FilterState,
  ThemeDialogState,
  FeatureDialogState,
  DeleteState,
  MenuState,
  SlackDialogState,
  FeedbackState,
  ResizeState {}

// ============================================================================
// Action Slices
// ============================================================================

/** Theme actions */
export interface ThemeActions {
  setThemes: (themes: Theme[]) => void;
  fetchThemes: () => Promise<void>;
  createTheme: (formData: ThemeFormData) => Promise<void>;
  createMultipleThemes: (themes: Array<{ name: string; description: string; parent_theme_id: string | null }>) => Promise<void>;
  updateTheme: (themeId: string, formData: ThemeFormData) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  setSelectedThemeForDrawer: (theme: Theme | null) => void;
  toggleThemeExpansion: (themeId: string) => void;
}

/** Feature actions */
export interface FeatureActions {
  fetchThemeFeatures: (themeId: string) => Promise<void>;
  fetchAllFeatures: () => Promise<void>;
  updateFeature: (featureId: string, data: { name: string; description: string }) => Promise<void>;
  createFeature: (data: { name: string; description: string; theme_id: string | null }) => Promise<void>;
  createMultipleFeatures: (features: Array<{ name: string; description: string }>, themeId: string | null) => Promise<void>;
  deleteFeature: (featureId: string) => Promise<void>;
  updateFeatureTheme: (featureId: string, newThemeId: string | null) => Promise<void>;
  setSelectedFeatureForMessages: (feature: Feature | null) => void;
}

/** Message actions */
export interface MessageActions {
  fetchFeatureMessages: (featureId: string) => Promise<void>;
  deleteMention: (featureId: string, messageId: string) => Promise<void>;
  setSelectedMessageId: (id: string | null) => void;
}

/** View actions */
export interface ViewActions {
  handleAllThemesClick: () => void;
  handleAllFeaturesClick: () => void;
  handleThemeClick: (theme: Theme) => void;
  setShowingSubThemes: (value: boolean) => void;
  setShowMessagesFullPage: (value: boolean) => void;
  setMobileThemesDrawerOpen: (open: boolean) => void;
  setMentionsDrawerOpen: (open: boolean) => void;
  setDrawerLevel: (level: DrawerLevel) => void;
  setMentionDetailsTab: (tab: MentionDetailsTab) => void;
}

/** Filter actions */
export interface FilterActions {
  setFilters: (filters: Partial<FeatureFilters>) => void;
  clearFilters: () => void;
  setShowFilters: (show: boolean) => void;
}

/** Theme dialog actions */
export interface ThemeDialogActions {
  openThemeDialog: (theme?: Theme, parentThemeId?: string) => void;
  closeThemeDialog: () => void;
  setFormData: (data: Partial<ThemeFormData>) => void;
  loadThemeSuggestions: () => Promise<void>;
  loadMoreThemeSuggestions: () => Promise<void>;
  toggleThemeSuggestionSelection: (index: number) => void;
}

/** Feature dialog actions */
export interface FeatureDialogActions {
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
}

/** Delete actions */
export interface DeleteActions {
  openDeleteConfirm: (feature: Feature) => void;
  closeDeleteConfirm: () => void;
  confirmDeleteFeature: () => Promise<void>;
  openDeleteMentionConfirm: (message: Message) => void;
  closeDeleteMentionConfirm: () => void;
  confirmDeleteMention: () => Promise<void>;
}

/** Menu actions */
export interface MenuActions {
  openMenu: (event: React.MouseEvent<HTMLElement>, theme: Theme) => void;
  closeMenu: () => void;
  handleMenuAction: (action: 'edit' | 'delete' | 'add-sub' | 'slack') => void;
}

/** Slack dialog actions */
export interface SlackDialogActions {
  openSlackConnectDialog: (theme: Theme) => void;
  closeSlackConnectDialog: () => void;
}

/** Feedback actions */
export interface FeedbackActions {
  setError: (error: string | null) => void;
  showSnackbar: (message: string) => void;
  closeSnackbar: () => void;
}

/** Resize actions */
export interface ResizeActions {
  setFeaturesWidth: (width: number) => void;
  setMentionsListWidth: (width: number) => void;
}

/** Utility actions */
export interface UtilityActions {
  reset: () => void;
}

// ============================================================================
// Combined Actions
// ============================================================================

export interface ThemesPageActions extends
  ThemeActions,
  FeatureActions,
  MessageActions,
  ViewActions,
  FilterActions,
  ThemeDialogActions,
  FeatureDialogActions,
  DeleteActions,
  MenuActions,
  SlackDialogActions,
  FeedbackActions,
  ResizeActions,
  UtilityActions {}

// ============================================================================
// Store Type
// ============================================================================

export type ThemesPageStore = ThemesPageState & ThemesPageActions;
