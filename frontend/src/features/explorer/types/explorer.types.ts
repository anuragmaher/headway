/**
 * Theme Explorer Type Definitions
 * Enterprise-grade type system for the three-column explorer interface
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export interface ExplorerTheme {
  id: string;
  name: string;
  description: string;
  color: string;
  feedbackCount: number;
  subThemeCount: number;
  isAIGenerated: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExplorerSubTheme {
  id: string;
  themeId: string;
  name: string;
  description: string;
  feedbackCount: number;
  isAIGenerated: boolean;
  isLocked: boolean;
  topFeedbackPreview?: string;
  createdAt: string;
  updatedAt: string;
  urgency?: string;
  status?: string;
}

export type FeedbackSource = 'slack' | 'gmail' | 'gong' | 'fathom' | 'intercom' | 'zendesk' | 'manual';

export type FeedbackTag = 'FR' | 'Bug' | 'UX' | 'Integration' | 'Performance' | 'Security' | 'Pricing' | 'Support';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FeedbackItem {
  id: string;
  themeId: string;
  subThemeId: string;

  // AI-generated content
  title: string;
  summary: string;

  // Source information
  source: FeedbackSource;
  sourceChannel?: string;
  sourceMessageId?: string;

  // Contact information
  contactName: string;
  contactEmail?: string;
  contactCompany?: string;

  // Classification
  tags: FeedbackTag[];
  urgency: UrgencyLevel;
  sentiment?: 'positive' | 'neutral' | 'negative';

  // Metadata
  originalContent: string;
  mentionCount: number;
  matchConfidence: number;

  // Timestamps
  receivedAt: string;
  processedAt: string;

  // AI insights
  aiInsights?: FeedbackAIInsights;
}

export interface FeedbackAIInsights {
  keyPoints: string[];
  suggestedActions?: string[];
  relatedFeatures?: string[];
  customerContext?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ExplorerFilters {
  sources: FeedbackSource[];
  tags: FeedbackTag[];
  urgency: UrgencyLevel[];
  dateRange: DateRange | null;
  searchQuery: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export type SortOption = 'recent' | 'oldest' | 'mentions' | 'urgency' | 'confidence';

export interface ExplorerViewState {
  selectedThemeId: string | null;
  selectedSubThemeId: string | null;
  selectedFeedbackId: string | null;
  expandedFeedbackId: string | null;
  activeColumn: 'themes' | 'subThemes' | 'feedback';
}

export interface ExplorerUIState {
  isSearchOpen: boolean;
  isFilterPanelOpen: boolean;
  isDetailPanelOpen: boolean;
  isAddThemeDialogOpen: boolean;
  isAddSubThemeDialogOpen: boolean;
  isEditThemeDialogOpen: boolean;
  isEditSubThemeDialogOpen: boolean;
  isMergeDialogOpen: boolean;
}

// ============================================================================
// Loading & Error States
// ============================================================================

export interface ExplorerLoadingState {
  themes: boolean;
  subThemes: boolean;
  feedback: boolean;
  feedbackDetail: boolean;
  action: boolean;
}

export interface ExplorerError {
  code: string;
  message: string;
  field?: string;
}

// ============================================================================
// Action Types
// ============================================================================

export interface CreateThemeInput {
  name: string;
  description: string;
  color?: string;
}

export interface UpdateThemeInput {
  name?: string;
  description?: string;
  color?: string;
  isLocked?: boolean;
}

export interface CreateSubThemeInput {
  themeId: string;
  name: string;
  description: string;
}

export interface UpdateSubThemeInput {
  name?: string;
  description?: string;
  isLocked?: boolean;
}

export interface MergeSubThemesInput {
  sourceId: string;
  targetId: string;
}

export interface MoveFeedbackInput {
  feedbackId: string;
  newSubThemeId: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ThemesResponse {
  themes: ExplorerTheme[];
  total: number;
}

export interface SubThemesResponse {
  subThemes: ExplorerSubTheme[];
  total: number;
}

export interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface ThemeItemProps {
  theme: ExplorerTheme;
  isSelected: boolean;
  onSelect: (themeId: string) => void;
  onEdit?: (themeId: string) => void;
  onDelete?: (themeId: string) => void;
}

export interface SubThemeItemProps {
  subTheme: ExplorerSubTheme;
  isSelected: boolean;
  onSelect: (subThemeId: string) => void;
  onEdit?: (subThemeId: string) => void;
  onMerge?: (subThemeId: string) => void;
  onLock?: (subThemeId: string) => void;
}

export interface FeedbackCardProps {
  feedback: FeedbackItem;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (feedbackId: string) => void;
  onExpand: (feedbackId: string) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ColumnType = 'themes' | 'subThemes' | 'feedback';

export interface ColumnConfig {
  type: ColumnType;
  width: number | string;
  minWidth: number;
  maxWidth?: number;
  resizable: boolean;
}

export const DEFAULT_COLUMN_CONFIGS: Record<ColumnType, ColumnConfig> = {
  themes: {
    type: 'themes',
    width: 200,
    minWidth: 180,
    maxWidth: 280,
    resizable: true,
  },
  subThemes: {
    type: 'subThemes',
    width: 240,
    minWidth: 200,
    maxWidth: 320,
    resizable: true,
  },
  feedback: {
    type: 'feedback',
    width: 'flex',
    minWidth: 400,
    resizable: false,
  },
};

// ============================================================================
// Constants
// ============================================================================

export const SOURCE_COLORS: Record<FeedbackSource, string> = {
  slack: '#4A154B',
  gmail: '#EA4335',
  gong: '#7C5CFF',
  fathom: '#00D1FF',
  intercom: '#1F8CEB',
  zendesk: '#03363D',
  manual: '#666666',
};

export const TAG_STYLES: Record<FeedbackTag, { bg: string; text: string }> = {
  FR: { bg: '#E3F2FD', text: '#1565C0' },
  Bug: { bg: '#FFEBEE', text: '#C62828' },
  UX: { bg: '#F3E5F5', text: '#6A1B9A' },
  Integration: { bg: '#E0F2F1', text: '#00695C' },
  Performance: { bg: '#FFF3E0', text: '#E65100' },
  Security: { bg: '#ECEFF1', text: '#455A64' },
  Pricing: { bg: '#FFF8E1', text: '#F57F17' },
  Support: { bg: '#E8F5E9', text: '#2E7D32' },
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#4CAF50',
};

export const DEFAULT_FILTERS: ExplorerFilters = {
  sources: [],
  tags: [],
  urgency: [],
  dateRange: null,
  searchQuery: '',
};
