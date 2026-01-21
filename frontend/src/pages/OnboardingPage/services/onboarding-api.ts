/**
 * Onboarding API service
 */

import api from '@/services/api';
import type { User } from '@/features/auth/types/auth.types';
import type {
  CompanySetupData,
  CompanyDataResponse,
  Competitor,
  OnboardingProgressResponse,
  TaxonomyGenerateResponse,
  Theme,
} from '../types';

const BASE_URL = '/api/v1/onboarding';

export async function getOnboardingOptions(): Promise<{
  industries: string[];
  team_sizes: string[];
  roles: string[];
}> {
  const response = await api.get(`${BASE_URL}/options`);
  return response.data;
}

// Company data endpoints (stored in companies table)
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
  }
): Promise<CompanyDataResponse> {
  const response = await api.post(`${BASE_URL}/company`, data, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

// Progress endpoints (stored in onboarding_progress table)
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
    taxonomy_url?: string;
    taxonomy_data?: { themes: Theme[] };
    selected_themes?: string[];
    connected_sources?: string[];
    selected_competitors?: Competitor[];
  }
): Promise<OnboardingProgressResponse> {
  const response = await api.post(`${BASE_URL}/progress`, data, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

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

export async function resetOnboardingProgress(
  workspaceId: string
): Promise<void> {
  await api.delete(`${BASE_URL}/progress`, {
    params: { workspace_id: workspaceId },
  });
}

export async function completeOnboarding(): Promise<User> {
  const response = await api.post('/api/v1/auth/complete-onboarding');
  return response.data;
}

export const onboardingApi = {
  getOnboardingOptions,
  getCompanyData,
  saveCompanyData,
  getOnboardingProgress,
  saveOnboardingProgress,
  generateTaxonomy,
  resetOnboardingProgress,
  completeOnboarding,
};
