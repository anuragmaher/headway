import { useState, useCallback, useMemo } from 'react';
import { Feature, FilterState } from '../types';
import { FeatureSuggestion } from '@/services/theme';
import { API_BASE_URL } from '@/config/api.config';
import { useAuthStore } from '@/features/auth/store/auth-store';

export const useFeatures = () => {
  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  const [themeFeatures, setThemeFeatures] = useState<Feature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [showingAllFeatures, setShowingAllFeatures] = useState(false);

  // Filter and sort state
  const [filters, setFilters] = useState<FilterState>({
    sortBy: 'mention_count',
    sortOrder: 'desc',
    filterStatus: 'all',
    filterUrgency: 'all',
    filterMrrMin: '',
    filterMrrMax: '',
    searchQuery: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Feature editing state
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Feature adding state
  const [addFormData, setAddFormData] = useState({ name: '', description: '' });
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [featureSuggestions, setFeatureSuggestions] = useState<FeatureSuggestion[]>([]);

  // Feature deletion state
  const [featureToDelete, setFeatureToDelete] = useState<Feature | null>(null);
  const [deletingFeature, setDeletingFeature] = useState(false);

  const getAuthToken = useCallback(() => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  }, [tokens]);

  // Helper function to extract data point values
  const extractDataPointValue = useCallback((feature: Feature, key: string): any => {
    if (!feature.data_points || feature.data_points.length === 0) return null;

    for (const dp of feature.data_points) {
      // Check business metrics
      if (dp.business_metrics && key in dp.business_metrics) {
        return dp.business_metrics[key];
      }
      // Check entities
      if (dp.entities && key in dp.entities) {
        return dp.entities[key];
      }
      // Check structured metrics
      if (dp.structured_metrics && key in dp.structured_metrics) {
        return dp.structured_metrics[key];
      }
    }
    return null;
  }, []);

  // Filter and sort features
  const filterAndSortFeatures = useCallback((features: Feature[]) => {
    let filtered = [...features];

    // Filter by search query (full text search)
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(f => {
        // Search in feature name
        if (f.name.toLowerCase().includes(query)) return true;

        // Search in feature description
        if (f.description?.toLowerCase().includes(query)) return true;

        // Search in data points
        if (f.data_points && f.data_points.length > 0) {
          for (const dp of f.data_points) {
            // Search in customer name
            if (dp.customer_name?.toLowerCase().includes(query)) return true;

            // Search in customer email
            if (dp.customer_email?.toLowerCase().includes(query)) return true;

            // Search in sender name
            if (dp.sender_name?.toLowerCase().includes(query)) return true;

            // Search in business metrics
            if (dp.business_metrics) {
              const metricsStr = JSON.stringify(dp.business_metrics).toLowerCase();
              if (metricsStr.includes(query)) return true;
            }

            // Search in entities
            if (dp.entities) {
              const entitiesStr = JSON.stringify(dp.entities).toLowerCase();
              if (entitiesStr.includes(query)) return true;
            }

            // Search in structured metrics
            if (dp.structured_metrics) {
              const structuredStr = JSON.stringify(dp.structured_metrics).toLowerCase();
              if (structuredStr.includes(query)) return true;
            }

            // Search in AI insights
            if (dp.ai_insights) {
              // Feature requests
              if (dp.ai_insights.feature_requests) {
                const featuresStr = JSON.stringify(dp.ai_insights.feature_requests).toLowerCase();
                if (featuresStr.includes(query)) return true;
              }

              // Bug reports
              if (dp.ai_insights.bug_reports) {
                const bugsStr = JSON.stringify(dp.ai_insights.bug_reports).toLowerCase();
                if (bugsStr.includes(query)) return true;
              }

              // Pain points
              if (dp.ai_insights.pain_points) {
                const painStr = JSON.stringify(dp.ai_insights.pain_points).toLowerCase();
                if (painStr.includes(query)) return true;
              }

              // Key topics
              if (dp.ai_insights.key_topics) {
                const topicsStr = JSON.stringify(dp.ai_insights.key_topics).toLowerCase();
                if (topicsStr.includes(query)) return true;
              }
            }
          }
        }

        return false;
      });
    }

    // Filter by status
    if (filters.filterStatus !== 'all') {
      filtered = filtered.filter(f => f.status === filters.filterStatus);
    }

    // Filter by urgency
    if (filters.filterUrgency !== 'all') {
      filtered = filtered.filter(f => f.urgency === filters.filterUrgency);
    }

    // Filter by MRR range
    if (filters.filterMrrMin || filters.filterMrrMax) {
      filtered = filtered.filter(f => {
        if (!f.data_points || f.data_points.length === 0) return false;

        const minMrr = filters.filterMrrMin ? parseFloat(filters.filterMrrMin) : 0;
        const maxMrr = filters.filterMrrMax ? parseFloat(filters.filterMrrMax) : Infinity;

        return f.data_points.some(dp => {
          if (dp.business_metrics && dp.business_metrics.mrr) {
            const mrr = parseFloat(dp.business_metrics.mrr);
            return mrr >= minMrr && mrr <= maxMrr;
          }
          return false;
        });
      });
    }

    // Sort features
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'mention_count':
          aValue = a.mention_count || 0;
          bValue = b.mention_count || 0;
          break;
        case 'last_mentioned':
          aValue = new Date(a.last_mentioned || 0);
          bValue = new Date(b.last_mentioned || 0);
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [filters]);

  const fetchThemeFeatures = useCallback(async (themeId: string) => {
    if (!WORKSPACE_ID) return;

    try {
      setLoadingFeatures(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}&theme_id=${themeId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const features = await response.json();
      setThemeFeatures(features);
      setShowingAllFeatures(false);
    } catch (error) {
      console.error('Error fetching theme features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const fetchAllFeatures = useCallback(async () => {
    if (!WORKSPACE_ID) return;

    try {
      setLoadingFeatures(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch features: ${response.status}`);
      }

      const features = await response.json();
      setThemeFeatures(features);
      setShowingAllFeatures(true);
    } catch (error) {
      console.error('Error fetching all features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const updateFeature = useCallback(async (featureId: string, updateData: { name: string; description: string }) => {
    if (!WORKSPACE_ID) throw new Error('No workspace ID');

    setSavingEdit(true);
    setEditError(null);

    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update feature: ${response.status}`);
      }

      // Update local state
      setThemeFeatures(prev => prev.map(f => 
        f.id === featureId 
          ? { ...f, name: updateData.name, description: updateData.description }
          : f
      ));

      setEditingFeature(null);
      setEditFormData({ name: '', description: '' });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update feature');
      throw error;
    } finally {
      setSavingEdit(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const deleteFeature = useCallback(async (featureId: string) => {
    if (!WORKSPACE_ID) throw new Error('No workspace ID');

    setDeletingFeature(true);
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete feature: ${response.status}`);
      }

      // Update local state
      setThemeFeatures(prev => prev.filter(f => f.id !== featureId));
      setFeatureToDelete(null);
    } catch (error) {
      console.error('Error deleting feature:', error);
      throw error;
    } finally {
      setDeletingFeature(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      sortBy: 'mention_count',
      sortOrder: 'desc',
      filterStatus: 'all',
      filterUrgency: 'all',
      filterMrrMin: '',
      filterMrrMax: '',
      searchQuery: '',
    });
  }, []);

  const prepareFeatureForEdit = useCallback((feature: Feature) => {
    setEditingFeature(feature);
    setEditFormData({
      name: feature.name,
      description: feature.description,
    });
    setEditError(null);
  }, []);

  const prepareFeatureForDelete = useCallback((feature: Feature) => {
    setFeatureToDelete(feature);
  }, []);

  const filteredAndSortedFeatures = useMemo(() => 
    filterAndSortFeatures(themeFeatures), 
    [themeFeatures, filterAndSortFeatures]
  );

  return {
    // State
    themeFeatures,
    filteredAndSortedFeatures,
    loadingFeatures,
    showingAllFeatures,
    filters,
    showFilters,
    editingFeature,
    editFormData,
    savingEdit,
    editError,
    addFormData,
    savingAdd,
    addError,
    featureSuggestions,
    featureToDelete,
    deletingFeature,

    // Actions
    setThemeFeatures,
    setShowFilters,
    setEditFormData,
    setAddFormData,
    setFeatureSuggestions,
    fetchThemeFeatures,
    fetchAllFeatures,
    updateFeature,
    deleteFeature,
    updateFilters,
    clearFilters,
    prepareFeatureForEdit,
    prepareFeatureForDelete,
    extractDataPointValue,
  };
};









