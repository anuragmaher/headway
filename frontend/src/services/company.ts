/**
 * Company management service
 */

import api from './api';

export interface CompanyDetails {
  id?: string;
  name: string;
  website: string;
  size: string;
  description: string;
}

export const companyService = {
  /**
   * Fetch company details for a workspace
   */
  getCompanyDetails: async (workspaceId: string): Promise<CompanyDetails> => {
    const response = await api.get(`/api/v1/workspaces/${workspaceId}/company-details`);
    return response.data;
  },

  /**
   * Update company details for a workspace
   */
  updateCompanyDetails: async (workspaceId: string, data: CompanyDetails): Promise<CompanyDetails> => {
    const response = await api.put(`/api/v1/workspaces/${workspaceId}/company-details`, {
      name: data.name,
      website: data.website,
      size: data.size,
      description: data.description,
    });
    return response.data;
  },

  /**
   * Generate company description from website URL
   */
  generateDescription: async (workspaceId: string, websiteUrl: string): Promise<string> => {
    const response = await api.post(`/api/v1/workspaces/${workspaceId}/generate-description`, {
      website_url: websiteUrl,
    });

    if (response.data.description) {
      return response.data.description;
    }

    throw new Error('No description generated');
  },
};
