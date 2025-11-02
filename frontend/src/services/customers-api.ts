/**
 * Customers API Service
 *
 * Handles all customer-related API calls
 */

import api from './api';

// Types
export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  domain?: string;
  industry?: string;
  website?: string;
  phone?: string;
  contact_name?: string;
  contact_email?: string;
  mrr?: number;
  arr?: number;
  deal_stage?: string;
  deal_amount?: number;
  deal_close_date?: string;
  deal_probability?: number;
  external_system?: string;
  external_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_activity_at?: string;
  message_count?: number;
}

export interface CustomerFeatureRequest {
  id: string;
  name: string;
  description?: string;
  urgency: string;
  status: string;
  mention_count: number;
  first_mentioned: string;
  last_mentioned: string;
  theme_name?: string;
}

export interface CustomerMessage {
  id: string;
  title?: string;
  content: string;
  source: string;
  channel_name?: string;
  author_name?: string;
  sent_at: string;
}

export interface CustomerConsolidatedView {
  customer: Customer;
  feature_requests: CustomerFeatureRequest[];
  recent_messages: CustomerMessage[];
  total_messages: number;
  pain_points: string[];
  summary?: string;
  highlights: string[];
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListCustomersParams {
  page?: number;
  page_size?: number;
  industry?: string;
  min_arr?: number;
  max_arr?: number;
  search?: string;
}

class CustomersAPI {
  /**
   * List customers for a workspace with optional filters
   */
  async listCustomers(
    workspaceId: string,
    params?: ListCustomersParams
  ): Promise<CustomerListResponse> {
    const queryParams = new URLSearchParams({
      workspace_id: workspaceId,
      ...(params?.page && { page: params.page.toString() }),
      ...(params?.page_size && { page_size: params.page_size.toString() }),
      ...(params?.industry && { industry: params.industry }),
      ...(params?.min_arr && { min_arr: params.min_arr.toString() }),
      ...(params?.max_arr && { max_arr: params.max_arr.toString() }),
      ...(params?.search && { search: params.search }),
    });

    const response = await api.get<CustomerListResponse>(
      `/api/v1/customers/?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get a single customer by ID
   */
  async getCustomer(workspaceId: string, customerId: string): Promise<Customer> {
    const response = await api.get<Customer>(
      `/api/v1/customers/${customerId}?workspace_id=${workspaceId}`
    );
    return response.data;
  }

  /**
   * Get consolidated customer view with all related data
   */
  async getCustomerConsolidatedView(
    workspaceId: string,
    customerId: string
  ): Promise<CustomerConsolidatedView> {
    const response = await api.get<CustomerConsolidatedView>(
      `/api/v1/customers/${customerId}/consolidated?workspace_id=${workspaceId}`
    );
    return response.data;
  }

  /**
   * Get customer statistics for a workspace
   */
  async getCustomerStats(workspaceId: string): Promise<{
    total_customers: number;
    total_arr: number;
    total_mrr: number;
    by_industry: Array<{ industry: string; count: number }>;
  }> {
    const response = await api.get(
      `/api/v1/customers/stats/summary?workspace_id=${workspaceId}`
    );
    return response.data;
  }
}

export const customersApi = new CustomersAPI();
