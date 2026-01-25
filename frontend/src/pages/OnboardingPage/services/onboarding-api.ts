/**
 * Onboarding API service
 *
 * Data is stored in proper tables:
 * - Company data → companies table
 * - Themes/sub-themes → themes & sub_themes tables
 * - Connected sources → workspace_connectors table
 * - Competitors → competitors table
 * - Progress tracking → onboarding_progress table (only current_step)
 */

import api from '@/services/api';
import type { User } from '@/features/auth/types/auth.types';
import type {
  CompanyDataResponse,
  Competitor,
  ConnectedSource,
  OnboardingProgressResponse,
  TaxonomyGenerateResponse,
  Theme,
  BulkThemeResponse,
} from '../types';

const BASE_URL = '/api/v1/onboarding';

// ============================================
// Options
// ============================================

export async function getOnboardingOptions(): Promise<{
  industries: string[];
  team_sizes: string[];
  roles: string[];
}> {
  const response = await api.get(`${BASE_URL}/options`);
  return response.data;
}

// ============================================
// Company Data (Step 0)
// ============================================

export async function getCompanyData(
  workspaceId: string
): Promise<CompanyDataResponse> {
  const response = await api.get(`${BASE_URL}/company`, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function saveCompanyData(
  workspaceId: string,
  data: {
    name: string;
    website?: string;
    industry: string;
    team_size?: string;
    role?: string;
    domains?: string[];
  }
): Promise<CompanyDataResponse> {
  const response = await api.post(`${BASE_URL}/company`, data, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

// ============================================
// Progress Tracking
// ============================================

export async function getOnboardingProgress(
  workspaceId: string
): Promise<OnboardingProgressResponse | null> {
  const response = await api.get(`${BASE_URL}/progress`, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function saveOnboardingProgress(
  workspaceId: string,
  data: {
    current_step: number;
  }
): Promise<OnboardingProgressResponse> {
  const response = await api.post(`${BASE_URL}/progress`, data, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function resetOnboardingProgress(
  workspaceId: string
): Promise<void> {
  await api.delete(`${BASE_URL}/progress`, {
    params: { workspace_id: workspaceId },
  });
}

// ============================================
// Taxonomy (Step 1)
// ============================================

export async function generateTaxonomy(
  workspaceId: string,
  url: string
): Promise<TaxonomyGenerateResponse> {
  const response = await api.post(`${BASE_URL}/taxonomy/generate`, {
    workspace_id: workspaceId,
    url,
  });
  return response.data;
}

export async function saveThemesBulk(
  workspaceId: string,
  themes: Theme[]
): Promise<BulkThemeResponse> {
  const response = await api.post(
    `${BASE_URL}/themes/bulk`,
    { themes },
    { params: { workspace_id: workspaceId } }
  );
  return response.data;
}

// ============================================
// Connected Sources (Step 2)
// ============================================

export async function getConnectedSources(
  workspaceId: string
): Promise<ConnectedSource[]> {
  const response = await api.get(`${BASE_URL}/connectors`, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

// ============================================
// Competitors (Step 3)
// ============================================

export async function getCompetitors(
  workspaceId: string
): Promise<Competitor[]> {
  const response = await api.get(`${BASE_URL}/competitors`, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function saveCompetitors(
  workspaceId: string,
  competitors: Competitor[]
): Promise<Competitor[]> {
  const response = await api.post(`${BASE_URL}/competitors`, competitors, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function addCompetitor(
  workspaceId: string,
  competitor: Competitor
): Promise<Competitor> {
  const response = await api.post(`${BASE_URL}/competitors/add`, competitor, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function removeCompetitor(
  workspaceId: string,
  competitorName: string
): Promise<void> {
  await api.delete(`${BASE_URL}/competitors/${encodeURIComponent(competitorName)}`, {
    params: { workspace_id: workspaceId },
  });
}

// ============================================
// Complete Onboarding
// ============================================

export async function completeOnboarding(): Promise<User> {
  const response = await api.post('/api/v1/auth/complete-onboarding');
  return response.data;
}

// ============================================
// Export all functions
// ============================================

export const onboardingApi = {
  getOnboardingOptions,
  getCompanyData,
  saveCompanyData,
  getOnboardingProgress,
  saveOnboardingProgress,
  resetOnboardingProgress,
  generateTaxonomy,
  saveThemesBulk,
  getConnectedSources,
  getCompetitors,
  saveCompetitors,
  addCompetitor,
  removeCompetitor,
  completeOnboarding,
};
