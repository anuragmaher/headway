/**
 * Utility functions, helpers, and selectors for ThemesPage store
 */

import { useAuthStore } from '@/features/auth/store/auth-store';
import { Theme, ThemeWithChildren, Feature, FeatureFilters } from '../../types/ThemesTypes';

// ============================================================================
// Auth Helpers
// ============================================================================

export const getAuthToken = (): string => {
  const { tokens } = useAuthStore.getState();
  return tokens?.access_token || '';
};

export const getWorkspaceId = (): string => {
  const { tokens } = useAuthStore.getState();
  return tokens?.workspace_id || '';
};

// ============================================================================
// Theme Hierarchy Helpers
// ============================================================================

/**
 * Build a hierarchical tree structure from flat themes array
 */
export const buildThemeHierarchy = (themes: Theme[]): ThemeWithChildren[] => {
  const themeMap = new Map(themes.map(theme => [theme.id, { ...theme, children: [] as ThemeWithChildren[] }]));
  const rootThemes: ThemeWithChildren[] = [];

  themes.forEach(theme => {
    const themeWithChildren = themeMap.get(theme.id)!;
    if (theme.parent_theme_id && themeMap.has(theme.parent_theme_id)) {
      const parent = themeMap.get(theme.parent_theme_id)!;
      parent.children.push(themeWithChildren);
    } else {
      rootThemes.push(themeWithChildren);
    }
  });

  // Sort root themes alphabetically
  rootThemes.sort((a, b) => a.name.localeCompare(b.name));

  // Sort children alphabetically
  rootThemes.forEach(theme => {
    if (theme.children.length > 0) {
      theme.children.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  return rootThemes;
};

/**
 * Flatten hierarchical themes back to a flat array (preserving hierarchy order)
 */
export const flattenThemes = (hierarchicalThemes: ThemeWithChildren[]): Theme[] => {
  const result: Theme[] = [];
  const flatten = (themeList: ThemeWithChildren[]) => {
    themeList.forEach(theme => {
      result.push(theme);
      if (theme.children.length > 0) {
        flatten(theme.children);
      }
    });
  };
  flatten(hierarchicalThemes);
  return result;
};

// ============================================================================
// Feature Filtering and Sorting
// ============================================================================

/**
 * Extract a value from feature data points
 */
export const extractDataPointValue = (feature: Feature, key: string): any => {
  if (!feature.data_points || feature.data_points.length === 0) return null;
  for (const dp of feature.data_points) {
    if (dp.business_metrics && key in dp.business_metrics) {
      return dp.business_metrics[key];
    }
    if (dp.entities && key in dp.entities) {
      return dp.entities[key];
    }
    if (dp.structured_metrics && key in dp.structured_metrics) {
      return dp.structured_metrics[key];
    }
  }
  return null;
};

/**
 * Filter and sort features based on filter criteria
 */
export const filterAndSortFeatures = (features: Feature[], filters: FeatureFilters): Feature[] => {
  let filtered = [...features];

  // Filter by search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(f => {
      if (f.name.toLowerCase().includes(query)) return true;
      if (f.description?.toLowerCase().includes(query)) return true;
      if (f.data_points && f.data_points.length > 0) {
        for (const dp of f.data_points) {
          if (dp.customer_name?.toLowerCase().includes(query)) return true;
          if (dp.customer_email?.toLowerCase().includes(query)) return true;
          if (dp.sender_name?.toLowerCase().includes(query)) return true;
          if (dp.business_metrics) {
            const metricsStr = JSON.stringify(dp.business_metrics).toLowerCase();
            if (metricsStr.includes(query)) return true;
          }
          if (dp.entities) {
            const entitiesStr = JSON.stringify(dp.entities).toLowerCase();
            if (entitiesStr.includes(query)) return true;
          }
          if (dp.ai_insights) {
            if (dp.ai_insights.feature_requests?.length) {
              const featuresStr = JSON.stringify(dp.ai_insights.feature_requests).toLowerCase();
              if (featuresStr.includes(query)) return true;
            }
            if (dp.ai_insights.bug_reports?.length) {
              const bugsStr = JSON.stringify(dp.ai_insights.bug_reports).toLowerCase();
              if (bugsStr.includes(query)) return true;
            }
            if (dp.ai_insights.summary?.toLowerCase().includes(query)) return true;
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
      if (!f.data_points) return false;
      for (const dp of f.data_points) {
        if (dp.business_metrics && dp.business_metrics.mrr !== undefined) {
          const mrr = parseFloat(dp.business_metrics.mrr);
          const min = filters.filterMrrMin ? parseFloat(filters.filterMrrMin) : -Infinity;
          const max = filters.filterMrrMax ? parseFloat(filters.filterMrrMax) : Infinity;
          if (mrr >= min && mrr <= max) return true;
        }
      }
      return false;
    });
  }

  // Sort features
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'mention_count':
        comparison = a.mention_count - b.mention_count;
        break;
      case 'last_mentioned':
        comparison = new Date(a.last_mentioned).getTime() - new Date(b.last_mentioned).getTime();
        break;
      case 'status': {
        const statusOrder = { 'new': 1, 'in_progress': 2, 'completed': 3 };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 999;
        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 999;
        comparison = aStatus - bStatus;
        break;
      }
      case 'urgency': {
        const urgencyOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        const aUrgency = urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 999;
        const bUrgency = urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 999;
        comparison = aUrgency - bUrgency;
        break;
      }
      case 'mrr': {
        const aMrr = extractDataPointValue(a, 'mrr');
        const bMrr = extractDataPointValue(b, 'mrr');
        const aMrrNum = aMrr ? parseFloat(aMrr) : 0;
        const bMrrNum = bMrr ? parseFloat(bMrr) : 0;
        comparison = aMrrNum - bMrrNum;
        break;
      }
      case 'company_name': {
        const aCompany = extractDataPointValue(a, 'company_name') || '';
        const bCompany = extractDataPointValue(b, 'company_name') || '';
        comparison = String(aCompany).localeCompare(String(bCompany));
        break;
      }
      default:
        comparison = 0;
    }
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
};
