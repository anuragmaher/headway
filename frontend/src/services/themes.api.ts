/**
 * Themes API Service
 * Handles theme hierarchy: Theme -> SubTheme -> CustomerAsk
 */
import api from './api';
import type {
  Theme,
  ThemeCreate,
  ThemeUpdate,
  ThemeWithSubThemes,
  ThemeHierarchy,
  ThemeListResponse,
  SubTheme,
  SubThemeCreate,
  SubThemeUpdate,
  SubThemeListResponse,
  SubThemeWithCustomerAsks,
  CustomerAsk,
  CustomerAskCreate,
  CustomerAskUpdate,
  CustomerAskListResponse,
  MentionListResponse,
  TranscriptClassification,
  TranscriptClassificationListResponse,
} from '@/shared/types/api.types';

const BASE_URL = '/api/v1/themes';

export const themesApi = {
  // === Themes ===

  async listThemes(): Promise<ThemeListResponse> {
    const response = await api.get<ThemeListResponse>(BASE_URL);
    return response.data;
  },

  async getThemeHierarchy(): Promise<ThemeHierarchy[]> {
    const response = await api.get<ThemeHierarchy[]>(`${BASE_URL}/hierarchy`);
    return response.data;
  },

  async createTheme(data: ThemeCreate): Promise<Theme> {
    const response = await api.post<Theme>(BASE_URL, data);
    return response.data;
  },

  async getTheme(themeId: string): Promise<ThemeWithSubThemes> {
    const response = await api.get<ThemeWithSubThemes>(`${BASE_URL}/${themeId}`);
    return response.data;
  },

  async updateTheme(themeId: string, data: ThemeUpdate): Promise<Theme> {
    const response = await api.patch<Theme>(`${BASE_URL}/${themeId}`, data);
    return response.data;
  },

  async deleteTheme(themeId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${themeId}`);
  },

  async reorderThemes(themeIds: string[]): Promise<Theme[]> {
    const response = await api.put<Theme[]>(`${BASE_URL}/reorder`, themeIds);
    return response.data;
  },

  // === SubThemes ===

  async listSubThemes(themeId: string): Promise<SubThemeListResponse> {
    const response = await api.get<SubThemeListResponse>(
      `${BASE_URL}/${themeId}/sub-themes`
    );
    return response.data;
  },

  async createSubTheme(data: SubThemeCreate): Promise<SubTheme> {
    const response = await api.post<SubTheme>(`${BASE_URL}/sub-themes`, data);
    return response.data;
  },

  async getSubTheme(subThemeId: string): Promise<SubThemeWithCustomerAsks> {
    const response = await api.get<SubThemeWithCustomerAsks>(
      `${BASE_URL}/sub-themes/${subThemeId}`
    );
    return response.data;
  },

  async updateSubTheme(subThemeId: string, data: SubThemeUpdate): Promise<SubTheme> {
    const response = await api.patch<SubTheme>(
      `${BASE_URL}/sub-themes/${subThemeId}`,
      data
    );
    return response.data;
  },

  async deleteSubTheme(subThemeId: string): Promise<void> {
    await api.delete(`${BASE_URL}/sub-themes/${subThemeId}`);
  },

  async moveSubTheme(subThemeId: string, newThemeId: string): Promise<SubTheme> {
    const response = await api.post<SubTheme>(
      `${BASE_URL}/sub-themes/${subThemeId}/move`,
      null,
      { params: { new_theme_id: newThemeId } }
    );
    return response.data;
  },

  // === CustomerAsks ===

  async listCustomerAsks(
    subThemeId?: string,
    status?: string
  ): Promise<CustomerAskListResponse> {
    const params = new URLSearchParams();
    if (subThemeId) params.append('sub_theme_id', subThemeId);
    if (status) params.append('status', status);

    const response = await api.get<CustomerAskListResponse>(
      `${BASE_URL}/customer-asks?${params.toString()}`
    );
    return response.data;
  },

  async createCustomerAsk(data: CustomerAskCreate): Promise<CustomerAsk> {
    const response = await api.post<CustomerAsk>(
      `${BASE_URL}/customer-asks`,
      data
    );
    return response.data;
  },

  async getCustomerAsk(customerAskId: string): Promise<CustomerAsk> {
    const response = await api.get<CustomerAsk>(
      `${BASE_URL}/customer-asks/${customerAskId}`
    );
    return response.data;
  },

  async updateCustomerAsk(
    customerAskId: string,
    data: CustomerAskUpdate
  ): Promise<CustomerAsk> {
    const response = await api.patch<CustomerAsk>(
      `${BASE_URL}/customer-asks/${customerAskId}`,
      data
    );
    return response.data;
  },

  async deleteCustomerAsk(customerAskId: string): Promise<void> {
    await api.delete(`${BASE_URL}/customer-asks/${customerAskId}`);
  },

  async moveCustomerAsk(
    customerAskId: string,
    newSubThemeId: string
  ): Promise<CustomerAsk> {
    const response = await api.post<CustomerAsk>(
      `${BASE_URL}/customer-asks/${customerAskId}/move`,
      null,
      { params: { new_sub_theme_id: newSubThemeId } }
    );
    return response.data;
  },

  async searchCustomerAsks(
    query: string,
    limit = 20
  ): Promise<CustomerAsk[]> {
    const response = await api.get<CustomerAsk[]>(
      `${BASE_URL}/customer-asks/search`,
      { params: { q: query, limit } }
    );
    return response.data;
  },

  // === Mentions ===

  async getMentionsForCustomerAsk(
    customerAskId: string,
    limit = 50,
    offset = 0,
    includeLinkedAsks = false  // Skip linked asks by default for faster load
  ): Promise<MentionListResponse> {
    const response = await api.get<MentionListResponse>(
      `${BASE_URL}/customer-asks/${customerAskId}/mentions`,
      { params: { limit, offset, include_linked_asks: includeLinkedAsks } }
    );
    return response.data;
  },

  // === Transcript Classifications ===

  async getTranscriptClassificationCounts(): Promise<{
    theme_counts: Record<string, number>;
    sub_theme_counts: Record<string, number>;
  }> {
    const response = await api.get<{
      theme_counts: Record<string, number>;
      sub_theme_counts: Record<string, number>;
    }>(`${BASE_URL}/transcript-classifications/counts`);
    return response.data;
  },

  async listTranscriptClassifications(
    themeId?: string,
    subThemeId?: string,
    sourceType?: string,
    processingStatus?: string
  ): Promise<TranscriptClassificationListResponse> {
    const params = new URLSearchParams();
    if (themeId) params.append('theme_id', themeId);
    if (subThemeId) params.append('sub_theme_id', subThemeId);
    if (sourceType) params.append('source_type', sourceType);
    if (processingStatus) params.append('processing_status', processingStatus);

    const response = await api.get<TranscriptClassificationListResponse>(
      `${BASE_URL}/transcript-classifications?${params.toString()}`
    );
    return response.data;
  },

  async getTranscriptClassification(
    classificationId: string
  ): Promise<TranscriptClassification> {
    const response = await api.get<TranscriptClassification>(
      `${BASE_URL}/transcript-classifications/${classificationId}`
    );
    return response.data;
  },

  async searchTranscriptClassifications(
    query: string,
    limit: number = 20
  ): Promise<TranscriptClassification[]> {
    const response = await api.get<TranscriptClassification[]>(
      `${BASE_URL}/transcript-classifications/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.data;
  },
};

export default themesApi;
