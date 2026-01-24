/**
 * Theme Explorer Type Definitions
 * Enterprise-grade type system for the three-column explorer interface
 *
 * Hierarchy: Theme → SubTheme → CustomerAsk → Mentions (Messages)
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
  customerAskCount: number;
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
  customerAskCount: number;
  feedbackCount: number;
  isAIGenerated: boolean;
  isLocked: boolean;
  topFeedbackPreview?: string;
  createdAt: string;
  updatedAt: string;
  urgency?: string;
  status?: string;
  sources?: FeedbackSource[];  // Sources of customer asks (slack, gmail, gong, fathom, etc.)
}

/**
 * CustomerAsk - Represents a feature request/ask from customers
 * These are grouped under SubThemes and link to multiple Mentions
 */
export interface CustomerAskItem {
  id: string;
  subThemeId: string;
  workspaceId: string;
  name: string;
  description: string;
  urgency: UrgencyLevel;
  status: CustomerAskStatus;
  matchConfidence: number;
  mentionCount: number;
  firstMentionedAt: string | null;
  lastMentionedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type CustomerAskStatus = 'new' | 'under_review' | 'planned' | 'shipped';

/**
 * LinkedCustomerAsk - Minimal CustomerAsk info for UI display
 * Used in MentionItem to show other CustomerAsks this message is linked to
 */
export interface LinkedCustomerAsk {
  id: string;
  name: string;
  subThemeId: string | null;
  subThemeName: string | null;
  themeId: string | null;
  themeName: string | null;
}

/**
 * Mention - A message that mentions/relates to a CustomerAsk
 * Contains the original message content and AI insights
 *
 * Supports many-to-many: one message can link to multiple CustomerAsks
 * - customerAskId: The current/context CustomerAsk (the one whose mentions we're viewing)
 * - customerAskIds: ALL CustomerAsk IDs this message is linked to
 * - linkedCustomerAsks: Full info for UI display (names, sub_theme names)
 */
export interface MentionItem {
  id: string;
  customerAskId: string | null;  // Current context CustomerAsk
  customerAskIds: string[];  // ALL linked CustomerAsk IDs
  linkedCustomerAsks: LinkedCustomerAsk[];  // Other CustomerAsks for UI navigation
  workspaceId: string;
  source: FeedbackSource;
  externalId: string;
  threadId: string | null;
  content: string;
  title: string | null;
  channelName: string | null;
  labelName: string | null;
  authorName: string | null;
  authorEmail: string | null;
  fromEmail: string | null;
  toEmails: string | null;
  messageCount: number;
  sentAt: string | null;
  isProcessed: boolean;
  aiInsights: MentionAIInsights | null;
}

/**
 * AI Insights for a mention/message
 */
export interface MentionAIInsights {
  id: string;
  messageId: string;
  modelVersion: string | null;
  summary: string | null;
  painPoint: string | null;
  painPointQuote: string | null;
  featureRequest: string | null;
  customerUsecase: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  keywords: string[];
  tokensUsed: number | null;
  createdAt: string;
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
  status: CustomerAskStatus[];
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
  selectedCustomerAskId: string | null;
  selectedFeedbackId: string | null;
  expandedFeedbackId: string | null;
  expandedMentionId: string | null;
  activeColumn: 'themes' | 'subThemes' | 'customerAsks';
  isMentionsPanelOpen: boolean;
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
  customerAsks: boolean;
  mentions: boolean;
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

export interface CustomerAsksResponse {
  customerAsks: CustomerAskItem[];
  total: number;
}

export interface MentionsResponse {
  mentions: MentionItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
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

export interface CustomerAskCardProps {
  customerAsk: CustomerAskItem;
  isSelected: boolean;
  onSelect: (customerAskId: string) => void;
  onStatusChange?: (customerAskId: string, status: CustomerAskStatus) => void;
}

export interface MentionCardProps {
  mention: MentionItem;
  isExpanded: boolean;
  onToggleExpand: (mentionId: string) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ColumnType = 'themes' | 'subThemes' | 'customerAsks' | 'mentions';

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
  customerAsks: {
    type: 'customerAsks',
    width: 'flex',
    minWidth: 400,
    resizable: false,
  },
  mentions: {
    type: 'mentions',
    width: 420,
    minWidth: 350,
    maxWidth: 500,
    resizable: true,
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
  status: [],
  dateRange: null,
  searchQuery: '',
};

export const CUSTOMER_ASK_STATUS_LABELS: Record<CustomerAskStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  planned: 'Planned',
  shipped: 'Shipped',
};

export const CUSTOMER_ASK_STATUS_COLORS: Record<CustomerAskStatus, string> = {
  new: '#2196F3',
  under_review: '#FF9800',
  planned: '#9C27B0',
  shipped: '#4CAF50',
};
