/**
 * Zustand store for Onboarding state management
 * Checks if user has completed onboarding: company details, data sources, themes, and competitors
 */

import { create } from 'zustand';
import { companyService, type CompanyDetails } from '@/services/company';
import { connectorService } from '@/services/connectors';
import { slackService } from '@/services/slack';
import { getGmailAccounts } from '@/services/gmail';
import { API_BASE_URL } from '@/config/api.config';

export interface OnboardingStatus {
  companyDetails: boolean;
  dataSources: boolean;
  themes: boolean;
  competitors: boolean;
}

interface OnboardingState {
  // Status
  isChecking: boolean;
  hasChecked: boolean;
  isOnboardingComplete: boolean;
  onboardingStatus: OnboardingStatus;
  currentWorkspaceId: string | null; // Track current workspace for localStorage keys
  
  // Actions
  checkOnboardingStatus: (workspaceId: string, accessToken: string) => Promise<void>;
  resetOnboarding: () => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  forceRecheck: () => void;
  
  // State
  showOnboardingDialog: boolean;
}

// Use workspace-specific keys to support multiple workspaces
const getOnboardingDismissedKey = (workspaceId: string) => `headway-onboarding-dismissed-${workspaceId}`;
const getOnboardingCompleteKey = (workspaceId: string) => `headway-onboarding-complete-${workspaceId}`;
// Legacy keys (for backwards compat - we'll migrate away from these)
const LEGACY_ONBOARDING_DISMISSED_KEY = 'headway-onboarding-dismissed';
const LEGACY_ONBOARDING_COMPLETE_KEY = 'headway-onboarding-complete';

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  isChecking: false,
  hasChecked: false,
  isOnboardingComplete: false,
  showOnboardingDialog: false,
  currentWorkspaceId: null,
  onboardingStatus: {
    companyDetails: false,
    dataSources: false,
    themes: false,
    competitors: false,
  },

  checkOnboardingStatus: async (workspaceId: string, accessToken: string) => {
    const currentState = get();
    
    // Don't check again if already checking
    if (currentState.isChecking) {
      console.log('[Onboarding] Already checking, skipping...');
      return;
    }

    // Skip if already checked for THIS workspace
    if (currentState.hasChecked) {
      console.log('[Onboarding] Already checked, skipping...');
      return;
    }

    // Clear legacy keys on first check (migration)
    localStorage.removeItem(LEGACY_ONBOARDING_DISMISSED_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);

    // Early exit: Check if onboarding was dismissed or completed for THIS workspace
    // This prevents unnecessary API calls when navigating between pages
    const wasDismissed = localStorage.getItem(getOnboardingDismissedKey(workspaceId)) === 'true';
    const wasCompleted = localStorage.getItem(getOnboardingCompleteKey(workspaceId)) === 'true';
    
    if (wasDismissed || wasCompleted) {
      console.log('[Onboarding] Onboarding already dismissed or completed for workspace:', workspaceId);
      set({
        hasChecked: true,
        isOnboardingComplete: wasCompleted,
        showOnboardingDialog: false,
        onboardingStatus: wasCompleted ? {
          companyDetails: true,
          dataSources: true,
          themes: true,
          competitors: true,
        } : currentState.onboardingStatus,
      });
      return;
    }

    console.log('[Onboarding] Starting onboarding status check...');
    console.log('[Onboarding] Workspace ID:', workspaceId);
    
    set({ isChecking: true, currentWorkspaceId: workspaceId });

    try {
      // Run all checks in parallel for better performance
      const [companyDetailsResult, dataSourcesResult, themesResult, competitorsResult] = await Promise.all([
        checkCompanyDetails(workspaceId),
        checkDataSources(workspaceId),
        checkThemes(workspaceId, accessToken),
        checkCompetitors(workspaceId, accessToken),
      ]);

      console.log('[Onboarding] Check results:', {
        companyDetails: companyDetailsResult,
        dataSources: dataSourcesResult,
        themes: themesResult,
        competitors: competitorsResult,
      });

      const onboardingStatus: OnboardingStatus = {
        companyDetails: companyDetailsResult,
        dataSources: dataSourcesResult,
        themes: themesResult,
        competitors: competitorsResult,
      };

      // Core onboarding is complete if company details, data sources, and themes are done
      // Competitors is tracked separately but included for checklist purposes
      const isComplete = companyDetailsResult && dataSourcesResult && themesResult;
      
      // Check if user previously dismissed the onboarding dialog for THIS workspace
      const dismissedKey = getOnboardingDismissedKey(workspaceId);
      const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
      console.log('[Onboarding] Was dismissed:', wasDismissed);
      console.log('[Onboarding] Is complete:', isComplete);

      // Store completion status in localStorage to avoid future API calls
      if (isComplete) {
        localStorage.setItem(getOnboardingCompleteKey(workspaceId), 'true');
      }

      // Determine if we should show the dialog
      const shouldShowDialog = !isComplete && !wasDismissed;
      console.log('[Onboarding] Should show dialog:', shouldShowDialog);

      set({
        isChecking: false,
        hasChecked: true,
        onboardingStatus,
        isOnboardingComplete: isComplete,
        showOnboardingDialog: shouldShowDialog,
      });
    } catch (error) {
      console.error('[Onboarding] Failed to check onboarding status:', error);
      set({
        isChecking: false,
        hasChecked: true,
        // On error, show the dialog to let user complete onboarding manually
        isOnboardingComplete: false,
        showOnboardingDialog: true,
        onboardingStatus: {
          companyDetails: false,
          dataSources: false,
          themes: false,
          competitors: false,
        },
      });
    }
  },

  resetOnboarding: () => {
    console.log('[Onboarding] Resetting onboarding state');
    const workspaceId = get().currentWorkspaceId;
    if (workspaceId) {
      localStorage.removeItem(getOnboardingDismissedKey(workspaceId));
      localStorage.removeItem(getOnboardingCompleteKey(workspaceId));
    }
    // Also clear legacy keys
    localStorage.removeItem(LEGACY_ONBOARDING_DISMISSED_KEY);
    localStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
    set({
      hasChecked: false,
      isOnboardingComplete: false,
      showOnboardingDialog: false,
      currentWorkspaceId: null,
      onboardingStatus: {
        companyDetails: false,
        dataSources: false,
        themes: false,
        competitors: false,
      },
    });
  },

  forceRecheck: () => {
    console.log('[Onboarding] Forcing recheck');
    set({
      hasChecked: false,
      isChecking: false,
    });
  },

  dismissOnboarding: () => {
    const workspaceId = get().currentWorkspaceId;
    console.log('[Onboarding] Dismissing onboarding dialog for workspace:', workspaceId);
    if (workspaceId) {
      localStorage.setItem(getOnboardingDismissedKey(workspaceId), 'true');
    }
    set({ showOnboardingDialog: false });
  },

  completeOnboarding: () => {
    const workspaceId = get().currentWorkspaceId;
    console.log('[Onboarding] Completing onboarding for workspace:', workspaceId);
    // Store completion in localStorage to prevent future API calls
    if (workspaceId) {
      localStorage.setItem(getOnboardingCompleteKey(workspaceId), 'true');
    }
    // Don't set dismissed flag - the user completed everything
    // Just close the dialog and mark as complete
    set({ 
      showOnboardingDialog: false,
      isOnboardingComplete: true,
      hasChecked: true, // Mark as checked to prevent rechecking
    });
  },
}));

// Helper function to check if company details are filled
async function checkCompanyDetails(workspaceId: string): Promise<boolean> {
  try {
    console.log('[Onboarding] Checking company details...');
    const details: CompanyDetails = await companyService.getCompanyDetails(workspaceId);
    console.log('[Onboarding] Company details:', details);
    
    // Company details are considered complete if name and description are filled
    const isComplete = Boolean(
      details.name && details.name.trim() !== '' && 
      details.description && details.description.trim() !== ''
    );
    console.log('[Onboarding] Company details complete:', isComplete);
    return isComplete;
  } catch (error) {
    console.error('[Onboarding] Failed to check company details:', error);
    return false;
  }
}

// Helper function to check if any data sources are connected
async function checkDataSources(workspaceId: string): Promise<boolean> {
  try {
    console.log('[Onboarding] Checking data sources...');
    
    // Check all data sources in parallel
    const [slackIntegrations, gmailAccounts, connectors] = await Promise.all([
      slackService.getIntegrations().catch((e) => {
        console.log('[Onboarding] Slack check failed:', e);
        return [];
      }),
      getGmailAccounts().catch((e) => {
        console.log('[Onboarding] Gmail check failed:', e);
        return [];
      }),
      connectorService.getConnectors(workspaceId).catch((e) => {
        console.log('[Onboarding] Connectors check failed:', e);
        return [];
      }),
    ]);

    // Check for specific connector types (Gong and Fathom)
    const hasGong = connectors.some(c => c.connector_type === 'gong' && c.is_active);
    const hasFathom = connectors.some(c => c.connector_type === 'fathom' && c.is_active);
    const hasOtherConnectors = connectors.some(c => 
      c.connector_type !== 'gong' && 
      c.connector_type !== 'fathom' && 
      c.is_active
    );

    console.log('[Onboarding] Data sources:', {
      slack: slackIntegrations.length,
      gmail: gmailAccounts.length,
      gong: hasGong,
      fathom: hasFathom,
      otherConnectors: hasOtherConnectors,
    });

    // Check if any data source is connected
    const hasSlack = slackIntegrations.length > 0;
    const hasGmail = gmailAccounts.length > 0;
    const hasConnectors = hasGong || hasFathom || hasOtherConnectors;

    const hasAnyDataSource = hasSlack || hasGmail || hasConnectors;
    console.log('[Onboarding] Has any data source:', hasAnyDataSource);
    console.log('[Onboarding] Data source breakdown:', {
      slack: hasSlack,
      gmail: hasGmail,
      gong: hasGong,
      fathom: hasFathom,
      otherConnectors: hasOtherConnectors,
    });
    return hasAnyDataSource;
  } catch (error) {
    console.error('[Onboarding] Failed to check data sources:', error);
    return false;
  }
}

// Helper function to check if any themes exist
async function checkThemes(workspaceId: string, accessToken: string): Promise<boolean> {
  try {
    console.log('[Onboarding] Checking themes...');
    const url = `${API_BASE_URL}/api/v1/features/themes?workspace_id=${workspaceId}`;
    console.log('[Onboarding] Themes URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Onboarding] Themes fetch failed:', response.status);
      throw new Error(`Failed to fetch themes: ${response.status}`);
    }

    const themes = await response.json();
    console.log('[Onboarding] Themes count:', Array.isArray(themes) ? themes.length : 'not an array');

    const hasThemes = Array.isArray(themes) && themes.length > 0;
    console.log('[Onboarding] Has themes:', hasThemes);
    return hasThemes;
  } catch (error) {
    console.error('[Onboarding] Failed to check themes:', error);
    return false;
  }
}

// Helper function to check if any competitors exist
async function checkCompetitors(workspaceId: string, accessToken: string): Promise<boolean> {
  try {
    console.log('[Onboarding] Checking competitors...');
    const url = `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Onboarding] Competitors fetch failed:', response.status);
      // Return false on error - competitors are optional
      return false;
    }

    const data = await response.json();
    const competitors = data.competitors || [];
    console.log('[Onboarding] Competitors count:', competitors.length);

    const hasCompetitors = competitors.length > 0;
    console.log('[Onboarding] Has competitors:', hasCompetitors);
    return hasCompetitors;
  } catch (error) {
    console.error('[Onboarding] Failed to check competitors:', error);
    return false;
  }
}

// Selector hooks for easier component usage
export const useOnboardingStatus = () => useOnboardingStore((state) => state.onboardingStatus);
export const useIsOnboardingComplete = () => useOnboardingStore((state) => state.isOnboardingComplete);
export const useShowOnboardingDialog = () => useOnboardingStore((state) => state.showOnboardingDialog);
