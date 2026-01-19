/**
 * ThemesPage Zustand Store
 *
 * Modular store combining all slices for theme, feature, message, and UI management.
 *
 * Structure:
 * - types.ts: Type definitions for state and actions
 * - utils.ts: Helper functions and selectors
 * - slices/: Individual state slices
 *   - themeSlice.ts: Theme CRUD operations
 *   - featureSlice.ts: Feature CRUD operations
 *   - messageSlice.ts: Message operations
 *   - uiSlice.ts: UI state (dialogs, menus, filters, views)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ThemesPageStore } from './types';
import {
  createThemeSlice,
  createFeatureSlice,
  createMessageSlice,
  createUISlice,
  initialThemeState,
  initialFeatureState,
  initialMessageState,
  initialUIState,
} from './slices';
import { filterAndSortFeatures } from './utils';

// ============================================================================
// Combined Initial State
// ============================================================================

const initialState = {
  ...initialThemeState,
  ...initialFeatureState,
  ...initialMessageState,
  ...initialUIState,
};

// ============================================================================
// Store Creation
// ============================================================================

export const useThemesPageStore = create<ThemesPageStore>()(
  devtools(
    (...args) => ({
      // Spread all slice states and actions
      ...createThemeSlice(...args),
      ...createFeatureSlice(...args),
      ...createMessageSlice(...args),
      ...createUISlice(...args),

      // Reset action that restores all state
      reset: () => args[0](initialState),
    }),
    { name: 'themes-page-store' }
  )
);

// ============================================================================
// Selectors / Hooks
// ============================================================================

/**
 * Hook to get filtered and sorted features based on current filters
 */
export const useFilteredAndSortedFeatures = () => {
  const themeFeatures = useThemesPageStore(state => state.themeFeatures);
  const filters = useThemesPageStore(state => state.filters);

  return filterAndSortFeatures(themeFeatures, filters);
};

// ============================================================================
// Re-exports
// ============================================================================

// Re-export types for consumers
export type { ThemesPageStore, ThemesPageState, ThemesPageActions } from './types';

// Re-export utils for direct usage
export { filterAndSortFeatures } from './utils';
