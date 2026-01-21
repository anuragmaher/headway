/**
 * Zustand store for onboarding state management
 * State is persisted both locally via zustand/persist and server-side via API
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OnboardingWizardState,
  CompanySetupData,
  Competitor,
  TaxonomyStatus,
  TaxonomySubStep,
  Theme,
  OnboardingProgressResponse,
} from '../types';
import { INITIAL_WIZARD_STATE } from '../types';
import { onboardingApi } from '../services/onboarding-api';

interface OnboardingActions {
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  updateCompanyData: (data: Partial<CompanySetupData>) => void;
  setCompanyData: (data: CompanySetupData) => void;
  setTaxonomyUrl: (url: string) => void;
  setTaxonomyThemes: (themes: Theme[]) => void;
  toggleThemeSelection: (themeName: string) => void;
  setTaxonomyStatus: (status: TaxonomyStatus) => void;
  setTaxonomyError: (error: string | null) => void;
  setTaxonomySubStep: (subStep: TaxonomySubStep) => void;
  addConnectedSource: (sourceId: string) => void;
  removeConnectedSource: (sourceId: string) => void;
  setConnectedSources: (sources: string[]) => void;
  addCompetitor: (competitor: Competitor) => void;
  removeCompetitor: (competitorName: string) => void;
  setCompetitors: (competitors: Competitor[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  resetWizard: () => void;
  // Server-side persistence
  loadProgress: (workspaceId: string) => Promise<void>;
  saveProgress: (workspaceId: string) => Promise<void>;
  loadCompanyData: (workspaceId: string) => Promise<void>;
  saveCompanyData: (workspaceId: string) => Promise<void>;
}

type OnboardingStore = OnboardingWizardState & OnboardingActions;

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_WIZARD_STATE,

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

      updateCompanyData: (data) =>
        set((state) => ({
          companyData: { ...state.companyData, ...data },
        })),

      setCompanyData: (data) => set({ companyData: data }),

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

      addConnectedSource: (sourceId) =>
        set((state) => ({
          connectedSources: [...new Set([...state.connectedSources, sourceId])],
        })),

      removeConnectedSource: (sourceId) =>
        set((state) => ({
          connectedSources: state.connectedSources.filter((s) => s !== sourceId),
        })),

      setConnectedSources: (sources) => set({ connectedSources: sources }),

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

      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      setError: (error) => set({ error }),
      resetWizard: () => set(INITIAL_WIZARD_STATE),

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
              role: '', // role is not stored in companies table
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
          });
          set({ isSaving: false });
        } catch (error) {
          console.error('Failed to save company data:', error);
          set({ isSaving: false, error: 'Failed to save company data' });
          throw error;
        }
      },

      // Load progress from server (excludes company data)
      loadProgress: async (workspaceId: string) => {
        set({ isLoading: true, error: null });
        try {
          // Load progress and company data in parallel
          const [progress] = await Promise.all([
            onboardingApi.getOnboardingProgress(workspaceId),
            get().loadCompanyData(workspaceId),
          ]);

          if (progress) {
            set({
              currentStep: progress.current_step,
              taxonomyData: progress.taxonomy_data
                ? {
                    url: progress.taxonomy_url || '',
                    themes: progress.taxonomy_data.themes || [],
                    selectedThemes: progress.selected_themes || [],
                  }
                : get().taxonomyData,
              connectedSources: progress.connected_sources || [],
              selectedCompetitors: progress.selected_competitors || [],
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

      // Save progress to server (excludes company data)
      saveProgress: async (workspaceId: string) => {
        const state = get();
        set({ isSaving: true, error: null });
        try {
          await onboardingApi.saveOnboardingProgress(workspaceId, {
            current_step: state.currentStep,
            taxonomy_url: state.taxonomyData.url || undefined,
            taxonomy_data: state.taxonomyData.themes.length > 0
              ? { themes: state.taxonomyData.themes }
              : undefined,
            selected_themes: state.taxonomyData.selectedThemes.length > 0
              ? state.taxonomyData.selectedThemes
              : undefined,
            connected_sources: state.connectedSources.length > 0
              ? state.connectedSources
              : undefined,
            selected_competitors: state.selectedCompetitors.length > 0
              ? state.selectedCompetitors
              : undefined,
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
        connectedSources: state.connectedSources,
        selectedCompetitors: state.selectedCompetitors,
      }),
    }
  )
);

// Selector hooks
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
