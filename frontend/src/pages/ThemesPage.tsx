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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
  Fab,
  Tooltip,
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
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { ResizablePanel } from '@/shared/components/ResizablePanel';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { ThemeData, ThemeFormData } from '@/shared/types/theme.types';
import { API_BASE_URL } from '@/config/api.config';

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
  data_points?: any[];
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
  content: string;
  sent_at: string;
  sender_name: string;
  channel_name: string;
  customer_name: string | null;
  customer_email: string | null;
  ai_insights: AIInsights | null;
}

export function ThemesPage(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { tokens } = useAuthStore();
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

  // Resizable mentions layout state
  const [featuresWidth, setFeaturesWidth] = useState(35); // 35%
  const [mentionsListWidth, setMentionsListWidth] = useState(18); // 18%
  const [isResizingMentions, setIsResizingMentions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

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

  useEffect(() => {
    fetchThemes();
    // Load all features by default
    handleAllThemesClick();
  }, []);

  // Auto-select first message when messages are loaded
  useEffect(() => {
    if (featureMessages.length > 0 && !selectedMessageId) {
      setSelectedMessageId(featureMessages[0].id);
    }
  }, [featureMessages, selectedMessageId]);

  const handleOpenDialog = (themeToEdit?: Theme, parentThemeId?: string) => {
    if (themeToEdit) {
      setEditingTheme(themeToEdit);
      setFormData({
        name: themeToEdit.name,
        description: themeToEdit.description,
        parent_theme_id: themeToEdit.parent_theme_id || null,
      });
    } else {
      setEditingTheme(null);
      setFormData({
        name: '',
        description: '',
        parent_theme_id: parentThemeId || null,
      });
    }
    setDialogOpen(true);
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
    setShowMessagesFullPage(true);
    setSelectedMessageId(null);
    fetchFeatureMessages(feature.id);
  };

  const handleBackFromMessages = () => {
    setShowMessagesFullPage(false);
    setSelectedFeatureForMessages(null);
    setFeatureMessages([]);
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
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {themeItem.name}
              </Typography>
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
              minWidth={250}
              maxWidth={600}
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

                      {/* Total Features Count */}
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
                      onClick={handleAllFeaturesClick}
                    >
                      {/* All Features Label */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.secondary.main }}>
                          All Features
                        </Typography>
                      </Box>

                      {/* Total Features Count */}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
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
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
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
                                  },
                                }}
                              >
                                <Box sx={{ width: '100%' }}>
                                  {/* Top Row - Feature Name + Urgency */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                                      {feature.name}
                                    </Typography>
                                    <Chip
                                      label={feature.urgency}
                                      size="small"
                                      color={getUrgencyColor(feature.urgency) as any}
                                      sx={{
                                        minWidth: 'auto',
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        ml: 2
                                      }}
                                    />
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
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
                                    <Chip
                                      label={feature.status}
                                      size="small"
                                      color={getStatusColor(feature.status) as any}
                                      variant="outlined"
                                      sx={{ minWidth: 'auto', height: 22, fontSize: '0.7rem' }}
                                    />
                                    <Chip
                                      label={`${feature.mention_count} mentions`}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        minWidth: 'auto',
                                        height: 22,
                                        fontSize: '0.7rem',
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

                                    {/* Theme Selector - Compact */}
                                    <FormControl size="small" sx={{ minWidth: 180, ml: 'auto' }}>
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

            {/* Draggable Divider - Between Features and Mentions */}
            {showMessagesFullPage && selectedFeatureForMessages && (
              <Box
                onMouseDown={() => setIsResizingMentions(true)}
                sx={{
                  width: 4,
                  cursor: 'col-resize',
                  backgroundColor: alpha(theme.palette.divider, 0.5),
                  transition: isResizingMentions ? 'none' : 'background-color 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                  },
                  userSelect: 'none',
                  flex: 'none',
                }}
              />
            )}

            {/* Mentions List Panel - Dynamic width when showing mentions */}
            {showMessagesFullPage && selectedFeatureForMessages && (
              <Box sx={{ flex: `0 0 ${mentionsListWidth}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Card sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: { xs: 'auto', md: 'calc(100vh - 120px)' },
                }}>
                  <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, pb: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" fontWeight="bold" color="primary" sx={{ fontSize: '0.75rem' }}>
                          Mentions
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {featureMessages.length}
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
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>

                    {/* Messages List */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                        {loadingMessages ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : featureMessages.length === 0 ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <Typography variant="body2" color="text.secondary">No messages</Typography>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {featureMessages.map((message) => {
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
                                  onClick={() => setSelectedMessageId(message.id)}
                                  sx={{
                                    p: 0.75,
                                    borderRadius: 0.75,
                                    cursor: 'pointer',
                                    background: isSelected
                                      ? alpha(theme.palette.primary.main, 0.1)
                                      : 'transparent',
                                    border: isSelected
                                      ? `1px solid ${theme.palette.primary.main}`
                                      : `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                      background: alpha(theme.palette.primary.main, 0.06),
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                                    },
                                  }}
                                >
                                  <Typography variant="caption" fontWeight="bold" color="primary" noWrap display="block">
                                    {message.customer_name || message.sender_name || 'Unknown'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                                    {message.customer_email || message.sender_name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.25 }}>
                                    {formatDate(message.sent_at)}
                                  </Typography>
                                  {totalInsights > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap', mt: 0.4 }}>
                                      {insightCounts.features > 0 && (
                                        <Chip label={insightCounts.features} size="small" color="info" variant="filled" sx={{ height: 16 }} />
                                      )}
                                      {insightCounts.bugs > 0 && (
                                        <Chip label={insightCounts.bugs} size="small" color="error" variant="filled" sx={{ height: 16 }} />
                                      )}
                                      {insightCounts.painPoints > 0 && (
                                        <Chip label={insightCounts.painPoints} size="small" color="warning" variant="filled" sx={{ height: 16 }} />
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Draggable Divider - Between Mentions and Details */}
            {showMessagesFullPage && selectedFeatureForMessages && (
              <Box
                onMouseDown={() => setIsResizingMentions(true)}
                sx={{
                  width: 4,
                  cursor: 'col-resize',
                  backgroundColor: alpha(theme.palette.divider, 0.5),
                  transition: isResizingMentions ? 'none' : 'background-color 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                  },
                  userSelect: 'none',
                  flex: 'none',
                }}
              />
            )}

            {/* Message Details Panel - Remaining width when viewing mentions */}
            {showMessagesFullPage && selectedFeatureForMessages && selectedMessageId && (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <Card sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: { xs: 'auto', md: 'calc(100vh - 120px)' },
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <CardContent sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {(() => {
                      const selectedMessage = featureMessages.find(m => m.id === selectedMessageId);
                      if (!selectedMessage) return null;

                      return (
                        <Box sx={{ width: '100%' }}>
                          {/* Header */}
                          <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                            <Typography variant="body2" fontWeight="bold" color="primary" sx={{ mb: 0.5 }}>
                              {selectedMessage.customer_name || selectedMessage.sender_name || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {selectedMessage.customer_email || selectedMessage.sender_name}
                            </Typography>
                          </Box>

                          {selectedMessage.ai_insights ? (
                            <Box sx={{ width: '100%' }}>
                              {/* Feature Requests */}
                              {selectedMessage.ai_insights.feature_requests && selectedMessage.ai_insights.feature_requests.length > 0 && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Features:
                                  </Typography>
                                  {selectedMessage.ai_insights.feature_requests.map((feature, idx) => (
                                    <Box key={idx} mb={1.5} pl={1}>
                                      <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                                        {feature.title}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                                        {feature.description}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                                        "{feature.quote}"
                                      </Typography>
                                      <Box mt={0.5}>
                                        <Chip
                                          label={feature.urgency}
                                          size="small"
                                          color={feature.urgency === 'high' || feature.urgency === 'critical' ? 'error' : feature.urgency === 'medium' ? 'warning' : 'default'}
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Box>
                                    </Box>
                                  ))}
                                </Box>
                              )}

                              {/* Bug Reports */}
                              {selectedMessage.ai_insights.bug_reports && selectedMessage.ai_insights.bug_reports.length > 0 && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Bugs:
                                  </Typography>
                                  {selectedMessage.ai_insights.bug_reports.map((bug, idx) => (
                                    <Box key={idx} mb={1.5} pl={1}>
                                      <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                                        {bug.title}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.85rem' }}>
                                        {bug.description}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                                        "{bug.quote}"
                                      </Typography>
                                      <Box mt={0.5}>
                                        <Chip
                                          label={bug.severity}
                                          size="small"
                                          color={bug.severity === 'high' || bug.severity === 'critical' ? 'error' : bug.severity === 'medium' ? 'warning' : 'default'}
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Box>
                                    </Box>
                                  ))}
                                </Box>
                              )}

                              {/* Pain Points */}
                              {selectedMessage.ai_insights.pain_points && selectedMessage.ai_insights.pain_points.length > 0 && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Pain Points:
                                  </Typography>
                                  {selectedMessage.ai_insights.pain_points.map((pain, idx) => (
                                    <Box key={idx} mb={1.5} pl={1}>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                        {pain.description}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                        Impact: {pain.impact}
                                      </Typography>
                                      {pain.quote && (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
                                          "{pain.quote}"
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              )}

                              {/* Summary */}
                              {selectedMessage.ai_insights.summary && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Summary:
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" pl={1} sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                                    {selectedMessage.ai_insights.summary}
                                  </Typography>
                                </Box>
                              )}

                              {/* Sentiment */}
                              {selectedMessage.ai_insights.sentiment && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Sentiment:
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

                              {/* Key Topics */}
                              {selectedMessage.ai_insights.key_topics && selectedMessage.ai_insights.key_topics.length > 0 && (
                                <Box mb={2}>
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    Key Topics:
                                  </Typography>
                                  <Box pl={1} display="flex" gap={0.5} flexWrap="wrap">
                                    {selectedMessage.ai_insights.key_topics.map((topic, idx) => (
                                      <Chip key={idx} label={topic} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                    ))}
                                  </Box>
                                </Box>
                              )}

                              {/* Message Metadata */}
                              <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                width: '100%',
                                mt: 2,
                                pt: 2,
                                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                              }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                  {selectedMessage.sender_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
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
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Close Button for Mentions View - Only shown when viewing mentions but no message selected */}
            {showMessagesFullPage && selectedFeatureForMessages && !selectedMessageId && (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                <Card sx={{
                  borderRadius: 1,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Select a mention to view details
                  </Typography>
                </Card>
              </Box>
            )}
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
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingTheme ? 'Edit Theme' : 'Create New Theme'}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Theme Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                required
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
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<FeatureIcon />}
                  onClick={() => {
                    handleCloseDrawer();
                    window.location.href = `/app/features?theme=${selectedThemeForDrawer?.id}`;
                  }}
                  sx={{
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100())`,
                  }}
                >
                  View All Features in Feature Dashboard
                </Button>
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
      </Box>
    </AdminLayout>
  );
}