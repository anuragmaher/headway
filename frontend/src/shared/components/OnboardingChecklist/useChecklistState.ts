/**
 * Hook for computing checklist state from onboarding store
 * Derives step completion from actual data, not navigation state
 */

import { useMemo } from 'react';
import { useOnboardingStore } from '@/shared/store/onboardingStore';
import { CHECKLIST_STEPS_CONFIG, type ChecklistState, type ChecklistStep } from './types';

/**
 * Computes the checklist state by mapping onboarding status to steps
 * Each step's completion is derived from actual data checks, not wizard navigation
 */
export function useChecklistState(): ChecklistState {
  const onboardingStatus = useOnboardingStore((state) => state.onboardingStatus);

  const state = useMemo(() => {
    // Map each step config to include completion status from onboardingStore
    const steps: ChecklistStep[] = CHECKLIST_STEPS_CONFIG.map((config) => {
      let isComplete = false;

      // Derive completion from actual onboarding status
      switch (config.wizardStepIndex) {
        case 0: // Company Details
          isComplete = onboardingStatus.companyDetails;
          break;
        case 1: // Data Sources
          isComplete = onboardingStatus.dataSources;
          break;
        case 2: // Themes
          isComplete = onboardingStatus.themes;
          break;
        case 3: // Competitors
          isComplete = onboardingStatus.competitors;
          break;
        default:
          isComplete = false;
      }

      return {
        ...config,
        isComplete,
      };
    });

    const completedCount = steps.filter((step) => step.isComplete).length;
    const totalCount = steps.length;
    const isAllComplete = completedCount === totalCount;

    return {
      steps,
      completedCount,
      totalCount,
      isAllComplete,
    };
  }, [onboardingStatus]);

  return state;
}
