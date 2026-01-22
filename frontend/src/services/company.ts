/**
 * Company management service
 *
 * Company data is stored in the companies table with fields:
 * - name (required)
 * - size (optional) - team size
 * - industry (optional)
 * - domain (optional) - extracted from user email
 */

import api from './api';

export interface CompanyDetails {
  id?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  role?: string;
}

export const companyService = {
  /**
   * Fetch company details for a workspace
   * Uses the onboarding company endpoint which reads from companies table
   */
  getCompanyDetails: async (workspaceId: string): Promise<CompanyDetails> => {
    const response = await api.get('/api/v1/onboarding/company', {
      params: { workspace_id: workspaceId },
    });
    // Transform snake_case from API to camelCase for frontend
    const data = response.data;
    return {
      id: data.id,
      name: data.name || '',
      website: data.website || '',
      industry: data.industry || '',
      teamSize: data.team_size || '',
      role: data.role || '',
    };
  },

  /**
   * Update company details for a workspace
   * Uses the onboarding company endpoint which writes to companies table
   */
  updateCompanyDetails: async (workspaceId: string, data: CompanyDetails): Promise<CompanyDetails> => {
    const response = await api.post('/api/v1/onboarding/company', {
      name: data.name,
      website: data.website || '',
      industry: data.industry || '',
      team_size: data.teamSize || '',
      role: data.role || '',
    }, {
      params: { workspace_id: workspaceId },
    });
    return response.data;
  },
};
