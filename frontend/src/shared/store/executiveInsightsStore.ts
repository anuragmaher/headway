/**
 * Zustand store for Executive Insights Page state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { API_BASE_URL } from '@/config/api.config';
import { useAuthStore } from '@/features/auth/store/auth-store';

export interface Theme {
  id: string;
  name: string;
  description: string;
  feature_count: number;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  urgency: string;
  status: string;
  mention_count: number;
  theme_id: string | null;
  theme?: {
    id: string;
    name: string;
    description: string;
  } | null;
  first_mentioned: string;
  last_mentioned: string;
  created_at: string;
  updated_at: string | null;
}

export interface DashboardMetrics {
  total_features: number;
  total_themes: number;
  total_mentions: number;
  features_by_status: {
    new: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  features_by_urgency: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  top_themes: Array<{
    name: string;
    feature_count: number;
  }>;
  recent_activity: {
    features_this_week: number;
    features_last_week: number;
  };
  customers_by_industry: Array<{
    industry: string;
    count: number;
  }>;
  calls_per_day: Array<{
    date: string;
    count: number;
  }>;
  top_engaged_customers: Array<{
    customer_id: string;
    name: string;
    industry: string;
    message_count: number;
  }>;
  customer_health_summary: {
    healthy: number;
    at_risk: number;
    dormant: number;
  };
}

export interface CustomerHealthDetail {
  customer_id: string;
  name: string;
  industry: string;
  last_activity: string | null;
  message_count: number;
  health_status: 'healthy' | 'at_risk' | 'dormant';
}

interface ExecutiveInsightsState {
  // Data
  metrics: DashboardMetrics | null;
  topFeatures: Feature[];
  customerHealthDetails: CustomerHealthDetail[];

  // Loading states
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchingWorkspaceId: boolean;
  attemptedFetch: boolean;

  // Actions
  setHydrated: (hydrated: boolean) => void;
  fetchWorkspaceId: () => Promise<void>;
  fetchExecutiveInsights: (workspaceId: string) => Promise<void>;
  clearError: () => void;
}

export const useExecutiveInsightsStore = create<ExecutiveInsightsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      metrics: null,
      topFeatures: [],
      customerHealthDetails: [],
      loading: true,
      error: null,
      hydrated: false,
      fetchingWorkspaceId: false,
      attemptedFetch: false,

      // Actions
      setHydrated: (hydrated: boolean) => {
        set({ hydrated });
      },

      fetchWorkspaceId: async () => {
        const { hydrated, attemptedFetch, fetchingWorkspaceId } = get();
        const { tokens, isAuthenticated } = useAuthStore.getState();
        const WORKSPACE_ID = tokens?.workspace_id;

        if (!hydrated || !isAuthenticated || WORKSPACE_ID || fetchingWorkspaceId || attemptedFetch) {
          return;
        }

        set({ attemptedFetch: true, fetchingWorkspaceId: true });

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
            headers: {
              'Authorization': `Bearer ${tokens?.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (data.workspace_id) {
            useAuthStore.setState({
              tokens: {
                ...tokens,
                workspace_id: data.workspace_id,
              },
            });
          }
        } catch (err) {
          console.error('Failed to fetch workspace_id:', err);
        } finally {
          set({ fetchingWorkspaceId: false });
        }
      },

      fetchExecutiveInsights: async (workspaceId: string) => {
        const { tokens } = useAuthStore.getState();
        const token = tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';

        set({ loading: true, error: null });

        try {
          const response = await fetch(
            `${API_BASE_URL}/api/v1/features/executive-insights?workspace_id=${workspaceId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch executive insights');
          }

          const data = await response.json();

          set({
            metrics: data.metrics,
            topFeatures: data.top_features,
            customerHealthDetails: data.customer_health_details || [],
            loading: false,
            error: null,
          });
        } catch (err) {
          console.error('Error fetching data:', err);
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load data',
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'ExecutiveInsightsStore' }
  )
);
