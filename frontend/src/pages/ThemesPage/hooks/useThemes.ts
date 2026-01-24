import { useState, useEffect, useCallback } from 'react';
import { Theme, ThemeFormData } from '../types';
import { themeService, ThemeSuggestion } from '@/services/theme';
import { API_BASE_URL } from '@/config/api.config';
import { useAuthStore } from '@/features/auth/store/auth-store';

export const useThemes = () => {
  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());

  // Theme form state
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [formData, setFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
    parent_theme_id: null,
  });
  const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);

  const getAuthToken = useCallback(() => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  }, [tokens]);

  // Helper function to organize themes hierarchically
  const buildThemeHierarchy = useCallback((themes: Theme[]): Theme[] => {
    const themeMap = new Map(themes.map(theme => [theme.id, { ...theme, children: [] as Theme[] }]));
    const rootThemes: Theme[] = [];

    themes.forEach(theme => {
      const themeWithChildren = themeMap.get(theme.id)!;

      if (theme.parent_theme_id && themeMap.has(theme.parent_theme_id)) {
        const parent = themeMap.get(theme.parent_theme_id)!;
        (parent as any).children.push(themeWithChildren);
      } else {
        rootThemes.push(themeWithChildren);
      }
    });

    // Sort root themes alphabetically by name
    rootThemes.sort((a, b) => a.name.localeCompare(b.name));

    // Sort children alphabetically for each parent theme
    rootThemes.forEach(theme => {
      if ((theme as any).children && (theme as any).children.length > 0) {
        (theme as any).children.sort((a: Theme, b: Theme) => a.name.localeCompare(b.name));
      }
    });

    return rootThemes;
  }, []);

  const fetchThemes = useCallback(async () => {
    if (!WORKSPACE_ID) return;

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch themes: ${response.status}`);
      }

      const themesData = await response.json();
      setThemes(themesData);

      // Auto-select first theme
      if (themesData.length > 0) {
        setSelectedThemeId(themesData[0].id);
      }

    } catch (error) {
      console.error('Error fetching themes:', error);
      setError(error instanceof Error ? error.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const createTheme = useCallback(async (themeData: ThemeFormData) => {
    if (!WORKSPACE_ID) throw new Error('No workspace ID');

    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: themeData.name,
          description: themeData.description,
          parent_theme_id: themeData.parent_theme_id
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create theme: ${response.status}`);
    }

    await fetchThemes(); // Refresh themes list
  }, [WORKSPACE_ID, getAuthToken, fetchThemes]);

  const updateTheme = useCallback(async (themeId: string, themeData: ThemeFormData) => {
    if (!WORKSPACE_ID) throw new Error('No workspace ID');

    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes/${themeId}?workspace_id=${WORKSPACE_ID}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: themeData.name,
          description: themeData.description,
          parent_theme_id: themeData.parent_theme_id
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update theme: ${response.status}`);
    }

    await fetchThemes(); // Refresh themes list
  }, [WORKSPACE_ID, getAuthToken, fetchThemes]);

  const deleteTheme = useCallback(async (themeId: string) => {
    if (!WORKSPACE_ID) throw new Error('No workspace ID');
    if (!confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
      return;
    }

    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/themes/${themeId}?workspace_id=${WORKSPACE_ID}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete theme: ${response.status}`);
    }

    await fetchThemes(); // Refresh themes list
    if (selectedThemeId === themeId) {
      setSelectedThemeId(themes[0]?.id || '');
    }
  }, [WORKSPACE_ID, getAuthToken, fetchThemes, selectedThemeId, themes]);

  const loadThemeSuggestions = useCallback(async () => {
    if (!WORKSPACE_ID) return;

    setLoadingSuggestions(true);
    try {
      const existingThemes = themes.map(theme => ({
        name: theme.name,
        description: theme.description
      }));
      const themeSuggestions = await themeService.generateThemeSuggestions(WORKSPACE_ID, existingThemes);
      setSuggestions(themeSuggestions);
    } catch (err) {
      console.error('Failed to load theme suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [WORKSPACE_ID, themes]);

  const loadMoreSuggestions = useCallback(async () => {
    if (!WORKSPACE_ID || loadingMoreSuggestions) return;

    setLoadingMoreSuggestions(true);
    try {
      const existingThemes = themes.map(theme => ({
        name: theme.name,
        description: theme.description
      }));
      const moreSuggestions = await themeService.generateThemeSuggestions(WORKSPACE_ID, existingThemes, suggestions);
      setSuggestions([...suggestions, ...moreSuggestions]);
    } catch (err) {
      console.error('Failed to load more suggestions:', err);
    } finally {
      setLoadingMoreSuggestions(false);
    }
  }, [WORKSPACE_ID, themes, suggestions, loadingMoreSuggestions]);

  const toggleThemeExpansion = useCallback((themeId: string) => {
    setExpandedThemes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(themeId)) {
        newSet.delete(themeId);
      } else {
        newSet.add(themeId);
      }
      return newSet;
    });
  }, []);

  const prepareFormForEdit = useCallback((theme: Theme) => {
    setEditingTheme(theme);
    setFormData({
      name: theme.name,
      description: theme.description,
      parent_theme_id: theme.parent_theme_id || null,
    });
    setSuggestions([]);
  }, []);

  const prepareFormForCreate = useCallback((parentThemeId?: string) => {
    setEditingTheme(null);
    setFormData({
      name: '',
      description: '',
      parent_theme_id: parentThemeId || null,
    });
    setSuggestions([]);
    loadThemeSuggestions();
  }, [loadThemeSuggestions]);

  const resetForm = useCallback(() => {
    setEditingTheme(null);
    setFormData({
      name: '',
      description: '',
      parent_theme_id: null,
    });
    setSuggestions([]);
  }, []);

  // Fetch themes when workspace is available
  useEffect(() => {
    if (WORKSPACE_ID) {
      fetchThemes();
    }
  }, [WORKSPACE_ID, fetchThemes]);

  // Initialize expanded state - start with all themes collapsed
  useEffect(() => {
    setExpandedThemes(new Set()); // Empty set = all collapsed
  }, [themes]);

  const hierarchicalThemes = buildThemeHierarchy(themes);

  // Flatten hierarchical themes for dropdown
  const flattenedThemes = (() => {
    const result: Theme[] = [];
    const flatten = (themeList: Theme[]) => {
      themeList.forEach(theme => {
        result.push(theme);
        if ((theme as any).children && (theme as any).children.length > 0) {
          flatten((theme as any).children);
        }
      });
    };
    flatten(hierarchicalThemes);
    return result;
  })();

  return {
    // State
    themes,
    hierarchicalThemes,
    flattenedThemes,
    selectedThemeId,
    loading,
    error,
    expandedThemes,
    editingTheme,
    formData,
    suggestions,
    loadingSuggestions,
    loadingMoreSuggestions,

    // Actions
    setSelectedThemeId,
    setFormData,
    fetchThemes,
    createTheme,
    updateTheme,
    deleteTheme,
    loadThemeSuggestions,
    loadMoreSuggestions,
    toggleThemeExpansion,
    prepareFormForEdit,
    prepareFormForCreate,
    resetForm,
    setError,
  };
};









