/**
 * Themes Store
 * Manages state for theme hierarchy: Theme -> SubTheme -> CustomerAsk
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { themesApi } from '@/services/themes.api';
import type {
  Theme,
  ThemeCreate,
  ThemeUpdate,
  ThemeHierarchy,
  SubTheme,
  SubThemeCreate,
  SubThemeUpdate,
  CustomerAsk,
  CustomerAskCreate,
  CustomerAskUpdate,
} from '@/shared/types/api.types';

interface ThemesState {
  // Data
  themes: Theme[];
  hierarchy: ThemeHierarchy[];
  selectedTheme: Theme | null;
  selectedSubTheme: SubTheme | null;
  selectedCustomerAsk: CustomerAsk | null;
  customerAsks: CustomerAsk[];

  // Loading states
  isLoading: boolean;
  isLoadingHierarchy: boolean;
  isLoadingCustomerAsks: boolean;

  // Error state
  error: string | null;

  // Theme Actions
  fetchThemes: () => Promise<void>;
  fetchThemeHierarchy: () => Promise<void>;
  createTheme: (data: ThemeCreate) => Promise<Theme>;
  updateTheme: (themeId: string, data: ThemeUpdate) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  reorderThemes: (themeIds: string[]) => Promise<void>;

  // SubTheme Actions
  createSubTheme: (data: SubThemeCreate) => Promise<SubTheme>;
  updateSubTheme: (subThemeId: string, data: SubThemeUpdate) => Promise<void>;
  deleteSubTheme: (subThemeId: string) => Promise<void>;
  moveSubTheme: (subThemeId: string, newThemeId: string) => Promise<void>;

  // CustomerAsk Actions
  fetchCustomerAsks: (subThemeId?: string, status?: string) => Promise<void>;
  createCustomerAsk: (data: CustomerAskCreate) => Promise<CustomerAsk>;
  updateCustomerAsk: (
    customerAskId: string,
    data: CustomerAskUpdate
  ) => Promise<void>;
  deleteCustomerAsk: (customerAskId: string) => Promise<void>;
  moveCustomerAsk: (customerAskId: string, newSubThemeId: string) => Promise<void>;
  searchCustomerAsks: (query: string) => Promise<CustomerAsk[]>;

  // Selection
  setSelectedTheme: (theme: Theme | null) => void;
  setSelectedSubTheme: (subTheme: SubTheme | null) => void;
  setSelectedCustomerAsk: (customerAsk: CustomerAsk | null) => void;

  // Utility
  clearError: () => void;
  getThemeById: (themeId: string) => Theme | undefined;
  getSubThemeById: (subThemeId: string) => SubTheme | undefined;
  getCustomerAskById: (customerAskId: string) => CustomerAsk | undefined;
}

export const useThemesStore = create<ThemesState>()(
  devtools(
    (set, get) => ({
      // Initial state
      themes: [],
      hierarchy: [],
      selectedTheme: null,
      selectedSubTheme: null,
      selectedCustomerAsk: null,
      customerAsks: [],
      isLoading: false,
      isLoadingHierarchy: false,
      isLoadingCustomerAsks: false,
      error: null,

      // Theme Actions
      fetchThemes: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await themesApi.listThemes();
          set({ themes: response.themes, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch themes',
            isLoading: false,
          });
        }
      },

      fetchThemeHierarchy: async () => {
        set({ isLoadingHierarchy: true, error: null });
        try {
          const hierarchy = await themesApi.getThemeHierarchy();
          set({ hierarchy, isLoadingHierarchy: false });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to fetch hierarchy',
            isLoadingHierarchy: false,
          });
        }
      },

      createTheme: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const theme = await themesApi.createTheme(data);
          set((state) => ({
            themes: [...state.themes, theme],
            isLoading: false,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
          return theme;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create theme',
            isLoading: false,
          });
          throw error;
        }
      },

      updateTheme: async (themeId, data) => {
        try {
          const updated = await themesApi.updateTheme(themeId, data);
          set((state) => ({
            themes: state.themes.map((t) => (t.id === themeId ? updated : t)),
            selectedTheme:
              state.selectedTheme?.id === themeId ? updated : state.selectedTheme,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update theme',
          });
          throw error;
        }
      },

      deleteTheme: async (themeId) => {
        try {
          await themesApi.deleteTheme(themeId);
          set((state) => ({
            themes: state.themes.filter((t) => t.id !== themeId),
            selectedTheme:
              state.selectedTheme?.id === themeId ? null : state.selectedTheme,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete theme',
          });
          throw error;
        }
      },

      reorderThemes: async (themeIds) => {
        try {
          const themes = await themesApi.reorderThemes(themeIds);
          set({ themes });
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to reorder themes',
          });
          throw error;
        }
      },

      // SubTheme Actions
      createSubTheme: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const subTheme = await themesApi.createSubTheme(data);
          // Refresh hierarchy to include new sub-theme
          await get().fetchThemeHierarchy();
          set({ isLoading: false });
          return subTheme;
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to create sub-theme',
            isLoading: false,
          });
          throw error;
        }
      },

      updateSubTheme: async (subThemeId, data) => {
        try {
          await themesApi.updateSubTheme(subThemeId, data);
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to update sub-theme',
          });
          throw error;
        }
      },

      deleteSubTheme: async (subThemeId) => {
        try {
          await themesApi.deleteSubTheme(subThemeId);
          set((state) => ({
            selectedSubTheme:
              state.selectedSubTheme?.id === subThemeId
                ? null
                : state.selectedSubTheme,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to delete sub-theme',
          });
          throw error;
        }
      },

      moveSubTheme: async (subThemeId, newThemeId) => {
        try {
          await themesApi.moveSubTheme(subThemeId, newThemeId);
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to move sub-theme',
          });
          throw error;
        }
      },

      // CustomerAsk Actions
      fetchCustomerAsks: async (subThemeId, status) => {
        set({ isLoadingCustomerAsks: true, error: null });
        try {
          const response = await themesApi.listCustomerAsks(subThemeId, status);
          set({ customerAsks: response.customer_asks, isLoadingCustomerAsks: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch customer asks',
            isLoadingCustomerAsks: false,
          });
        }
      },

      createCustomerAsk: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const customerAsk = await themesApi.createCustomerAsk(data);
          set((state) => ({
            customerAsks: [...state.customerAsks, customerAsk],
            isLoading: false,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
          return customerAsk;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to create customer ask',
            isLoading: false,
          });
          throw error;
        }
      },

      updateCustomerAsk: async (customerAskId, data) => {
        try {
          const updated = await themesApi.updateCustomerAsk(customerAskId, data);
          set((state) => ({
            customerAsks: state.customerAsks.map((ca) =>
              ca.id === customerAskId ? updated : ca
            ),
            selectedCustomerAsk:
              state.selectedCustomerAsk?.id === customerAskId
                ? updated
                : state.selectedCustomerAsk,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to update customer ask',
          });
          throw error;
        }
      },

      deleteCustomerAsk: async (customerAskId) => {
        try {
          await themesApi.deleteCustomerAsk(customerAskId);
          set((state) => ({
            customerAsks: state.customerAsks.filter((ca) => ca.id !== customerAskId),
            selectedCustomerAsk:
              state.selectedCustomerAsk?.id === customerAskId
                ? null
                : state.selectedCustomerAsk,
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to delete customer ask',
          });
          throw error;
        }
      },

      moveCustomerAsk: async (customerAskId, newSubThemeId) => {
        try {
          const updated = await themesApi.moveCustomerAsk(customerAskId, newSubThemeId);
          set((state) => ({
            customerAsks: state.customerAsks.map((ca) =>
              ca.id === customerAskId ? updated : ca
            ),
          }));
          // Refresh hierarchy
          get().fetchThemeHierarchy();
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to move customer ask',
          });
          throw error;
        }
      },

      searchCustomerAsks: async (query) => {
        try {
          return await themesApi.searchCustomerAsks(query);
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to search customer asks',
          });
          throw error;
        }
      },

      // Selection
      setSelectedTheme: (theme) => set({ selectedTheme: theme }),
      setSelectedSubTheme: (subTheme) => set({ selectedSubTheme: subTheme }),
      setSelectedCustomerAsk: (customerAsk) =>
        set({ selectedCustomerAsk: customerAsk }),

      // Utility
      clearError: () => set({ error: null }),

      getThemeById: (themeId) => get().themes.find((t) => t.id === themeId),

      getSubThemeById: (subThemeId) => {
        for (const theme of get().hierarchy) {
          const subTheme = theme.sub_themes.find((st) => st.id === subThemeId);
          if (subTheme) return subTheme;
        }
        return undefined;
      },

      getCustomerAskById: (customerAskId) =>
        get().customerAsks.find((ca) => ca.id === customerAskId),
    }),
    { name: 'themes-store' }
  )
);

export default useThemesStore;
