/**
 * Themes page for managing and organizing feature request themes
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  alpha,
  useTheme,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Drawer,
  MenuItem,
  Menu,
  Skeleton,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  useMediaQuery,
  Fab,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FeaturedPlayList as FeatureIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Message as MessageIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon,
  Lightbulb as LightbulbIcon,
  BugReport as BugReportIcon,
  SentimentDissatisfied as SadIcon,
  Summarize as SummarizeIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { ResizablePanel } from '@/shared/components/ResizablePanel';
import { OnboardingBlocker } from '@/shared/components/OnboardingBlocker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ThemeData, ThemeFormData } from '@/shared/types/theme.types';
import { API_BASE_URL } from '@/config/api.config';
import { themeService, ThemeSuggestion, FeatureSuggestion } from '@/services/theme';

type Theme = ThemeData;

interface Feature {
  id: string;
  name: string;
  description: string;
  urgency: string;
  status: string;
  mention_count: number;
  theme_id: string | null;
  first_mentioned: string;
  last_mentioned: string;
  created_at: string;
  updated_at: string | null;
  match_confidence?: number | null;
  data_points?: any[];
  ai_metadata?: {
    extraction_source?: string;
    transcript_theme_relevance?: {
      is_relevant: boolean;
      confidence: number;
      matched_themes: string[];
      reasoning: string;
    };
    theme_validation?: {
      suggested_theme: string;
      assigned_theme: string;
      confidence: number;
      is_valid: boolean;
      reasoning: string;
    };
    feature_matching?: {
      is_unique: boolean;
      confidence: number;
      reasoning: string;
    };
    matches?: Array<{
      matched_title: string;
      matched_description: string;
      confidence: number;
      reasoning: string;
      matched_at: string;
    }>;
  };
}

interface AIInsights {
  feature_requests?: Array<{
    title: string;
    description: string;
    urgency: string;
    quote: string;
  }>;
  bug_reports?: Array<{
    title: string;
    description: string;
    severity: string;
    quote: string;
  }>;
  pain_points?: Array<{
    description: string;
    impact: string;
    quote?: string;
  }>;
  sentiment?: {
    overall: string;
    score: number;
    reasoning: string;
  };
  key_topics?: string[];
  summary?: string;
}

interface Message {
  id: string;
  title?: string; // Extracted title: call title, email subject, thread subject, etc.
  content: string;
  sent_at: string;
  sender_name: string;
  channel_name: string;
  customer_name: string | null;
  customer_email: string | null;
  ai_insights: AIInsights | null;
  source?: string; // 'gong', 'fathom', 'slack', etc.
  external_id?: string; // ID for external systems (call_id for Gong, session_id for Fathom)
  message_metadata?: Record<string, any>; // Recording URL, session details, etc.
  metadata?: {
    [key: string]: any;
    call_id?: string;
    recording_url?: string;
    session_id?: string;
    share_url?: string;
  };
}

export function ThemesPage(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { tokens, isAuthenticated } = useAuthStore();
  
  // Use workspace_id from tokens (from Google OAuth/login)
  const WORKSPACE_ID = tokens?.workspace_id;

  const [themes, setThemes] = useState<Theme[]>([]);
  const [mobileThemesDrawerOpen, setMobileThemesDrawerOpen] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [formData, setFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
    parent_theme_id: null,
  });
  const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingMoreSuggestions, setLoadingMoreSuggestions] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedThemeForDrawer, setSelectedThemeForDrawer] = useState<Theme | null>(null);
  const [showingAllFeatures, setShowingAllFeatures] = useState(false);
  const [showingAllFeaturesList, setShowingAllFeaturesList] = useState(false);
  const [showingSubThemes, setShowingSubThemes] = useState(false);
  const [themeFeatures, setThemeFeatures] = useState<Feature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [showMessagesFullPage, setShowMessagesFullPage] = useState(false);
  const [selectedFeatureForMessages, setSelectedFeatureForMessages] = useState<Feature | null>(null);
  const [featureMessages, setFeatureMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedThemeForMenu, setSelectedThemeForMenu] = useState<Theme | null>(null);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<string>('mention_count'); // last_mentioned, name, mention_count
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterMrrMin, setFilterMrrMin] = useState<string>('');
  const [filterMrrMax, setFilterMrrMax] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Message details tab state
  const [mentionDetailsTab, setMentionDetailsTab] = useState<'summary' | 'features' | 'bugs' | 'pain-points' | 'highlights'>('highlights');

  // Feature edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Feature add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ name: '', description: '' });
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [featureSuggestions, setFeatureSuggestions] = useState<FeatureSuggestion[]>([]);
  const [loadingFeatureSuggestions, setLoadingFeatureSuggestions] = useState(false);
  const [loadingMoreFeatureSuggestions, setLoadingMoreFeatureSuggestions] = useState(false);

  // Feature delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState<Feature | null>(null);
  const [deletingFeature, setDeletingFeature] = useState(false);

  // Mention delete state
  const [deleteMentionConfirmOpen, setDeleteMentionConfirmOpen] = useState(false);
  const [mentionToDelete, setMentionToDelete] = useState<Message | null>(null);
  const [deletingMention, setDeletingMention] = useState(false);

  // Resizable mentions layout state
  const [featuresWidth, setFeaturesWidth] = useState(35); // 35%
  const [mentionsListWidth, setMentionsListWidth] = useState(18); // 18%
  const [isResizingMentions, setIsResizingMentions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawer navigation state for mentions/details
  const [mentionsDrawerOpen, setMentionsDrawerOpen] = useState(false);
  const [drawerLevel, setDrawerLevel] = useState<'mentions' | 'details'>('mentions');

  // Onboarding blocker state
  const [showOnboardingBlocker, setShowOnboardingBlocker] = useState(false);
  const [companyDetailsFilledIn, setCompanyDetailsFilledIn] = useState(true); // Assume true by default

  // Workspace ID recovery state
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  // Helper function to organize themes hierarchically
  const buildThemeHierarchy = (themes: Theme[]): Theme[] => {
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
  };

  const hierarchicalThemes = buildThemeHierarchy(themes);

  // Flatten hierarchical themes for dropdown (includes all parent and child themes)
  const flattenedThemes = React.useMemo(() => {
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
  }, [hierarchicalThemes]);

  // Initialize expanded state - start with all themes collapsed
  React.useEffect(() => {
    setExpandedThemes(new Set()); // Empty set = all collapsed
  }, [themes]);

  // Hydration: Check if store is ready
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    if (!hydrated || !isAuthenticated || WORKSPACE_ID || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.workspace_id && tokens) {
          useAuthStore.setState({
            tokens: {
              ...tokens,
              workspace_id: data.workspace_id
            }
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch workspace_id:', err);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, WORKSPACE_ID, fetchingWorkspaceId, attemptedFetch, tokens]);

  // Handle resizing of mentions layout panels
  React.useEffect(() => {
    if (!isResizingMentions) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const containerWidth = rect.width;
      const totalPercent = 100;

      // Calculate the position after first panel (features)
      // Features starts at 0, mentions list is after features
      const featuresPixels = (featuresWidth / 100) * containerWidth;

      // If we're dragging the first divider (between features and mentions)
      if (e.clientX > rect.left && e.clientX < rect.left + containerWidth) {
        const newFeaturesWidth = (relativeX / containerWidth) * totalPercent;
        const remainingWidth = totalPercent - newFeaturesWidth;

        // Set features width and adjust mentions/details proportionally
        if (newFeaturesWidth >= 20 && newFeaturesWidth <= 60) {
          setFeaturesWidth(newFeaturesWidth);
          // Keep mentions list at roughly 20% of remaining space or adjust proportionally
          const newMentionsWidth = (mentionsListWidth / (totalPercent - featuresWidth)) * remainingWidth;
          if (newMentionsWidth >= 10 && newMentionsWidth <= remainingWidth - 10) {
            setMentionsListWidth(newMentionsWidth);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingMentions(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingMentions, featuresWidth, mentionsListWidth]);

  const toggleThemeExpansion = (themeId: string) => {
    setExpandedThemes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(themeId)) {
        newSet.delete(themeId);
      } else {
        newSet.add(themeId);
      }
      return newSet;
    });
  };

  // Helper function to extract data point values
  const extractDataPointValue = (feature: Feature, key: string): any => {
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
  };

  // Filter and sort features
  const filterAndSortFeatures = (features: Feature[]) => {
    let filtered = [...features];

    // Filter by search query (full text search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
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
              // Search in feature requests
              if (dp.ai_insights.feature_requests?.length > 0) {
                const featuresStr = JSON.stringify(dp.ai_insights.feature_requests).toLowerCase();
                if (featuresStr.includes(query)) return true;
              }
              // Search in bug reports
              if (dp.ai_insights.bug_reports?.length > 0) {
                const bugsStr = JSON.stringify(dp.ai_insights.bug_reports).toLowerCase();
                if (bugsStr.includes(query)) return true;
              }
              // Search in pain points
              if (dp.ai_insights.pain_points?.length > 0) {
                const painStr = JSON.stringify(dp.ai_insights.pain_points).toLowerCase();
                if (painStr.includes(query)) return true;
              }
              // Search in summary
              if (dp.ai_insights.summary?.toLowerCase().includes(query)) return true;
              // Search in key topics
              if (dp.ai_insights.key_topics?.length > 0) {
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
    if (filterStatus !== 'all') {
      filtered = filtered.filter(f => f.status === filterStatus);
    }

    // Filter by urgency
    if (filterUrgency !== 'all') {
      filtered = filtered.filter(f => f.urgency === filterUrgency);
    }

    // Filter by MRR range
    if (filterMrrMin || filterMrrMax) {
      filtered = filtered.filter(f => {
        if (!f.data_points) return false;

        // Find MRR value in data points
        for (const dp of f.data_points) {
          if (dp.business_metrics && dp.business_metrics.mrr !== undefined) {
            const mrr = parseFloat(dp.business_metrics.mrr);
            const min = filterMrrMin ? parseFloat(filterMrrMin) : -Infinity;
            const max = filterMrrMax ? parseFloat(filterMrrMax) : Infinity;
            if (mrr >= min && mrr <= max) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Sort features
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
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

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredAndSortedFeatures = React.useMemo(
    () => filterAndSortFeatures(themeFeatures),
    [themeFeatures, sortBy, sortOrder, filterStatus, filterUrgency, filterMrrMin, filterMrrMax, searchQuery]
  );

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterUrgency('all');
    setFilterMrrMin('');
    setFilterMrrMax('');
    setSortBy('last_mentioned');
    setSortOrder('desc');
    setSearchQuery('');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, theme: Theme) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedThemeForMenu(theme);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedThemeForMenu(null);
  };

  const handleMenuAction = (action: 'edit' | 'delete' | 'add-sub') => {
    if (!selectedThemeForMenu) return;

    switch (action) {
      case 'edit':
        handleOpenDialog(selectedThemeForMenu);
        break;
      case 'delete':
        handleDeleteTheme(selectedThemeForMenu.id);
        break;
      case 'add-sub':
        handleOpenDialog(undefined, selectedThemeForMenu.id);
        break;
    }
    handleMenuClose();
  };

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchThemes = async () => {
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
  };

  // Fetch themes when workspace is available
  useEffect(() => {
    if (!WORKSPACE_ID) {
      return;
    }

    fetchThemes();
    // Load all features by default
    handleAllThemesClick();

    // Check if we should show the onboarding blocker
    // This will be triggered if no themes exist and company details are missing
    // The blocker will check: if themes.length === 0 && no company details
    // For now, we show it if themes are empty (company details check would come from workspace context)
    setShowOnboardingBlocker(themes.length === 0);
  }, [WORKSPACE_ID]);

  // Update blocker status when themes change
  React.useEffect(() => {
    setShowOnboardingBlocker(themes.length === 0);
  }, [themes]);


  const handleOpenDialog = (themeToEdit?: Theme, parentThemeId?: string) => {
    if (themeToEdit) {
      setEditingTheme(themeToEdit);
      setFormData({
        name: themeToEdit.name,
        description: themeToEdit.description,
        parent_theme_id: themeToEdit.parent_theme_id || null,
      });
      setSuggestions([]);
    } else {
      setEditingTheme(null);
      setFormData({
        name: '',
        description: '',
        parent_theme_id: parentThemeId || null,
      });
      setSuggestions([]);

      // Load suggestions asynchronously (non-blocking)
      if (WORKSPACE_ID) {
        setLoadingSuggestions(true);
        // Convert existing themes to format for API (name + description)
        const existingThemes = themes.map(theme => ({
          name: theme.name,
          description: theme.description
        }));
        themeService.generateThemeSuggestions(WORKSPACE_ID, existingThemes)
          .then((themeSuggestions) => {
            setSuggestions(themeSuggestions);
          })
          .catch((err) => {
            console.error('Failed to load theme suggestions:', err);
            setSuggestions([]);
          })
          .finally(() => {
            setLoadingSuggestions(false);
          });
      }
    }
    setDialogOpen(true);
  };

  const handleLoadMoreSuggestions = async () => {
    if (!WORKSPACE_ID || loadingMoreSuggestions) return;

    setLoadingMoreSuggestions(true);
    try {
      // Convert existing themes to format for API
      const existingThemes = themes.map(theme => ({
        name: theme.name,
        description: theme.description
      }));
      // Pass both existing themes and already suggested themes in this session
      const moreSuggestions = await themeService.generateThemeSuggestions(WORKSPACE_ID, existingThemes, suggestions);
      setSuggestions([...suggestions, ...moreSuggestions]);
    } catch (err) {
      console.error('Failed to load more suggestions:', err);
    } finally {
      setLoadingMoreSuggestions(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTheme(null);
  };

  const handleSubmit = async () => {
    try {
      const token = getAuthToken();

      if (editingTheme) {
        // Update existing theme
        const response = await fetch(
          `${API_BASE_URL}/api/v1/features/themes/${editingTheme.id}?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              parent_theme_id: formData.parent_theme_id
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update theme: ${response.status}`);
        }
      } else {
        // Create new theme
        const response = await fetch(
          `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              parent_theme_id: formData.parent_theme_id
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to create theme: ${response.status}`);
        }
      }

      handleCloseDialog();
      fetchThemes(); // Refresh themes list
    } catch (error) {
      console.error('Error saving theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to save theme');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
      return;
    }

    try {
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

      fetchThemes(); // Refresh themes list
      if (selectedThemeId === themeId) {
        setSelectedThemeId(themes[0]?.id || '');
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete theme');
    }
  };

  const fetchThemeFeatures = async (themeId: string) => {
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
    } catch (error) {
      console.error('Error fetching theme features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const fetchAllFeatures = async () => {
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
    } catch (error) {
      console.error('Error fetching all features:', error);
      setThemeFeatures([]);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const handleThemeClick = (theme: Theme) => {
    setSelectedThemeForDrawer(theme);
    setShowingAllFeatures(false);
    setShowingAllFeaturesList(false);

    // If theme has children, show sub-themes first
    const hasChildren = (theme as any).children && (theme as any).children.length > 0;
    if (hasChildren) {
      setShowingSubThemes(true);
      setThemeFeatures([]);
    } else {
      setShowingSubThemes(false);
      fetchThemeFeatures(theme.id);
    }
  };

  const handleAllThemesClick = () => {
    setSelectedThemeForDrawer(null);
    setShowingAllFeatures(true);
    setShowingAllFeaturesList(false);
    setShowingSubThemes(false);
    setThemeFeatures([]);
  };

  const handleAllFeaturesClick = () => {
    setSelectedThemeForDrawer(null);
    setShowingAllFeatures(false);
    setShowingAllFeaturesList(true);
    setShowingSubThemes(false);
    fetchAllFeatures();
  };

  const handleFeatureThemeChange = async (featureId: string, newThemeId: string | null) => {
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
          body: JSON.stringify({
            theme_id: newThemeId
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update feature theme: ${response.status}`);
      }

      // Refresh the features list
      if (selectedThemeForDrawer) {
        fetchThemeFeatures(selectedThemeForDrawer.id);
      } else if (showingAllFeatures) {
        fetchAllFeatures();
      }

      // Refresh themes to update counts
      fetchThemes();
    } catch (error) {
      console.error('Error updating feature theme:', error);
      setError(error instanceof Error ? error.message : 'Failed to update feature theme');
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedThemeForDrawer(null);
    setThemeFeatures([]);
  };

  const handleOpenEditModal = (feature: Feature) => {
    setEditingFeature(feature);
    setEditFormData({
      name: feature.name,
      description: feature.description
    });
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingFeature(null);
    setEditFormData({ name: '', description: '' });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingFeature || !editFormData.name.trim()) {
      setEditError('Feature name cannot be empty');
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${editingFeature.id}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editFormData.name,
            description: editFormData.description
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update feature: ${response.status}`);
      }

      const updatedFeature = await response.json();
      setThemeFeatures(themeFeatures.map(f => f.id === editingFeature.id ? updatedFeature : f));
      handleCloseEditModal();

      // Refresh themes to update counts if needed
      fetchThemes();
    } catch (error) {
      console.error('Error saving feature:', error);
      setEditError(error instanceof Error ? error.message : 'Failed to save feature');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenAddModal = () => {
    setAddFormData({ name: '', description: '' });
    setAddError(null);
    setFeatureSuggestions([]);
    setAddModalOpen(true);

    // Load suggestions asynchronously
    if (WORKSPACE_ID && selectedThemeForDrawer) {
      setLoadingFeatureSuggestions(true);
      // Convert existing features to the format expected by the service
      const existingFeaturesForAI = themeFeatures.map(f => ({
        name: f.name,
        description: f.description
      }));
      themeService
        .generateFeatureSuggestions(WORKSPACE_ID, selectedThemeForDrawer.name, existingFeaturesForAI)
        .then((suggestions) => {
          setFeatureSuggestions(suggestions);
        })
        .catch((err) => {
          console.error('Failed to load feature suggestions:', err);
          setFeatureSuggestions([]);
        })
        .finally(() => {
          setLoadingFeatureSuggestions(false);
        });
    }
  };

  const handleLoadMoreFeatureSuggestions = () => {
    if (!WORKSPACE_ID || !selectedThemeForDrawer || loadingMoreFeatureSuggestions) return;

    setLoadingMoreFeatureSuggestions(true);
    // Convert existing features to the format expected by the service
    const existingFeaturesForAI = themeFeatures.map(f => ({
      name: f.name,
      description: f.description
    }));
    themeService
      .generateFeatureSuggestions(
        WORKSPACE_ID,
        selectedThemeForDrawer.name,
        existingFeaturesForAI,
        featureSuggestions // Pass already-suggested as the fourth parameter
      )
      .then((moreSuggestions) => {
        setFeatureSuggestions([...featureSuggestions, ...moreSuggestions]);
      })
      .catch((err) => {
        console.error('Failed to load more feature suggestions:', err);
      })
      .finally(() => {
        setLoadingMoreFeatureSuggestions(false);
      });
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setAddFormData({ name: '', description: '' });
    setAddError(null);
    setFeatureSuggestions([]);
  };

  const handleSaveAdd = async () => {
    if (!addFormData.name.trim()) {
      setAddError('Feature name cannot be empty');
      return;
    }

    try {
      setSavingAdd(true);
      setAddError(null);
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: addFormData.name,
            description: addFormData.description,
            theme_id: selectedThemeForDrawer?.id || null
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create feature: ${response.status}`);
      }

      const newFeature = await response.json();
      setThemeFeatures([...themeFeatures, newFeature]);
      handleCloseAddModal();

      // Refresh themes to update counts if needed
      fetchThemes();
    } catch (error) {
      console.error('Error creating feature:', error);
      setAddError(error instanceof Error ? error.message : 'Failed to create feature');
    } finally {
      setSavingAdd(false);
    }
  };

  const handleOpenDeleteConfirm = (feature: Feature) => {
    setFeatureToDelete(feature);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setFeatureToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!featureToDelete) return;

    try {
      setDeletingFeature(true);
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureToDelete.id}?workspace_id=${WORKSPACE_ID}`,
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

      // Remove from theme features
      setThemeFeatures(themeFeatures.filter(f => f.id !== featureToDelete.id));
      handleCloseDeleteConfirm();

      // Refresh themes to update counts
      fetchThemes();
    } catch (error) {
      console.error('Error deleting feature:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete feature');
    } finally {
      setDeletingFeature(false);
    }
  };

  // Delete mention handlers
  const handleOpenDeleteMentionConfirm = (message: Message) => {
    setMentionToDelete(message);
    setDeleteMentionConfirmOpen(true);
  };

  const handleCloseDeleteMentionConfirm = () => {
    setDeleteMentionConfirmOpen(false);
    setMentionToDelete(null);
  };

  const handleConfirmDeleteMention = async () => {
    if (!mentionToDelete || !selectedFeatureForMessages) {
      return;
    }

    setDeletingMention(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/features/${selectedFeatureForMessages.id}/messages/${mentionToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.status}`);
      }

      // Remove from featureMessages
      setFeatureMessages(featureMessages.filter(m => m.id !== mentionToDelete.id));
      handleCloseDeleteMentionConfirm();

      // Clear selected message if it was deleted
      if (selectedMessageId === mentionToDelete.id) {
        setSelectedMessageId(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete message');
    } finally {
      setDeletingMention(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#4caf50'; // Green
    if (confidence >= 0.5) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  // Show loading state while fetching workspace ID
  if (isAuthenticated && !WORKSPACE_ID && (fetchingWorkspaceId || !attemptedFetch)) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  // Show error if we can't get workspace ID after attempting to fetch it
  if (isAuthenticated && !WORKSPACE_ID && attemptedFetch && !fetchingWorkspaceId) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Workspace ID not found. Please log in again.
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  const getThemeValidationConfidence = (feature: Feature) => {
    return feature.ai_metadata?.theme_validation?.confidence ?? null;
  };

  const fetchFeatureMessages = async (featureId: string) => {
    try {
      setLoadingMessages(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const messages = await response.json();
      setFeatureMessages(messages);
    } catch (error) {
      console.error('Error fetching feature messages:', error);
      setFeatureMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleShowMessages = (feature: Feature) => {
    setSelectedFeatureForMessages(feature);
    setMentionsDrawerOpen(true);
    setDrawerLevel('mentions');
    setSelectedMessageId(null);
    fetchFeatureMessages(feature.id);
  };

  const handleBackFromMessages = () => {
    setMentionsDrawerOpen(false);
    setSelectedFeatureForMessages(null);
    setFeatureMessages([]);
    setDrawerLevel('mentions');
  };

  const handleViewMentionDetails = (message: Message) => {
    setSelectedMessageId(message.id);
    setDrawerLevel('details');
  };

  const handleBackFromMentionDetails = () => {
    setDrawerLevel('mentions');
    setSelectedMessageId(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Row-based theme renderer with proper hierarchy
  const renderThemeRow = (themeItem: any, level: number = 0) => {
    const indentWidth = level * 32; // 32px indent per level
    const hasChildren = themeItem.children && themeItem.children.length > 0;
    const isExpanded = expandedThemes.has(themeItem.id);

    return (
      <React.Fragment key={themeItem.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            px: 2,
            ml: indentWidth / 8, // Convert to MUI spacing units
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            mb: 0.5,
            position: 'relative',
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
              borderColor: theme.palette.primary.main,
              transform: 'translateX(4px)',
            },
            '&:hover .theme-menu-button': {
              opacity: 1,
              visibility: 'visible',
            }
          }}
          onClick={() => handleThemeClick(themeItem)}
        >
          {/* Hierarchy indicator */}
          {level > 0 && (
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              bgcolor: '#4FC3F7', // Light blue - more soothing
              borderRadius: '0 1px 1px 0'
            }} />
          )}

          {/* Theme name and info */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {themeItem.name}
              </Typography>
            </Box>

            {/* Feature & Mention Count Badges */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 'auto', width: 'auto' }}>
              {themeItem.feature_count > 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.6,
                  py: 0.15,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.text.primary, 0.03),
                  height: 20,
                  whiteSpace: 'nowrap',
                }}>
                  <FeatureIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                    {themeItem.feature_count}
                  </Typography>
                </Box>
              )}
              {themeItem.mention_count !== undefined && themeItem.mention_count > 0 && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.6,
                  py: 0.15,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.text.primary, 0.03),
                  height: 20,
                  whiteSpace: 'nowrap',
                }}>
                  <MessageIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                    {themeItem.mention_count}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Actions - Dropdown Menu - Hidden on non-hover */}
          <IconButton
            className="theme-menu-button"
            size="small"
            onClick={(e) => handleMenuOpen(e, themeItem)}
            sx={{
              width: 28,
              height: 28,
              opacity: 0,
              visibility: 'hidden',
              transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
              color: theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main
              }
            }}
            title="More options"
          >
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {/* Expand/Collapse button */}
          {hasChildren && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleThemeExpansion(themeItem.id);
              }}
              sx={{
                width: 28,
                height: 28,
                color: theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main
                }
              }}
            >
              {isExpanded ? (
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              ) : (
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          )}
        </Box>

        {/* Render sub-themes only when expanded */}
        {hasChildren && isExpanded && themeItem.children.map((childTheme: any) =>
          renderThemeRow(childTheme, level + 1)
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box>
          {/* Header Skeleton */}
          <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width={200} height={40} />
            <Skeleton variant="text" width={300} height={24} sx={{ mt: 1 }} />
          </Box>

          <Grid container spacing={3}>
            {/* Left Panel - Themes List Skeleton */}
            <Grid item xs={12} md={5}>
              <Card sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: 'calc(100vh - 120px)',
              }}>
                <CardContent sx={{ p: 2 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Skeleton variant="text" width={150} height={32} />
                    <Skeleton variant="circular" width={40} height={40} />
                  </Box>

                  {/* All Themes */}
                  <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 2 }} />

                  {/* Theme Items */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} variant="rounded" width="100%" height={40} sx={{ mb: 1 }} />
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* Right Panel - Features List Skeleton */}
            <Grid item xs={12} md={7}>
              <Card sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: 'calc(100vh - 120px)',
              }}>
                <CardContent sx={{ p: 3 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Skeleton variant="rounded" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width={150} height={32} />
                      <Skeleton variant="text" width={120} height={20} />
                    </Box>
                  </Box>

                  {/* Feature Items */}
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                      <Skeleton variant="text" width="80%" height={28} />
                      <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                      <Skeleton variant="text" width="90%" height={20} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={80} height={24} />
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      {/* Onboarding Blocker - shown if no themes exist and company details are missing */}
      <OnboardingBlocker
        isBlocked={showOnboardingBlocker}
        missingItems={{
          companyDetails: !companyDetailsFilledIn,
          themes: themes.length === 0,
        }}
        onDismiss={() => setShowOnboardingBlocker(false)}
      />

      <Box>
        {/* Header */}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        {/* Split Layout: Themes (Resizable) and Features (Flexible) */}
        <Box sx={{ display: 'flex', height: { xs: 'auto', md: 'calc(100vh - 120px)' }, gap: 2 }}>
          {/* Themes List - Left Panel (Resizable) - Hidden on mobile or when showing mentions */}
          {!isMobile && !showMessagesFullPage && (
            <ResizablePanel
              storageKey="themes-page-left-panel-width"
              minWidth={240}
              maxWidth={500}
              defaultWidth={300}
            >
              <Card sx={{
                borderRadius: 1,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        All Themes
                      </Typography>
                    </Box>

                    {/* Add Theme Button */}
                    <IconButton
                      onClick={() => handleOpenDialog()}
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                      title="Create New Theme"
                    >
                      <AddIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1 }}>
                    {/* All Themes Summary Row */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 1,
                        px: 2,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        mb: 1,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                          borderColor: theme.palette.primary.main,
                          transform: 'translateX(2px)',
                        },
                      }}
                      onClick={handleAllThemesClick}
                    >
                      {/* All Themes Label */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.primary.main }}>
                          All Themes
                        </Typography>
                      </Box>

                      {/* Feature & Mention Count Badges */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 'auto' }}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.6,
                          py: 0.15,
                          borderRadius: 0.75,
                          bgcolor: alpha(theme.palette.text.primary, 0.03),
                          height: 20,
                          whiteSpace: 'nowrap',
                        }}>
                          <FeatureIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                            {themes.reduce((acc, t) => acc + t.feature_count, 0)}
                          </Typography>
                        </Box>
                        {themes.reduce((acc, t) => acc + (t.mention_count || 0), 0) > 0 && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                            px: 0.6,
                            py: 0.15,
                            borderRadius: 0.75,
                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                            height: 20,
                            whiteSpace: 'nowrap',
                          }}>
                            <MessageIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                              {themes.reduce((acc, t) => acc + (t.mention_count || 0), 0)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* All Features Row */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 1,
                        px: 2,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        mb: 1,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                          borderColor: theme.palette.secondary.main,
                          transform: 'translateX(2px)',
                        },
                      }}
                      onClick={handleAllFeaturesClick}
                    >
                      {/* All Features Label */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.secondary.main }}>
                          All Features
                        </Typography>
                      </Box>

                      {/* Feature & Mention Count Badges */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 'auto' }}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.6,
                          py: 0.15,
                          borderRadius: 0.75,
                          bgcolor: alpha(theme.palette.text.primary, 0.03),
                          height: 20,
                          whiteSpace: 'nowrap',
                        }}>
                          <FeatureIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                            {themes.reduce((acc, t) => acc + t.feature_count, 0)}
                          </Typography>
                        </Box>
                        {themes.reduce((acc, t) => acc + (t.mention_count || 0), 0) > 0 && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                            px: 0.6,
                            py: 0.15,
                            borderRadius: 0.75,
                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                            height: 20,
                            whiteSpace: 'nowrap',
                          }}>
                            <MessageIcon sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.5), flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ fontWeight: 500, color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.65rem', lineHeight: 1 }}>
                              {themes.reduce((acc, t) => acc + (t.mention_count || 0), 0)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Individual Themes */}
                    {hierarchicalThemes.map((themeItem) => renderThemeRow(themeItem))}
                  </Box>
                </CardContent>
              </Card>
            </ResizablePanel>
          )}

          {/* Features and Mentions - Right Panels (Flexible) */}
          <Box ref={containerRef} sx={{ flex: 1, display: 'flex', gap: 2, minWidth: 0 }}>
            {/* Features List Panel - Dynamic width when showing mentions */}
            <Box sx={{ flex: showMessagesFullPage ? `0 0 ${featuresWidth}%` : 1, display: 'flex', minWidth: 0 }}>
            <Card sx={{
              flex: 1,
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: { xs: 'auto', md: 'calc(100vh - 120px)' }, // Fixed height for scrolling on desktop, auto on mobile
            }}>
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {selectedThemeForDrawer || showingAllFeatures || showingAllFeaturesList ? (
                  <>
                    {/* Selected Theme Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Box sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {showingAllFeatures ? 'Theme Dashboard' : showingAllFeaturesList ? 'All Features' : selectedThemeForDrawer ? selectedThemeForDrawer.name : 'All Features'}
                          </Typography>
                        {!showingAllFeatures && !showingSubThemes && selectedThemeForDrawer?.description && (
                          <Tooltip title={selectedThemeForDrawer.description} arrow placement="top">
                            <Box sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: `2px solid ${theme.palette.primary.main}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'help',
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              },
                              flexShrink: 0
                            }}>
                              <InfoIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                            </Box>
                          </Tooltip>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {showingAllFeatures
                            ? `${themes.length} themes • ${themes.reduce((acc, t) => acc + t.feature_count, 0)} total features`
                            : showingAllFeaturesList
                            ? `${themeFeatures.length} features across all themes`
                            : showingSubThemes && selectedThemeForDrawer && (selectedThemeForDrawer as any).children
                            ? `${(selectedThemeForDrawer as any).children.length} sub-themes`
                            : `${themeFeatures.length} features`
                          }
                        </Typography>
                      </Box>
                      </Box>
                      {/* Add Feature Button */}
                      {!showingAllFeatures && (
                        <Button
                          onClick={handleOpenAddModal}
                          variant="contained"
                          startIcon={<AddIcon />}
                          size="small"
                          sx={{
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                          }}
                        >
                          Add
                        </Button>
                      )}
                    </Box>

                    {/* Dashboard or Features List */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      {showingAllFeatures ? (
                        /* Dashboard View - Show only root theme cards */
                        <Grid container spacing={2}>
                          {hierarchicalThemes.map((themeItem) => (
                            <Grid item xs={12} sm={6} md={4} key={themeItem.id}>
                              <Card
                                sx={{
                                  cursor: 'pointer',
                                  height: '100%',
                                  borderRadius: 2,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: theme.shadows[4],
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                  }
                                }}
                                onClick={() => handleThemeClick(themeItem)}
                              >
                                <CardContent>
                                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    {themeItem.name}
                                  </Typography>
                                  {themeItem.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                      {themeItem.description.substring(0, 80)}{themeItem.description.length > 80 ? '...' : ''}
                                    </Typography>
                                  )}
                                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <FeatureIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                      <Typography variant="body2" fontWeight={600}>
                                        {themeItem.feature_count}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        features
                                      </Typography>
                                    </Box>
                                    {(themeItem as any).children && (themeItem as any).children.length > 0 && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CategoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                        <Typography variant="body2" fontWeight={600}>
                                          {(themeItem as any).children.length}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          sub-themes
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : showingSubThemes && selectedThemeForDrawer && (selectedThemeForDrawer as any).children ? (
                        /* Sub-themes View - Show child theme cards */
                        <Grid container spacing={2}>
                          {(selectedThemeForDrawer as any).children.map((childTheme: any) => (
                            <Grid item xs={12} sm={6} md={4} key={childTheme.id}>
                              <Card
                                sx={{
                                  cursor: 'pointer',
                                  height: '100%',
                                  borderRadius: 2,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderLeft: `3px solid ${alpha(theme.palette.secondary.main, 0.5)}`,
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: theme.shadows[4],
                                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                                    borderLeft: `3px solid ${theme.palette.secondary.main}`,
                                  }
                                }}
                                onClick={() => handleThemeClick(childTheme)}
                              >
                                <CardContent>
                                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    {childTheme.name}
                                  </Typography>
                                  {childTheme.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                      {childTheme.description.substring(0, 80)}{childTheme.description.length > 80 ? '...' : ''}
                                    </Typography>
                                  )}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
                                    <FeatureIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Typography variant="body2" fontWeight={600}>
                                      {childTheme.feature_count}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      features
                                    </Typography>
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : loadingFeatures ? (
                        <Box>
                          {[1, 2, 3, 4].map((i) => (
                            <Box key={i} sx={{ mb: 2, p: 2, borderRadius: 2, background: alpha(theme.palette.background.paper, 0.4) }}>
                              <Skeleton variant="text" width="80%" height={28} />
                              <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                              <Skeleton variant="text" width="90%" height={20} />
                              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                <Skeleton variant="rounded" width={60} height={24} />
                                <Skeleton variant="rounded" width={60} height={24} />
                                <Skeleton variant="rounded" width={80} height={24} />
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      ) : themeFeatures.length > 0 ? (
                        <>
                          {/* Filter and Sort Bar */}
                          <Box sx={{ mb: 2 }}>
                            {/* Mobile Layout */}
                            <Box sx={{ 
                              display: { xs: 'block', md: 'none' },
                              mb: 1
                            }}>
                              {/* Search Input - Full width on mobile */}
                              <TextField
                                size="small"
                                placeholder="Search features..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                  startAdornment: <SearchIcon sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
                                }}
                                fullWidth
                                sx={{ mb: 2 }}
                              />

                              {/* Controls Row - Stacked on mobile */}
                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: 1,
                                mb: 1
                              }}>
                                {/* First Row: Filters and Sort */}
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                  <Button
                                    size="small"
                                    startIcon={<FilterListIcon />}
                                    onClick={() => setShowFilters(!showFilters)}
                                    variant="outlined"
                                    sx={{ flex: 1 }}
                                  >
                                    Filters
                                  </Button>

                                  <FormControl size="small" sx={{ flex: 2, minWidth: 120 }}>
                                    <InputLabel>Sort By</InputLabel>
                                    <Select
                                      value={sortBy}
                                      label="Sort By"
                                      onChange={(e) => setSortBy(e.target.value)}
                                    >
                                      <MenuItem value="last_mentioned">Last Mentioned</MenuItem>
                                      <MenuItem value="mention_count">Mentions</MenuItem>
                                      <MenuItem value="name">Name</MenuItem>
                                      <MenuItem value="status">Status</MenuItem>
                                      <MenuItem value="urgency">Urgency</MenuItem>
                                      <MenuItem value="mrr">MRR</MenuItem>
                                      <MenuItem value="company_name">Company Name</MenuItem>
                                    </Select>
                                  </FormControl>

                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    sx={{ minWidth: 60 }}
                                  >
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                  </Button>
                                </Box>

                                {/* Second Row: Clear and Count */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {(filterStatus !== 'all' || filterUrgency !== 'all' || filterMrrMin || filterMrrMax || searchQuery) ? (
                                    <Button
                                      size="small"
                                      startIcon={<ClearIcon />}
                                      onClick={clearFilters}
                                      color="secondary"
                                    >
                                      Clear Filters
                                    </Button>
                                  ) : <Box />}
                                  
                                  <Typography variant="caption" color="text.secondary">
                                    {filteredAndSortedFeatures.length} of {themeFeatures.length}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            {/* Desktop Layout */}
                            <Box sx={{ 
                              display: { xs: 'none', md: 'flex' }, 
                              gap: 2, 
                              alignItems: 'center', 
                              mb: 1 
                            }}>
                              {/* Search Input */}
                              <TextField
                                size="small"
                                placeholder="Search features..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                  startAdornment: <SearchIcon sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
                                }}
                                sx={{ minWidth: 250 }}
                              />

                              <Button
                                size="small"
                                startIcon={<FilterListIcon />}
                                onClick={() => setShowFilters(!showFilters)}
                                variant="outlined"
                              >
                                Filters
                              </Button>

                              {/* Sort Dropdown */}
                              <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>Sort By</InputLabel>
                                <Select
                                  value={sortBy}
                                  label="Sort By"
                                  onChange={(e) => setSortBy(e.target.value)}
                                  startAdornment={<SortIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />}
                                >
                                  <MenuItem value="last_mentioned">Last Mentioned</MenuItem>
                                  <MenuItem value="mention_count">Mentions</MenuItem>
                                  <MenuItem value="name">Name</MenuItem>
                                  <MenuItem value="status">Status</MenuItem>
                                  <MenuItem value="urgency">Urgency</MenuItem>
                                  <MenuItem value="mrr">MRR</MenuItem>
                                  <MenuItem value="company_name">Company Name</MenuItem>
                                </Select>
                              </FormControl>

                              {/* Sort Order */}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                              >
                                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                              </Button>

                              {/* Clear Filters */}
                              {(filterStatus !== 'all' || filterUrgency !== 'all' || filterMrrMin || filterMrrMax || searchQuery) && (
                                <Button
                                  size="small"
                                  startIcon={<ClearIcon />}
                                  onClick={clearFilters}
                                  color="secondary"
                                >
                                  Clear
                                </Button>
                              )}

                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {filteredAndSortedFeatures.length} of {themeFeatures.length} features
                              </Typography>
                            </Box>

                            {/* Collapsible Filter Section */}
                            <Collapse in={showFilters}>
                              <Box sx={{
                                p: 2,
                                borderRadius: 2,
                                background: alpha(theme.palette.background.paper, 0.6),
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                              }}>
                                <Grid container spacing={2}>
                                  {/* Status Filter */}
                                  <Grid item xs={12} sm={6} md={3}>
                                    <FormControl size="small" fullWidth>
                                      <InputLabel>Status</InputLabel>
                                      <Select
                                        value={filterStatus}
                                        label="Status"
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                      >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="new">New</MenuItem>
                                        <MenuItem value="in_progress">In Progress</MenuItem>
                                        <MenuItem value="completed">Completed</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>

                                  {/* Urgency Filter */}
                                  <Grid item xs={12} sm={6} md={3}>
                                    <FormControl size="small" fullWidth>
                                      <InputLabel>Urgency</InputLabel>
                                      <Select
                                        value={filterUrgency}
                                        label="Urgency"
                                        onChange={(e) => setFilterUrgency(e.target.value)}
                                      >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="low">Low</MenuItem>
                                        <MenuItem value="medium">Medium</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>

                                  {/* MRR Min Filter */}
                                  <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label="MRR Min"
                                      type="number"
                                      value={filterMrrMin}
                                      onChange={(e) => setFilterMrrMin(e.target.value)}
                                      placeholder="e.g. 100"
                                    />
                                  </Grid>

                                  {/* MRR Max Filter */}
                                  <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label="MRR Max"
                                      type="number"
                                      value={filterMrrMax}
                                      onChange={(e) => setFilterMrrMax(e.target.value)}
                                      placeholder="e.g. 1000"
                                    />
                                  </Grid>
                                </Grid>
                              </Box>
                            </Collapse>
                          </Box>

                          <List sx={{ p: 0 }}>
                          {filteredAndSortedFeatures.map((feature, index) => (
                            <React.Fragment key={feature.id}>
                              <ListItem
                                button
                                onClick={() => handleShowMessages(feature)}
                                sx={{
                                  borderRadius: 1.5,
                                  mb: 1,
                                  p: 1.5,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                                  transition: 'all 0.2s ease-in-out',
                                  '&:hover': {
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    transform: 'translateY(-2px)',
                                    boxShadow: theme.shadows[2],
                                    '& > div > div:nth-of-type(1) > div:last-child': {
                                      opacity: 1
                                    }
                                  },
                                }}
                              >
                                <Box sx={{ width: '100%' }}>
                                  {/* Top Row - Feature Name + Confidence + Urgency */}
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: { xs: 'flex-start', md: 'center' }, 
                                    justifyContent: 'space-between', 
                                    mb: 1,
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    gap: { xs: 1, sm: 0 }
                                  }}>
                                    <Box sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 1, 
                                      flex: 1,
                                      flexWrap: 'wrap'
                                    }}>
                                      <Typography 
                                        variant="subtitle1" 
                                        sx={{ 
                                          fontWeight: 600, 
                                          fontSize: '0.95rem',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {feature.name}
                                      </Typography>
                                      {feature.match_confidence !== null && feature.match_confidence !== undefined && (
                                        <Tooltip title={`Feature match confidence: ${(feature.match_confidence * 100).toFixed(0)}%`}>
                                          <Chip
                                            label={`${(feature.match_confidence * 100).toFixed(0)}%`}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              fontSize: '0.65rem',
                                              fontWeight: 600,
                                              backgroundColor: feature.match_confidence >= 0.8 ? '#4caf50' : feature.match_confidence >= 0.6 ? '#ff9800' : '#f44336',
                                              color: 'white'
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                      {getThemeValidationConfidence(feature) !== null && (
                                        <Tooltip title={`Theme classification confidence: ${getConfidenceLabel(getThemeValidationConfidence(feature)!)}`}>
                                          <Box
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: '50%',
                                              backgroundColor: getConfidenceColor(getThemeValidationConfidence(feature)!),
                                              cursor: 'help'
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                    </Box>
                                    
                                    {/* Mobile: Stack urgency and action buttons */}
                                    <Box sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 1,
                                      justifyContent: { xs: 'space-between', sm: 'flex-end' },
                                      width: { xs: '100%', sm: 'auto' }
                                    }}>
                                      <Chip
                                        label={feature.urgency}
                                        size="small"
                                        color={getUrgencyColor(feature.urgency) as any}
                                        sx={{
                                          minWidth: 'auto',
                                          height: 22,
                                          fontSize: '0.7rem',
                                          fontWeight: 600
                                        }}
                                      />
                                      
                                      <Box
                                        sx={{
                                          display: { xs: 'flex', md: 'flex' },
                                          gap: 0.5,
                                          opacity: { xs: 1, md: 0 },
                                          transition: 'opacity 0.2s ease-in-out',
                                          '_groupHover &': { opacity: 1 }
                                        }}
                                      >
                                        <Tooltip title="Edit feature">
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenEditModal(feature);
                                            }}
                                            sx={{
                                              color: theme.palette.primary.main,
                                              '&:hover': {
                                                backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                              }
                                            }}
                                          >
                                            <EditIcon sx={{ fontSize: '1.1rem' }} />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete feature">
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenDeleteConfirm(feature);
                                            }}
                                            sx={{
                                              color: theme.palette.error.main,
                                              '&:hover': {
                                                backgroundColor: alpha(theme.palette.error.main, 0.1)
                                              }
                                            }}
                                          >
                                            <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    </Box>
                                  </Box>

                                  {/* Description */}
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mb: 1.5, lineHeight: 1.5, fontSize: '0.85rem' }}
                                  >
                                    {feature.description.length > 150
                                      ? `${feature.description.substring(0, 150)}...`
                                      : feature.description
                                    }
                                  </Typography>

                                  {/* Status Row - Status, Mentions, Theme */}
                                  <Box sx={{ 
                                    display: 'flex', 
                                    gap: { xs: 0.5, sm: 1 }, 
                                    flexWrap: 'wrap', 
                                    alignItems: 'center', 
                                    mb: 1.5 
                                  }}>
                                    <Chip
                                      label={feature.status}
                                      size="small"
                                      color={getStatusColor(feature.status) as any}
                                      variant="outlined"
                                      sx={{ 
                                        minWidth: 'auto', 
                                        height: 22, 
                                        fontSize: { xs: '0.65rem', sm: '0.7rem' }
                                      }}
                                    />
                                    {feature.mention_count > 0 && (
                                      <Chip
                                        label={`${feature.mention_count} mention${feature.mention_count !== 1 ? 's' : ''}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                          minWidth: 'auto', 
                                          height: 22, 
                                          fontSize: { xs: '0.65rem', sm: '0.7rem' }
                                        }}
                                      />
                                    )}

                                    {/* Confidence Chip */}
                                    {getThemeValidationConfidence(feature) !== null && (
                                      <Chip
                                        label={`${Math.round(getThemeValidationConfidence(feature)! * 100)}% confidence`}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                          minWidth: 'auto',
                                          height: 22,
                                          fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                          backgroundColor: getConfidenceColor(getThemeValidationConfidence(feature)!),
                                          color: 'white'
                                        }}
                                      />
                                    )}

                                    {/* Theme Selector - Responsive */}
                                    <FormControl 
                                      size="small" 
                                      sx={{ 
                                        minWidth: { xs: 120, sm: 180 }, 
                                        ml: { xs: 0, sm: 'auto' },
                                        width: { xs: '100%', sm: 'auto' },
                                        mt: { xs: 1, sm: 0 }
                                      }}
                                    >
                                      <Select
                                        value={feature.theme_id || ''}
                                        onChange={(e) => handleFeatureThemeChange(feature.id, e.target.value || null)}
                                        displayEmpty
                                        renderValue={(selected) => {
                                          if (!selected) {
                                            return <em style={{ fontSize: '0.75rem' }}>No Theme</em>;
                                          }
                                          const selectedTheme = flattenedThemes.find(t => t.id === selected);
                                          if (!selectedTheme) {
                                            return <em style={{ fontSize: '0.75rem' }}>Unknown Theme</em>;
                                          }

                                          // For child themes, show "Parent / Child"
                                          if ((selectedTheme.level ?? 0) > 0 && selectedTheme.parent_theme_id) {
                                            const parentTheme = flattenedThemes.find(t => t.id === selectedTheme.parent_theme_id);
                                            if (parentTheme) {
                                              return <Box component="span" sx={{ fontSize: '0.75rem' }}>{parentTheme.name} / {selectedTheme.name}</Box>;
                                            }
                                          }

                                          // For root themes, show name only
                                          return <Box component="span" sx={{ fontSize: '0.75rem' }}>{selectedTheme.name}</Box>;
                                        }}
                                        sx={{
                                          fontSize: '0.75rem',
                                          height: 28,
                                          backgroundColor: alpha(theme.palette.background.paper, 0.5),
                                          '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.divider, 0.2),
                                          },
                                          '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.4),
                                          },
                                          '& .MuiSelect-select': {
                                            py: 0.5,
                                            fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                          }
                                        }}
                                      >
                                        <MenuItem value="">
                                          <em>No Theme</em>
                                        </MenuItem>
                                        {flattenedThemes.map((themeItem) => {
                                          // For child themes in dropdown, show "Parent / Child"
                                          let displayText = themeItem.name;
                                          if ((themeItem.level ?? 0) > 0 && themeItem.parent_theme_id) {
                                            const parentTheme = flattenedThemes.find(t => t.id === themeItem.parent_theme_id);
                                            if (parentTheme) {
                                              displayText = `${parentTheme.name} / ${themeItem.name}`;
                                            }
                                          }

                                          return (
                                            <MenuItem key={themeItem.id} value={themeItem.id}>
                                              {displayText}
                                            </MenuItem>
                                          );
                                        })}
                                      </Select>
                                    </FormControl>
                                  </Box>

                                  {/* Extracted Insights Section */}
                                  {feature.data_points && feature.data_points.length > 0 && (
                                    <Box sx={{
                                      mt: 1.5,
                                      p: 1.5,
                                      borderRadius: 1.5,
                                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                                      border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                                    }}>
                                      <Typography variant="caption" sx={{
                                        fontWeight: 600,
                                        mb: 1,
                                        display: 'block',
                                        fontSize: '0.7rem',
                                        color: theme.palette.info.main,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        📊 Extracted Insights
                                      </Typography>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {feature.data_points.map((dataPointEntry, dpIndex) => (
                                          <Box key={dpIndex} sx={{
                                            p: 1,
                                            borderRadius: 1,
                                            background: alpha(theme.palette.background.paper, 0.6),
                                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                          }}>
                                            {/* Author and timestamp */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: theme.palette.text.primary }}>
                                                {dataPointEntry.author || 'Unknown'}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                {dataPointEntry.timestamp ? new Date(dataPointEntry.timestamp).toLocaleDateString() : ''}
                                              </Typography>
                                            </Box>

                                            {/* Metrics and Data */}
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                              {/* Business Metrics */}
                                              {dataPointEntry.business_metrics && Object.entries(dataPointEntry.business_metrics).map(([key, value]) => (
                                                <Chip
                                                  key={key}
                                                  label={`${key}: ${value}`}
                                                  size="small"
                                                  variant="filled"
                                                  sx={{
                                                    fontSize: '0.65rem',
                                                    height: 20,
                                                    bgcolor: alpha(theme.palette.success.main, 0.15),
                                                    color: theme.palette.success.dark,
                                                    fontWeight: 500,
                                                  }}
                                                />
                                              ))}

                                              {/* Entities */}
                                              {dataPointEntry.entities && Object.entries(dataPointEntry.entities).map(([key, value]) => (
                                                <Chip
                                                  key={key}
                                                  label={`${key}: ${value}`}
                                                  size="small"
                                                  variant="filled"
                                                  sx={{
                                                    fontSize: '0.65rem',
                                                    height: 20,
                                                    bgcolor: alpha(theme.palette.info.main, 0.15),
                                                    color: theme.palette.info.dark,
                                                    fontWeight: 500,
                                                  }}
                                                />
                                              ))}

                                              {/* Structured Metrics */}
                                              {dataPointEntry.structured_metrics && Object.entries(dataPointEntry.structured_metrics).map(([key, value]) => (
                                                <Chip
                                                  key={key}
                                                  label={`${key}: ${value}`}
                                                  size="small"
                                                  variant="filled"
                                                  sx={{
                                                    fontSize: '0.65rem',
                                                    height: 20,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                                                    color: theme.palette.primary.dark,
                                                    fontWeight: 500,
                                                  }}
                                                />
                                              ))}
                                            </Box>
                                          </Box>
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </Box>
                              </ListItem>
                              {index < filteredAndSortedFeatures.length - 1 && (
                                <Divider sx={{ my: 0.5, opacity: 0.3 }} />
                              )}
                            </React.Fragment>
                          ))}
                          </List>
                        </>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                          <FeatureIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                            No Features Found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            This theme doesn't have any features yet.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </>
                ) : (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    <FeatureIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      Select a Theme
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click on a theme from the left to view its features here.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
            </Box>

            {/* Mentions and Details Drawer */}
            <Drawer
              anchor="right"
              open={mentionsDrawerOpen && selectedFeatureForMessages}
              onClose={handleBackFromMessages}
              elevation={0}
              slotProps={{
                backdrop: {
                  sx: {
                    backgroundColor: 'transparent',
                    backdropFilter: 'none'
                  }
                }
              }}
              PaperProps={{
                sx: {
                  width: { xs: '100%', sm: '70%', md: '50%' },
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: `-2px 0 6px ${alpha(theme.palette.common.black, 0.06)}`,
                  zIndex: 1200,
                  mt: { xs: 7, sm: 8, md: 8 },
                  height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)', md: 'calc(100vh - 64px)' },
                }
              }}
            >
              {drawerLevel === 'mentions' && selectedFeatureForMessages && (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Mentions List Header */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    p: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {selectedFeatureForMessages.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {searchQuery.trim()
                          ? featureMessages.filter((m) => {
                              const query = searchQuery.toLowerCase();
                              const customerName = (m.customer_name || m.sender_name || '').toLowerCase();
                              const customerEmail = (m.customer_email || '').toLowerCase();
                              return customerName.includes(query) || customerEmail.includes(query);
                            }).length
                          : featureMessages.length} mentions
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={handleBackFromMessages}
                      size="small"
                      sx={{
                        color: theme.palette.text.secondary,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main
                        }
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>

                  {/* Mentions List Content */}
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {loadingMessages ? (
                      // Shimmer loading state for mentions
                      Array.from({ length: 3 }).map((_, index) => (
                        <Box key={`mention-shimmer-${index}`} sx={{
                          p: 2,
                          mb: 1,
                          borderRadius: 1,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          animation: 'pulse 1.5s ease-in-out infinite',
                          '@keyframes pulse': {
                            '0%': { opacity: 1 },
                            '50%': { opacity: 0.4 },
                            '100%': { opacity: 1 },
                          },
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            {/* Avatar shimmer */}
                            <Box sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: alpha(theme.palette.grey[500], 0.2),
                              flexShrink: 0,
                            }} />
                            
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {/* Name and email shimmer */}
                              <Box sx={{
                                height: 16,
                                width: '60%',
                                borderRadius: 0.5,
                                background: alpha(theme.palette.grey[500], 0.2),
                                mb: 0.5,
                              }} />
                              <Box sx={{
                                height: 14,
                                width: '40%',
                                borderRadius: 0.5,
                                background: alpha(theme.palette.grey[500], 0.15),
                                mb: 1,
                              }} />
                              
                              {/* Message content shimmer */}
                              <Box sx={{
                                height: 14,
                                width: '90%',
                                borderRadius: 0.5,
                                background: alpha(theme.palette.grey[500], 0.15),
                                mb: 0.5,
                              }} />
                              <Box sx={{
                                height: 14,
                                width: '70%',
                                borderRadius: 0.5,
                                background: alpha(theme.palette.grey[500], 0.1),
                                mb: 1,
                              }} />
                              
                              {/* Tags shimmer */}
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Box sx={{
                                  height: 20,
                                  width: 60,
                                  borderRadius: 10,
                                  background: alpha(theme.palette.grey[500], 0.15),
                                }} />
                                <Box sx={{
                                  height: 20,
                                  width: 40,
                                  borderRadius: 10,
                                  background: alpha(theme.palette.grey[500], 0.1),
                                }} />
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      ))
                    ) : featureMessages.length === 0 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">No messages</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {featureMessages
                          .filter((message) => {
                            // Filter mentions by search query
                            if (!searchQuery.trim()) return true;

                            const query = searchQuery.toLowerCase();
                            const customerName = (message.customer_name || message.sender_name || '').toLowerCase();
                            const customerEmail = (message.customer_email || '').toLowerCase();

                            return customerName.includes(query) || customerEmail.includes(query);
                          })
                          .map((message) => {
                          const insightCounts = {
                            features: message.ai_insights?.feature_requests?.length || 0,
                            bugs: message.ai_insights?.bug_reports?.length || 0,
                            painPoints: message.ai_insights?.pain_points?.length || 0,
                          };
                          const totalInsights = insightCounts.features + insightCounts.bugs + insightCounts.painPoints;
                          const isSelected = selectedMessageId === message.id;

                          return (
                            <Box
                              key={message.id}
                              onClick={() => handleViewMentionDetails(message)}
                              sx={{
                                p: 1.5,
                                borderRadius: 1.25,
                                cursor: 'pointer',
                                background: isSelected
                                  ? alpha(theme.palette.primary.main, 0.12)
                                  : alpha(theme.palette.background.default, 0.4),
                                border: `2px solid ${isSelected
                                  ? theme.palette.primary.main
                                  : alpha(theme.palette.divider, 0.25)}`,
                                boxShadow: isSelected
                                  ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}`
                                  : `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                '&:hover': {
                                  background: isSelected
                                    ? alpha(theme.palette.primary.main, 0.12)
                                    : alpha(theme.palette.background.default, 0.6),
                                  border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.12)}`,
                                  '& .delete-button': {
                                    opacity: 1,
                                  },
                                },
                              }}
                            >
                              {message.title && (
                                <Typography variant="caption" sx={{ fontSize: '0.85rem', fontWeight: '600', color: theme.palette.primary.main, display: 'block', mb: 0.75, lineHeight: 1.3 }}>
                                  {message.title}
                                </Typography>
                              )}
                              <Typography variant="caption" fontWeight="700" sx={{ fontSize: '0.95rem', color: theme.palette.text.primary }} noWrap display="block">
                                {message.customer_name || message.sender_name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, mt: 0.5 }} noWrap display="block">
                                {message.customer_email || message.sender_name}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, mt: 0.5, opacity: 0.7 }} noWrap display="block">
                                {formatDate(message.sent_at)}
                              </Typography>
                              {totalInsights > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                  {insightCounts.features > 0 && (
                                    <Chip
                                      label={`${insightCounts.features} features`}
                                      size="small"
                                      color="info"
                                      variant="outlined"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: '600',
                                        borderColor: alpha(theme.palette.info.main, 0.4),
                                        backgroundColor: alpha(theme.palette.info.main, 0.08),
                                        color: theme.palette.info.dark,
                                        '&:hover': {
                                          backgroundColor: alpha(theme.palette.info.main, 0.12),
                                          borderColor: alpha(theme.palette.info.main, 0.6),
                                        }
                                      }}
                                    />
                                  )}
                                  {insightCounts.bugs > 0 && (
                                    <Chip
                                      label={`${insightCounts.bugs} bugs`}
                                      size="small"
                                      color="error"
                                      variant="outlined"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: '600',
                                        borderColor: alpha(theme.palette.error.main, 0.4),
                                        backgroundColor: alpha(theme.palette.error.main, 0.08),
                                        color: theme.palette.error.dark,
                                        '&:hover': {
                                          backgroundColor: alpha(theme.palette.error.main, 0.12),
                                          borderColor: alpha(theme.palette.error.main, 0.6),
                                        }
                                      }}
                                    />
                                  )}
                                  {insightCounts.painPoints > 0 && (
                                    <Chip
                                      label={`${insightCounts.painPoints} pain points`}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: '600',
                                        borderColor: alpha(theme.palette.warning.main, 0.4),
                                        backgroundColor: alpha(theme.palette.warning.main, 0.08),
                                        color: theme.palette.warning.dark,
                                        '&:hover': {
                                          backgroundColor: alpha(theme.palette.warning.main, 0.12),
                                          borderColor: alpha(theme.palette.warning.main, 0.6),
                                        }
                                      }}
                                    />
                                  )}
                                </Box>
                              )}
                              
                              {/* Detailed Highlights for this mention */}
                              {message.ai_insights && (
                                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                                  {/* Feature Requests */}
                                  {message.ai_insights.feature_requests && message.ai_insights.feature_requests.length > 0 && (
                                    <Box sx={{ mb: 1.5 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                                        <FeatureIcon sx={{ fontSize: 12, color: 'success.main' }} />
                                        <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.success.main }}>
                                          Feature Requests
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {message.ai_insights.feature_requests.slice(0, 2).map((feature, idx) => (
                                          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: '600', color: theme.palette.text.primary }}>
                                              • {feature.title}
                                            </Typography>
                                            {feature.description && (
                                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, ml: 1, opacity: 0.8 }}>
                                                {feature.description.length > 80 ? `${feature.description.substring(0, 80)}...` : feature.description}
                                              </Typography>
                                            )}
                                            {feature.urgency && (
                                              <Chip
                                                label={feature.urgency}
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  height: 16,
                                                  fontSize: '0.6rem',
                                                  fontWeight: '500',
                                                  ml: 1,
                                                  alignSelf: 'flex-start',
                                                  borderColor: alpha(theme.palette.success.main, 0.3),
                                                  backgroundColor: alpha(theme.palette.success.main, 0.05),
                                                  color: theme.palette.success.dark,
                                                  '& .MuiChip-label': { px: 0.5 }
                                                }}
                                              />
                                            )}
                                          </Box>
                                        ))}
                                        {message.ai_insights.feature_requests.length > 2 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.success.main, ml: 1 }}>
                                            +{message.ai_insights.feature_requests.length - 2} more features
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Bug Reports */}
                                  {message.ai_insights.bug_reports && message.ai_insights.bug_reports.length > 0 && (
                                    <Box sx={{ mb: 1.5 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                                        <BugReportIcon sx={{ fontSize: 12, color: 'error.main' }} />
                                        <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.error.main }}>
                                          Issues Reported
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {message.ai_insights.bug_reports.slice(0, 2).map((bug, idx) => (
                                          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: '600', color: theme.palette.text.primary }}>
                                              • {bug.title}
                                            </Typography>
                                            {bug.description && (
                                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, ml: 1, opacity: 0.8 }}>
                                                {bug.description.length > 80 ? `${bug.description.substring(0, 80)}...` : bug.description}
                                              </Typography>
                                            )}
                                            {bug.severity && (
                                              <Chip
                                                label={bug.severity}
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  height: 16,
                                                  fontSize: '0.6rem',
                                                  fontWeight: '500',
                                                  ml: 1,
                                                  alignSelf: 'flex-start',
                                                  borderColor: alpha(theme.palette.error.main, 0.3),
                                                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                                                  color: theme.palette.error.dark,
                                                  '& .MuiChip-label': { px: 0.5 }
                                                }}
                                              />
                                            )}
                                          </Box>
                                        ))}
                                        {message.ai_insights.bug_reports.length > 2 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.error.main, ml: 1 }}>
                                            +{message.ai_insights.bug_reports.length - 2} more issues
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Pain Points */}
                                  {message.ai_insights.pain_points && message.ai_insights.pain_points.length > 0 && (
                                    <Box sx={{ mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                                        <SadIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                                        <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.warning.main }}>
                                          Pain Points
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {message.ai_insights.pain_points.slice(0, 2).map((pain, idx) => (
                                          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: theme.palette.text.primary }}>
                                              • {pain.description.length > 100 ? `${pain.description.substring(0, 100)}...` : pain.description}
                                            </Typography>
                                            {pain.impact && (
                                              <Chip
                                                label={`${pain.impact} impact`}
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  height: 16,
                                                  fontSize: '0.6rem',
                                                  fontWeight: '500',
                                                  ml: 1,
                                                  alignSelf: 'flex-start',
                                                  borderColor: alpha(theme.palette.warning.main, 0.3),
                                                  backgroundColor: alpha(theme.palette.warning.main, 0.05),
                                                  color: theme.palette.warning.dark,
                                                  '& .MuiChip-label': { px: 0.5 }
                                                }}
                                              />
                                            )}
                                          </Box>
                                        ))}
                                        {message.ai_insights.pain_points.length > 2 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.warning.main, ml: 1 }}>
                                            +{message.ai_insights.pain_points.length - 2} more pain points
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Summary */}
                                  {message.ai_insights.summary && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.primary.main, mb: 0.5, display: 'block' }}>
                                        Summary
                                      </Typography>
                                      <Typography variant="caption" sx={{ 
                                        fontSize: '0.65rem', 
                                        color: theme.palette.text.secondary, 
                                        fontStyle: 'italic',
                                        display: 'block',
                                        lineHeight: 1.3
                                      }}>
                                        {message.ai_insights.summary.length > 150 ? `${message.ai_insights.summary.substring(0, 150)}...` : message.ai_insights.summary}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              )}
                              
                              <IconButton
                                className="delete-button"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDeleteMentionConfirm(message);
                                }}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  opacity: 0,
                                  transition: 'opacity 0.2s ease-in-out',
                                  color: theme.palette.error.main,
                                  bgcolor: alpha(theme.palette.error.main, 0.08),
                                  '&:hover': {
                                    bgcolor: alpha(theme.palette.error.main, 0.15),
                                  },
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* Message Details View */}
              {drawerLevel === 'details' && selectedFeatureForMessages && selectedMessageId && (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Details Header */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.02)
                  }}>
                    <IconButton
                      onClick={handleBackFromMentionDetails}
                      size="medium"
                      sx={{
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          color: theme.palette.primary.main
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <ArrowBackIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, fontSize: '1rem' }}>
                      Details
                    </Typography>
                    <IconButton
                      onClick={handleBackFromMessages}
                      size="small"
                      sx={{
                        color: theme.palette.text.secondary,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.action.hover, 0.5),
                          color: theme.palette.text.primary
                        }
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>

                  {/* Details Content */}
                  {/* Message Title */}
                  {(() => {
                    const selectedMessage = featureMessages.find(m => m.id === selectedMessageId);
                    return selectedMessage?.title ? (
                      <Box sx={{
                        px: 2,
                        pt: 2,
                        pb: 1.5,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                      }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: theme.palette.text.primary,
                            wordBreak: 'break-word'
                          }}
                        >
                          {selectedMessage.title}
                        </Typography>
                      </Box>
                    ) : null;
                  })()}

                  {/* Accordion Sections */}
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {(() => {
                      const selectedMessage = featureMessages.find(m => m.id === selectedMessageId);
                      if (!selectedMessage) return null;

                      return (
                        <Box sx={{ width: '100%' }}>
                          {/* Header Section */}
                          <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75, display: 'block' }}>
                                  {selectedMessage.customer_name || selectedMessage.sender_name || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.8rem' }}>
                                  {selectedMessage.customer_email || selectedMessage.sender_name}
                                </Typography>
                              </Box>
                              {/* Go to Call Button */}
                              {(() => {
                                let callUrl: string | null = null;
                                let buttonText = 'Go to Call';

                                if (selectedMessage.source === 'gong' && selectedMessage.external_id) {
                                  callUrl = `https://app.gong.io/call/${selectedMessage.external_id}`;
                                  buttonText = 'View in Gong';
                                } else if (selectedMessage.source === 'fathom' && selectedMessage.message_metadata?.recording_url) {
                                  callUrl = selectedMessage.message_metadata.recording_url;
                                  buttonText = 'View Recording';
                                }

                                if (callUrl) {
                                  return (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      endIcon={<OpenInNewIcon />}
                                      onClick={() => window.open(callUrl, '_blank')}
                                      sx={{
                                        textTransform: 'none',
                                        fontSize: '0.8rem',
                                        py: 0.75,
                                        px: 1.5,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {buttonText}
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </Box>
                          </Box>

                          {selectedMessage.ai_insights ? (
                            <Box sx={{ width: '100%' }}>
                              {/* Highlights Accordion - First and Open by Default */}
                              <Accordion defaultExpanded expanded={mentionDetailsTab === 'highlights' || mentionDetailsTab === ''} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'highlights' : '')} sx={{
                                '&.MuiAccordion-root': {
                                  boxShadow: 'none',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderRadius: 1,
                                  '&:before': { display: 'none' },
                                  backgroundColor: alpha(theme.palette.info.main, 0.02)
                                },
                                mb: 1.5
                              }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.05) }, transition: 'all 0.2s ease' }}>
                                  <LightbulbIcon sx={{ fontSize: 20, mr: 1.5, color: 'info.main' }} />
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Highlights</Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                                  {selectedMessage.ai_insights.summary && (
                                    <Box mb={2}>
                                      <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                                        Overview
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                                        {selectedMessage.ai_insights.summary}
                                      </Typography>
                                    </Box>
                                  )}

                                  {selectedMessage.ai_insights.feature_requests && selectedMessage.ai_insights.feature_requests.length > 0 && (
                                    <Box mb={2}>
                                      <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.success.main }}>
                                        {selectedMessage.ai_insights.feature_requests.length} Feature Request{selectedMessage.ai_insights.feature_requests.length !== 1 ? 's' : ''}
                                      </Typography>
                                      <Box mt={0.5}>
                                        {selectedMessage.ai_insights.feature_requests.slice(0, 3).map((feature, idx) => (
                                          <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                                            • {feature.title}
                                          </Typography>
                                        ))}
                                        {selectedMessage.ai_insights.feature_requests.length > 3 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                                            +{selectedMessage.ai_insights.feature_requests.length - 3} more
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {selectedMessage.ai_insights.bug_reports && selectedMessage.ai_insights.bug_reports.length > 0 && (
                                    <Box mb={2}>
                                      <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.error.main }}>
                                        {selectedMessage.ai_insights.bug_reports.length} Bug Report{selectedMessage.ai_insights.bug_reports.length !== 1 ? 's' : ''}
                                      </Typography>
                                      <Box mt={0.5}>
                                        {selectedMessage.ai_insights.bug_reports.slice(0, 3).map((bug, idx) => (
                                          <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                                            • {bug.title}
                                          </Typography>
                                        ))}
                                        {selectedMessage.ai_insights.bug_reports.length > 3 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                                            +{selectedMessage.ai_insights.bug_reports.length - 3} more
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}

                                  {selectedMessage.ai_insights.pain_points && selectedMessage.ai_insights.pain_points.length > 0 && (
                                    <Box>
                                      <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.75rem', color: theme.palette.warning.main }}>
                                        {selectedMessage.ai_insights.pain_points.length} Pain Point{selectedMessage.ai_insights.pain_points.length !== 1 ? 's' : ''}
                                      </Typography>
                                      <Box mt={0.5}>
                                        {selectedMessage.ai_insights.pain_points.slice(0, 3).map((pain, idx) => (
                                          <Typography key={idx} variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: theme.palette.text.secondary }}>
                                            • {pain.description.substring(0, 50)}...
                                          </Typography>
                                        ))}
                                        {selectedMessage.ai_insights.pain_points.length > 3 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.primary.main }}>
                                            +{selectedMessage.ai_insights.pain_points.length - 3} more
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}
                                </AccordionDetails>
                              </Accordion>

                              {/* Features Accordion */}
                              <Accordion expanded={mentionDetailsTab === 'features'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'features' : '')} sx={{
                                '&.MuiAccordion-root': {
                                  boxShadow: 'none',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderRadius: 1,
                                  '&:before': { display: 'none' },
                                  backgroundColor: alpha(theme.palette.success.main, 0.02)
                                },
                                mb: 1.5
                              }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.05) }, transition: 'all 0.2s ease' }}>
                                  <FeatureIcon sx={{ fontSize: 20, mr: 1.5, color: 'success.main' }} />
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Features</Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                                    {selectedMessage.ai_insights.feature_requests?.length || 0}
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                                  {selectedMessage.ai_insights.feature_requests && selectedMessage.ai_insights.feature_requests.length > 0 ? (
                                    selectedMessage.ai_insights.feature_requests.map((feature, idx) => (
                                      <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < selectedMessage.ai_insights.feature_requests.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                                        <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                                          {feature.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                                          {feature.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem', display: 'block', mb: 0.5 }}>
                                          "{feature.quote}"
                                        </Typography>
                                        <Chip
                                          label={feature.urgency}
                                          size="small"
                                          color={feature.urgency === 'high' || feature.urgency === 'critical' ? 'error' : feature.urgency === 'medium' ? 'warning' : 'default'}
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                      No features found in this mention
                                    </Typography>
                                  )}
                                </AccordionDetails>
                              </Accordion>

                              {/* Bugs Accordion */}
                              <Accordion expanded={mentionDetailsTab === 'bugs'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'bugs' : '')} sx={{
                                '&.MuiAccordion-root': {
                                  boxShadow: 'none',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderRadius: 1,
                                  '&:before': { display: 'none' },
                                  backgroundColor: alpha(theme.palette.error.main, 0.02)
                                },
                                mb: 1.5
                              }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.05) }, transition: 'all 0.2s ease' }}>
                                  <BugReportIcon sx={{ fontSize: 20, mr: 1.5, color: 'error.main' }} />
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Bugs</Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                                    {selectedMessage.ai_insights.bug_reports?.length || 0}
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                                  {selectedMessage.ai_insights.bug_reports && selectedMessage.ai_insights.bug_reports.length > 0 ? (
                                    selectedMessage.ai_insights.bug_reports.map((bug, idx) => (
                                      <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < selectedMessage.ai_insights.bug_reports.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                                        <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                                          {bug.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                                          {bug.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem', display: 'block', mb: 0.5 }}>
                                          "{bug.quote}"
                                        </Typography>
                                        <Chip
                                          label={bug.severity}
                                          size="small"
                                          color={bug.severity === 'high' || bug.severity === 'critical' ? 'error' : bug.severity === 'medium' ? 'warning' : 'default'}
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                      No bugs found in this mention
                                    </Typography>
                                  )}
                                </AccordionDetails>
                              </Accordion>

                              {/* Pain Points Accordion */}
                              <Accordion expanded={mentionDetailsTab === 'pain-points'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'pain-points' : '')} sx={{
                                '&.MuiAccordion-root': {
                                  boxShadow: 'none',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderRadius: 1,
                                  '&:before': { display: 'none' },
                                  backgroundColor: alpha(theme.palette.warning.main, 0.02)
                                },
                                mb: 1.5
                              }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.05) }, transition: 'all 0.2s ease' }}>
                                  <SadIcon sx={{ fontSize: 20, mr: 1.5, color: 'warning.main' }} />
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Pain Points</Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, ml: 'auto' }}>
                                    {selectedMessage.ai_insights.pain_points?.length || 0}
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                                  {selectedMessage.ai_insights.pain_points && selectedMessage.ai_insights.pain_points.length > 0 ? (
                                    selectedMessage.ai_insights.pain_points.map((pain, idx) => (
                                      <Box key={idx} mb={2} pb={2} sx={{ borderBottom: idx < selectedMessage.ai_insights.pain_points.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none' }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mb: 0.5 }}>
                                          {pain.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                          Impact: <strong>{pain.impact}</strong>
                                        </Typography>
                                        {pain.quote && (
                                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
                                            "{pain.quote}"
                                          </Typography>
                                        )}
                                      </Box>
                                    ))
                                  ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                      No pain points found in this mention
                                    </Typography>
                                  )}
                                </AccordionDetails>
                              </Accordion>

                              {/* Summary Accordion */}
                              <Accordion expanded={mentionDetailsTab === 'summary'} onChange={(e, isExpanded) => setMentionDetailsTab(isExpanded ? 'summary' : '')} sx={{
                                '&.MuiAccordion-root': {
                                  boxShadow: 'none',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  borderRadius: 1,
                                  '&:before': { display: 'none' },
                                  backgroundColor: alpha(theme.palette.primary.main, 0.02)
                                },
                                mb: 1.5
                              }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 1, px: 1.5, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }, transition: 'all 0.2s ease' }}>
                                  <SummarizeIcon sx={{ fontSize: 20, mr: 1.5, color: 'primary.main' }} />
                                  <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.95rem' }}>Summary</Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1.5, px: 1.5, pb: 1.5 }}>
                                  {selectedMessage.ai_insights.summary && (
                                    <Box mb={2}>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        {selectedMessage.ai_insights.summary}
                                      </Typography>
                                    </Box>
                                  )}

                                  {/* Sentiment in Summary */}
                                  {selectedMessage.ai_insights.sentiment && (
                                    <Box mb={2}>
                                      <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ fontSize: '0.85rem' }}>
                                        Sentiment
                                      </Typography>
                                      <Box pl={1}>
                                        <Chip
                                          label={`${selectedMessage.ai_insights.sentiment.overall} (${selectedMessage.ai_insights.sentiment.score})`}
                                          size="small"
                                          color={selectedMessage.ai_insights.sentiment.overall === 'positive' ? 'success' : selectedMessage.ai_insights.sentiment.overall === 'negative' ? 'error' : 'default'}
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                        <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ fontSize: '0.75rem' }}>
                                          {selectedMessage.ai_insights.sentiment.reasoning}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Key Topics in Summary */}
                                  {selectedMessage.ai_insights.key_topics && selectedMessage.ai_insights.key_topics.length > 0 && (
                                    <Box>
                                      <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ fontSize: '0.85rem' }}>
                                        Key Topics
                                      </Typography>
                                      <Box pl={1} display="flex" gap={0.5} flexWrap="wrap">
                                        {selectedMessage.ai_insights.key_topics.map((topic, idx) => (
                                          <Chip key={idx} label={topic} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </AccordionDetails>
                              </Accordion>

                              {/* Message Metadata */}
                              <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                width: '100%',
                                mt: 3,
                                pt: 2,
                                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                              }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {selectedMessage.sender_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                                  in #{selectedMessage.channel_name}
                                </Typography>
                              </Box>
                            </Box>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                wordBreak: 'break-word',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.85rem'
                              }}
                            >
                              {selectedMessage.content}
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </Box>
                </Box>
              )}
            </Drawer>
          </Box>
        </Box>

        {/* Mobile FAB to open themes drawer */}
        {isMobile && (
          <Fab
            color="primary"
            aria-label="open themes"
            onClick={() => setMobileThemesDrawerOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              left: 24,
              zIndex: 1000,
            }}
          >
            <CategoryIcon />
          </Fab>
        )}

        {/* Mobile Themes Drawer */}
        <Drawer
          anchor="left"
          open={isMobile && mobileThemesDrawerOpen}
          onClose={() => setMobileThemesDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: '85%',
              maxWidth: 400,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
            }
          }}
        >
          <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  All Themes
                </Typography>
              </Box>
              <IconButton
                onClick={() => setMobileThemesDrawerOpen(false)}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Themes Content */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {/* All Themes Summary Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1,
                  px: 2,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  mb: 1,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                    borderColor: theme.palette.primary.main,
                    transform: 'translateX(2px)',
                  },
                }}
                onClick={() => {
                  handleAllThemesClick();
                  setMobileThemesDrawerOpen(false);
                }}
              >
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.primary.main }}>
                    All Themes
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FeatureIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: theme.palette.primary.main,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {themes.reduce((acc, t) => acc + t.feature_count, 0)}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* All Features Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1,
                  px: 2,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  mb: 1,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                    borderColor: theme.palette.secondary.main,
                    transform: 'translateX(2px)',
                  },
                }}
                onClick={() => {
                  handleAllFeaturesClick();
                  setMobileThemesDrawerOpen(false);
                }}
              >
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.secondary.main }}>
                    All Features
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FeatureIcon sx={{ fontSize: 16, color: theme.palette.secondary.main }} />
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: theme.palette.secondary.main,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {themes.reduce((acc, t) => acc + t.feature_count, 0)}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Add Theme Button */}
              <Box sx={{ mb: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    handleOpenDialog();
                    setMobileThemesDrawerOpen(false);
                  }}
                  sx={{
                    py: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    color: theme.palette.primary.main,
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    }
                  }}
                >
                  Create New Theme
                </Button>
              </Box>

              {/* Individual Themes */}
              <Box
                onClick={() => setMobileThemesDrawerOpen(false)}
                sx={{ '& > *': { cursor: 'pointer' } }}
              >
                {hierarchicalThemes.map((themeItem) => renderThemeRow(themeItem))}
              </Box>
            </Box>
          </Box>
        </Drawer>

        {/* Create/Edit Theme Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            px: 3,
            pt: 2
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingTheme ? 'Edit Theme' : 'Create New Theme'}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <DialogContent sx={{ pt: 2, p: 0 }}>
            <Box sx={{ display: 'flex', height: '100%', minHeight: editingTheme ? 'auto' : '400px' }}>
              {/* Left Column - Form */}
              <Box sx={{ flex: 1, p: 3, pr: 2, borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Theme Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    fullWidth
                    required
                    placeholder="e.g., User Interface"
                  />

                  <TextField
                    label="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    fullWidth
                    multiline
                    rows={3}
                    required
                    placeholder="Describe what this theme is about..."
                  />

                  <TextField
                    select
                    label="Parent Theme (Optional)"
                    value={formData.parent_theme_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_theme_id: e.target.value || null })}
                    fullWidth
                    helperText="Select a parent theme to create a sub-theme"
                  >
                    <MenuItem value="">None (Root Theme)</MenuItem>
                    {themes
                      .filter(t => !t.parent_theme_id && t.id !== editingTheme?.id) // Only show root themes and exclude current theme if editing
                      .map((parentTheme) => (
                        <MenuItem key={parentTheme.id} value={parentTheme.id}>
                          {parentTheme.name}
                        </MenuItem>
                      ))}
                  </TextField>
                </Box>
              </Box>

              {/* Right Column - Suggestions */}
              {!editingTheme && (
                <Box sx={{ flex: 0.9, p: 3, pl: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                    AI Suggestions
                  </Typography>

                  {loadingSuggestions ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flex: 1 }}>
                      <CircularProgress size={32} />
                    </Box>
                  ) : suggestions.length > 0 ? (
                    <>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, overflow: 'auto', mb: 2 }}>
                        {suggestions.map((suggestion, index) => (
                          <Card
                            key={index}
                            sx={{
                              p: 1.5,
                              cursor: 'pointer',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                              transition: 'all 0.2s ease',
                              flexShrink: 0,
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                borderColor: theme.palette.primary.main,
                                transform: 'translateX(4px)',
                              }
                            }}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                name: suggestion.name,
                                description: suggestion.description
                              });
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {suggestion.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                              {suggestion.description}
                            </Typography>
                          </Card>
                        ))}
                      </Box>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={handleLoadMoreSuggestions}
                        disabled={loadingMoreSuggestions}
                        startIcon={loadingMoreSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
                        sx={{ mt: 'auto' }}
                      >
                        {loadingMoreSuggestions ? 'Generating...' : 'Suggest More'}
                      </Button>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No suggestions available. Please set up company details first.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, pt: 1.5 }}>
            <Button onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={!formData.name || !formData.description}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
              }}
            >
              {editingTheme ? 'Update Theme' : 'Create Theme'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Theme Features Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={handleCloseDrawer}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '100%', sm: 576 },
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
              backdropFilter: 'blur(20px)',
              zIndex: 1300, // Higher than AppBar but reasonable
              top: 64, // Start below AppBar
              height: 'calc(100vh - 64px)', // Full height minus AppBar
            },
          }}
        >
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedThemeForDrawer?.name || 'Theme Features'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {themeFeatures.length} features in this theme
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={handleCloseDrawer} sx={{ borderRadius: 2 }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Features List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loadingFeatures ? (
                <Box>
                  {[1, 2, 3, 4].map((i) => (
                    <Box key={i} sx={{ mb: 2, p: 2, borderRadius: 2, background: alpha(theme.palette.background.paper, 0.4) }}>
                      <Skeleton variant="text" width="80%" height={28} />
                      <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                      <Skeleton variant="text" width="90%" height={20} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={80} height={24} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : themeFeatures.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {themeFeatures.map((feature, index) => (
                    <React.Fragment key={feature.id}>
                      <ListItem
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.6)} 0%, ${alpha(theme.palette.background.paper, 0.3)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                              {feature.name}
                            </Typography>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                                {feature.description.length > 100
                                  ? `${feature.description.substring(0, 100)}...`
                                  : feature.description
                                }
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Chip
                                  label={feature.urgency}
                                  size="small"
                                  color={getUrgencyColor(feature.urgency) as any}
                                  sx={{ minWidth: 'auto' }}
                                />
                                <Chip
                                  label={feature.status}
                                  size="small"
                                  color={getStatusColor(feature.status) as any}
                                  variant="outlined"
                                  sx={{ minWidth: 'auto' }}
                                />
                                <Chip
                                  label={`${feature.mention_count} mentions`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    minWidth: 'auto',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                      borderColor: theme.palette.primary.main
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowMessages(feature);
                                  }}
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < themeFeatures.length - 1 && (
                        <Divider sx={{ my: 0.5, opacity: 0.5 }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <FeatureIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    No Features Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This theme doesn't have any features yet.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Drawer Footer */}
            {themeFeatures.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
              </Box>
            )}
          </Box>
        </Drawer>

        {/* Theme Actions Dropdown Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          sx={{
            '& .MuiPaper-root': {
              borderRadius: 2,
              minWidth: 160,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            },
          }}
        >
          <MenuItem
            onClick={() => handleMenuAction('edit')}
            sx={{ py: 1.5, px: 2 }}
          >
            <EditIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
            Edit Theme
          </MenuItem>
          {selectedThemeForMenu && !selectedThemeForMenu.parent_theme_id && (
            <MenuItem
              onClick={() => handleMenuAction('add-sub')}
              sx={{ py: 1.5, px: 2 }}
            >
              <AddIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
              Add Sub-theme
            </MenuItem>
          )}
          <MenuItem
            onClick={() => handleMenuAction('delete')}
            sx={{
              py: 1.5,
              px: 2,
              color: 'error.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.1)
              }
            }}
          >
            <DeleteIcon sx={{ fontSize: 18, mr: 1.5 }} />
            Delete Theme
          </MenuItem>
        </Menu>

        {/* Feature Edit Modal */}
        <Dialog
          open={editModalOpen}
          onClose={handleCloseEditModal}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Edit Feature
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {editError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editError}
              </Alert>
            )}
            {savingEdit && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
            <TextField
              autoFocus
              label="Feature Title"
              fullWidth
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              disabled={savingEdit}
              margin="normal"
              variant="outlined"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              disabled={savingEdit}
              margin="normal"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseEditModal}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={savingEdit || !editFormData.name.trim()}
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Feature Dialog */}
        <Dialog
          open={addModalOpen}
          onClose={handleCloseAddModal}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Add New Feature
          </DialogTitle>
          <DialogContent sx={{ pt: 2, p: 0 }}>
            <Box sx={{ display: 'flex', height: '100%', minHeight: '400px' }}>
              {/* Left Column - Form */}
              <Box sx={{ flex: 1, p: 3, pr: 2, borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                {addError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {addError}
                  </Alert>
                )}
                {savingAdd && (
                  <LinearProgress sx={{ mb: 2 }} />
                )}
                <TextField
                  autoFocus
                  label="Feature Title"
                  fullWidth
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  disabled={savingAdd}
                  margin="normal"
                  variant="outlined"
                  required
                  placeholder="e.g., Advanced Analytics Dashboard"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    }
                  }}
                />
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={4}
                  value={addFormData.description}
                  onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
                  disabled={savingAdd}
                  margin="normal"
                  variant="outlined"
                  placeholder="Describe what this feature does..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    }
                  }}
                />
              </Box>

              {/* Right Column - Suggestions */}
              <Box sx={{ flex: 0.9, p: 3, pl: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                  AI Suggestions
                </Typography>

                {loadingFeatureSuggestions ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flex: 1 }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : featureSuggestions.length > 0 ? (
                  <>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, overflow: 'auto', mb: 2 }}>
                      {featureSuggestions.map((suggestion, index) => (
                        <Card
                          key={index}
                          sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              borderColor: theme.palette.primary.main,
                              transform: 'translateX(4px)',
                            }
                          }}
                          onClick={() => {
                            setAddFormData({
                              ...addFormData,
                              name: suggestion.name,
                              description: suggestion.description
                            });
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {suggestion.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                            {suggestion.description}
                          </Typography>
                        </Card>
                      ))}
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={handleLoadMoreFeatureSuggestions}
                      disabled={loadingMoreFeatureSuggestions}
                      startIcon={loadingMoreFeatureSuggestions ? <CircularProgress size={16} /> : <AddIcon />}
                      sx={{ mt: 'auto' }}
                    >
                      {loadingMoreFeatureSuggestions ? 'Generating...' : '+ Suggest More'}
                    </Button>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No suggestions available. Please set up company details first.
                  </Typography>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseAddModal}
              disabled={savingAdd}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAdd}
              variant="contained"
              disabled={savingAdd || !addFormData.name.trim()}
            >
              {savingAdd ? 'Creating...' : 'Create Feature'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleCloseDeleteConfirm}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>Delete Feature</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Are you sure you want to delete this feature? This action cannot be undone.
            </Typography>
            {featureToDelete && (
              <Typography
                variant="body2"
                sx={{
                  mt: 2,
                  p: 1.5,
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                  color: theme.palette.error.main,
                }}
              >
                <strong>Feature:</strong> {featureToDelete.name}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseDeleteConfirm}
              disabled={deletingFeature}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              variant="contained"
              color="error"
              disabled={deletingFeature}
            >
              {deletingFeature ? 'Deleting...' : 'Delete Feature'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Mention Confirmation Dialog */}
        <Dialog
          open={deleteMentionConfirmOpen}
          onClose={handleCloseDeleteMentionConfirm}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>Delete Mention</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Are you sure you want to remove this mention from the feature? This action cannot be undone.
            </Typography>
            {mentionToDelete && (
              <Typography
                variant="body2"
                sx={{
                  mt: 2,
                  p: 1.5,
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                  color: theme.palette.error.main,
                }}
              >
                <strong>From:</strong> {mentionToDelete.customer_name || mentionToDelete.sender_name || 'Unknown'}
                <br />
                <strong>Date:</strong> {formatDate(mentionToDelete.sent_at)}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseDeleteMentionConfirm}
              disabled={deletingMention}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteMention}
              variant="contained"
              color="error"
              disabled={deletingMention}
            >
              {deletingMention ? 'Deleting...' : 'Delete Mention'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}