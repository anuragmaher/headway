/**
 * Zustand store for onboarding state management
 *
 * Data is stored in proper tables:
 * - Company data → companies table
 * - Themes/sub-themes → themes & sub_themes tables
 * - Connected sources → workspace_connectors table
 * - Competitors → competitors table
 * - Progress tracking → onboarding_progress table (only current_step)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OnboardingWizardState,
  CompanySetupData,
  Competitor,
  ConnectedSource,
  TaxonomyStatus,
  TaxonomySubStep,
  Theme,
} from '../types';
import { INITIAL_WIZARD_STATE } from '../types';
import { onboardingApi } from '../services/onboarding-api';

interface OnboardingActions {
  // Step navigation
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Company data (Step 0)
  updateCompanyData: (data: Partial<CompanySetupData>) => void;
  setCompanyData: (data: CompanySetupData) => void;

  // Taxonomy (Step 1)
  setTaxonomyUrl: (url: string) => void;
  setTaxonomyThemes: (themes: Theme[]) => void;
  toggleThemeSelection: (themeName: string) => void;
  setTaxonomyStatus: (status: TaxonomyStatus) => void;
  setTaxonomyError: (error: string | null) => void;
  setTaxonomySubStep: (subStep: TaxonomySubStep) => void;

  // Connected sources (Step 2)
  setConnectedSources: (sources: ConnectedSource[]) => void;

  // Competitors (Step 3)
  addCompetitor: (competitor: Competitor) => void;
  removeCompetitor: (competitorName: string) => void;
  setCompetitors: (competitors: Competitor[]) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  resetWizard: () => void;

  // Server-side persistence
  loadProgress: (workspaceId: string) => Promise<void>;
  saveProgress: (workspaceId: string) => Promise<void>;
  loadCompanyData: (workspaceId: string) => Promise<void>;
  saveCompanyData: (workspaceId: string) => Promise<void>;
  loadConnectedSources: (workspaceId: string) => Promise<void>;
  loadCompetitors: (workspaceId: string) => Promise<void>;
  saveSelectedThemes: (workspaceId: string) => Promise<void>;
  saveCompetitorsToServer: (workspaceId: string) => Promise<void>;
}

type OnboardingStore = OnboardingWizardState & OnboardingActions;

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_WIZARD_STATE,

      // ============================================
      // Step Navigation
      // ============================================

      setCurrentStep: (step) => set({ currentStep: step }),

      completeStep: (step) =>
        set((state) => ({
          completedSteps: [...new Set([...state.completedSteps, step])],
        })),

      goToNextStep: () =>
        set((state) => {
          const nextStep = Math.min(state.currentStep + 1, 3);
          return {
            currentStep: nextStep,
            completedSteps: [...new Set([...state.completedSteps, state.currentStep])],
          };
        }),

      goToPreviousStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),

      // ============================================
      // Company Data (Step 0)
      // ============================================

      updateCompanyData: (data) =>
        set((state) => ({
          companyData: { ...state.companyData, ...data },
        })),

      setCompanyData: (data) => set({ companyData: data }),

      // ============================================
      // Taxonomy (Step 1)
      // ============================================

      setTaxonomyUrl: (url) =>
        set((state) => ({
          taxonomyData: { ...state.taxonomyData, url },
        })),

      setTaxonomyThemes: (themes) =>
        set((state) => ({
          taxonomyData: {
            ...state.taxonomyData,
            themes,
            // Clear selected themes when themes are cleared (regeneration)
            selectedThemes: themes.length === 0 ? [] : state.taxonomyData.selectedThemes,
          },
        })),

      toggleThemeSelection: (themeName) =>
        set((state) => {
          const selected = state.taxonomyData.selectedThemes;
          const newSelected = selected.includes(themeName)
            ? selected.filter((t) => t !== themeName)
            : [...selected, themeName];
          return {
            taxonomyData: { ...state.taxonomyData, selectedThemes: newSelected },
          };
        }),

      setTaxonomyStatus: (status) => set({ taxonomyStatus: status }),

      setTaxonomyError: (error) =>
        set({ taxonomyError: error, taxonomyStatus: error ? 'failed' : 'idle' }),

      setTaxonomySubStep: (subStep) => set({ taxonomySubStep: subStep }),

      // ============================================
      // Connected Sources (Step 2)
      // ============================================

      setConnectedSources: (sources) => set({ connectedSources: sources }),

      // ============================================
      // Competitors (Step 3)
      // ============================================

      addCompetitor: (competitor) =>
        set((state) => {
          if (state.selectedCompetitors.some((c) => c.name.toLowerCase() === competitor.name.toLowerCase())) {
            return state;
          }
          return {
            selectedCompetitors: [...state.selectedCompetitors, competitor],
          };
        }),

      removeCompetitor: (competitorName) =>
        set((state) => ({
          selectedCompetitors: state.selectedCompetitors.filter(
            (c) => c.name !== competitorName
          ),
        })),

      setCompetitors: (competitors) => set({ selectedCompetitors: competitors }),

      // ============================================
      // State Management
      // ============================================

      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      setError: (error) => set({ error }),
      resetWizard: () => set(INITIAL_WIZARD_STATE),

      // ============================================
      // Server-Side Persistence
      // ============================================

      // Load company data from companies table
      loadCompanyData: async (workspaceId: string) => {
        try {
          const companyData = await onboardingApi.getCompanyData(workspaceId);
          set({
            companyData: {
              name: companyData.name || '',
              website: companyData.website || '',
              industry: companyData.industry || '',
              teamSize: companyData.team_size || '',
              role: companyData.role || '',
            },
          });
        } catch (error) {
          console.error('Failed to load company data:', error);
          // Don't set error - company might not exist yet
        }
      },

      // Save company data to companies table
      saveCompanyData: async (workspaceId: string) => {
        const state = get();
        set({ isSaving: true, error: null });
        try {
          await onboardingApi.saveCompanyData(workspaceId, {
            name: state.companyData.name,
            website: state.companyData.website || undefined,
            industry: state.companyData.industry,
            team_size: state.companyData.teamSize || undefined,
            role: state.companyData.role || undefined,
          });
          set({ isSaving: false });
        } catch (error) {
          console.error('Failed to save company data:', error);
          set({ isSaving: false, error: 'Failed to save company data' });
          throw error;
        }
      },

      // Load connected sources from workspace_connectors table
      loadConnectedSources: async (workspaceId: string) => {
        try {
          const sources = await onboardingApi.getConnectedSources(workspaceId);
          set({ connectedSources: sources });
        } catch (error) {
          console.error('Failed to load connected sources:', error);
        }
      },

      // Load competitors from competitors table
      loadCompetitors: async (workspaceId: string) => {
        try {
          const competitors = await onboardingApi.getCompetitors(workspaceId);
          set({ selectedCompetitors: competitors });
        } catch (error) {
          console.error('Failed to load competitors:', error);
        }
      },

      // Save selected themes to themes table
      saveSelectedThemes: async (workspaceId: string) => {
        const state = get();
        set({ isSaving: true, error: null });
        try {
          // Filter themes by selected names
          const selectedThemes = state.taxonomyData.themes.filter((t) =>
            state.taxonomyData.selectedThemes.includes(t.name)
          );

          if (selectedThemes.length > 0) {
            await onboardingApi.saveThemesBulk(workspaceId, selectedThemes);
          }
          set({ isSaving: false });
        } catch (error) {
          console.error('Failed to save themes:', error);
          set({ isSaving: false, error: 'Failed to save themes' });
          throw error;
        }
      },

      // Save competitors to competitors table
      saveCompetitorsToServer: async (workspaceId: string) => {
        const state = get();
        set({ isSaving: true, error: null });
        try {
          await onboardingApi.saveCompetitors(workspaceId, state.selectedCompetitors);
          set({ isSaving: false });
        } catch (error) {
          console.error('Failed to save competitors:', error);
          set({ isSaving: false, error: 'Failed to save competitors' });
          throw error;
        }
      },

      // Load progress from server (only current_step, actual data loaded separately)
      loadProgress: async (workspaceId: string) => {
        set({ isLoading: true, error: null });
        try {
          // Load all data in parallel
          const [progress] = await Promise.all([
            onboardingApi.getOnboardingProgress(workspaceId),
            get().loadCompanyData(workspaceId),
            get().loadConnectedSources(workspaceId),
            get().loadCompetitors(workspaceId),
          ]);

          if (progress) {
            set({
              currentStep: progress.current_step,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Failed to load onboarding progress:', error);
          set({ isLoading: false, error: 'Failed to load progress' });
        }
      },

      // Save progress to server (only current_step)
      saveProgress: async (workspaceId: string) => {
        const state = get();
        set({ isSaving: true, error: null });
        try {
          await onboardingApi.saveOnboardingProgress(workspaceId, {
            current_step: state.currentStep,
          });
          set({ isSaving: false });
        } catch (error) {
          console.error('Failed to save onboarding progress:', error);
          set({ isSaving: false, error: 'Failed to save progress' });
        }
      },
    }),
    {
      name: 'headway-onboarding',
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        companyData: state.companyData,
        taxonomyData: state.taxonomyData,
        taxonomySubStep: state.taxonomySubStep,
        selectedCompetitors: state.selectedCompetitors,
      }),
    }
  )
);

// ============================================
// Selector Hooks
// ============================================

export const useCurrentStep = () =>
  useOnboardingStore((state) => state.currentStep);

export const useCompletedSteps = () =>
  useOnboardingStore((state) => state.completedSteps);

export const useCompanyData = () =>
  useOnboardingStore((state) => state.companyData);

export const useTaxonomyData = () =>
  useOnboardingStore((state) => state.taxonomyData);

export const useTaxonomyStatus = () =>
  useOnboardingStore((state) => ({
    status: state.taxonomyStatus,
    error: state.taxonomyError,
  }));

export const useTaxonomySubStep = () =>
  useOnboardingStore((state) => state.taxonomySubStep);

export const useConnectedSources = () =>
  useOnboardingStore((state) => state.connectedSources);

export const useSelectedCompetitors = () =>
  useOnboardingStore((state) => state.selectedCompetitors);
