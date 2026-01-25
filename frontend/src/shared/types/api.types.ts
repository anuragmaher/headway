/**
 * Core API types for HeadwayHQ
 * Maps to backend schemas
 */

// === Base Types ===

export type UUID = string;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// === Connector Types ===

export type ConnectorType = 'slack' | 'gmail' | 'gong' | 'fathom' | 'intercom';

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed';

export interface ConnectorLabel {
  id: UUID;
  connector_id: UUID;
  label_id: string;
  label_name: string | null;
  is_enabled: boolean;
  created_at: string;
}

export interface Connector {
  id: UUID;
  workspace_id: UUID;
  user_id: UUID | null;
  connector_type: ConnectorType;
  name: string | null;
  external_id: string | null;
  external_name: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  last_synced_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
  updated_at: string | null;
  labels: ConnectorLabel[];
}

export interface ConnectorListResponse {
  connectors: Connector[];
  total: number;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  num_members: number | null;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messages_total: number | null;
  messages_unread: number | null;
}

// === Theme Hierarchy Types ===

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type CustomerAskStatus = 'new' | 'under_review' | 'planned' | 'shipped';

export interface CustomerAsk {
  id: UUID;
  name: string;
  description: string | null;
  sub_theme_id: UUID;
  workspace_id: UUID;
  urgency: UrgencyLevel;
  status: CustomerAskStatus;
  match_confidence: number | null;
  mention_count: number;
  first_mentioned_at: string | null;
  last_mentioned_at: string | null;
  created_at: string;
  updated_at: string | null;
  message_count: number;
}

export interface CustomerAskCreate {
  name: string;
  description?: string;
  sub_theme_id: UUID;
  urgency?: UrgencyLevel;
  status?: CustomerAskStatus;
}

export interface CustomerAskUpdate {
  name?: string;
  description?: string;
  urgency?: UrgencyLevel;
  status?: CustomerAskStatus;
  sub_theme_id?: UUID;
}

export interface SubTheme {
  id: UUID;
  name: string;
  description: string | null;
  sort_order: number;
  theme_id: UUID;
  workspace_id: UUID;
  created_at: string;
  updated_at: string | null;
  customer_ask_count: number;
}

export interface SubThemeCreate {
  name: string;
  description?: string;
  sort_order?: number;
  theme_id: UUID;
}

export interface SubThemeUpdate {
  name?: string;
  description?: string;
  sort_order?: number;
}

export interface SubThemeWithCustomerAsks extends SubTheme {
  customer_asks: CustomerAsk[];
}

export interface Theme {
  id: UUID;
  name: string;
  description: string | null;
  sort_order: number;
  workspace_id: UUID;
  created_at: string;
  updated_at: string | null;
  sub_theme_count: number;
  customer_ask_count: number;
}

export interface ThemeCreate {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface ThemeUpdate {
  name?: string;
  description?: string;
  sort_order?: number;
}

export interface ThemeWithSubThemes extends Theme {
  sub_themes: SubTheme[];
}

export interface ThemeHierarchy extends Theme {
  sub_themes: SubThemeWithCustomerAsks[];
}

export interface ThemeListResponse {
  themes: Theme[];
  total: number;
}

export interface SubThemeListResponse {
  sub_themes: SubTheme[];
  total: number;
}

export interface CustomerAskListResponse {
  customer_asks: CustomerAsk[];
  total: number;
}

// === Transcript Classification Types ===

export interface TranscriptClassification {
  id: UUID;
  workspace_id: UUID;
  source_type: string;
  source_id: string;
  source_title: string | null;
  theme_id: UUID | null;
  sub_theme_id: UUID | null;
  theme_ids: UUID[] | null;  // Array of all theme IDs from mappings (for fast filtering)
  sub_theme_ids: UUID[] | null;  // Array of all sub-theme IDs from mappings (for fast filtering)
  extracted_data: Record<string, unknown>;
  raw_ai_response: Record<string, unknown> | null;
  processing_status: string;
  error_message: string | null;
  confidence_score: string | null;
  transcript_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TranscriptClassificationListResponse {
  transcript_classifications: TranscriptClassification[];
  total: number;
}

// === Message Types ===

export type SourceType = 'slack' | 'gmail' | 'gong' | 'fathom' | 'intercom';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'frustrated';

export interface Message {
  id: UUID;
  workspace_id: UUID;
  connector_id: UUID;
  customer_ask_id: UUID | null;
  customer_id: UUID | null;
  source: SourceType;
  external_id: string;
  thread_id: string | null;
  content: string;
  title: string | null;
  channel_name: string | null;
  channel_id: string | null;
  label_name: string | null;
  author_name: string | null;
  author_email: string | null;
  author_id: string | null;
  from_email: string | null;
  to_emails: string | null;
  message_count: number;
  message_metadata: Record<string, unknown> | null;
  is_processed: boolean;
  processed_at: string | null;
  feature_score: number | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  page_size: number;
}

export interface AIInsight {
  id: UUID;
  message_id: UUID;
  workspace_id: UUID;
  theme_id: UUID | null;
  sub_theme_id: UUID | null;
  customer_ask_id: UUID | null;
  model_version: string | null;
  summary: string | null;
  pain_point: string | null;
  pain_point_quote: string | null;
  feature_request: string | null;
  customer_usecase: string | null;
  sentiment: SentimentType | null;
  keywords: string[] | null;
  tokens_used: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface MessageWithInsights extends Message {
  ai_insights: AIInsight | null;
  customer_ask: CustomerAskSummary | null;
}

export interface CustomerAskSummary {
  id: UUID;
  name: string;
  urgency: string;
  status: string;
}

export interface AIInsightListResponse {
  insights: AIInsight[];
  total: number;
}

// === Sync History Types ===

export type SyncType = 'source' | 'theme';
export type SyncStatusType = 'pending' | 'in_progress' | 'success' | 'failed';
export type TriggerType = 'manual' | 'periodic';

export interface SyncHistoryItem {
  id: UUID;
  workspace_id: UUID;
  sync_type: SyncType;
  source_type: string | null;
  source_name: string | null;
  connector_id: UUID | null;
  theme_id: UUID | null;
  theme_name: string | null;
  status: SyncStatusType;
  error_message: string | null;
  trigger_type: TriggerType;
  items_processed: number;
  items_new: number;
  items_updated: number;
  started_at: string;
  completed_at: string | null;
}

export interface SyncHistoryListResponse {
  history: SyncHistoryItem[];
  total: number;
}

// === User & Workspace Types ===

export interface User {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  company_id: UUID | null;
  workspace_id: UUID | null;
  subscription_plan: string;
  role: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
}

export interface Workspace {
  id: UUID;
  name: string;
  is_active: boolean;
  company_id: UUID | null;
  created_at: string;
  updated_at: string | null;
}

export interface Company {
  id: UUID;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  created_at: string;
  updated_at: string | null;
}

// === Customer & Competitor Types ===

export interface Customer {
  id: UUID;
  workspace_id: UUID;
  name: string;
  email: string | null;
  company_name: string | null;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface Competitor {
  id: UUID;
  workspace_id: UUID;
  name: string;
  website: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

// === Onboarding Types ===

export interface OnboardingProgress {
  id: UUID;
  workspace_id: UUID;
  current_step: number;
  created_at: string;
  updated_at: string | null;
}

// === Message Stats ===

export interface MessageStats {
  total: number;
  processed: number;
  unprocessed: number;
  by_source: Record<string, number>;
}

// === Mention Types (Messages linked to CustomerAsks with AI insights) ===

export interface MentionAIInsight {
  id: UUID;
  message_id: UUID;
  model_version: string | null;
  summary: string | null;
  pain_point: string | null;
  pain_point_quote: string | null;
  feature_request: string | null;
  customer_usecase: string | null;
  sentiment: SentimentType | null;
  keywords: string[] | null;
  tokens_used: number | null;
  created_at: string;
}

/**
 * Minimal CustomerAsk info for UI display in mentions
 * Used when a message is linked to multiple CustomerAsks
 */
export interface LinkedCustomerAskAPI {
  id: UUID;
  name: string;
  sub_theme_id: UUID | null;
  sub_theme_name: string | null;
  theme_id: UUID | null;
  theme_name: string | null;
}

/**
 * Mention - A message linked to CustomerAsk(s) with AI insights
 *
 * Supports many-to-many: one message can link to multiple CustomerAsks
 * - customer_ask_id: The current/context CustomerAsk (the one whose mentions we're viewing)
 * - customer_ask_ids: ALL CustomerAsk IDs this message is linked to
 * - linked_customer_asks: Other CustomerAsks for UI navigation
 */
export interface Mention {
  id: UUID;
  customer_ask_id: UUID | null;  // Current context
  customer_ask_ids: UUID[];  // NEW: All linked CustomerAsk IDs
  linked_customer_asks: LinkedCustomerAskAPI[];  // NEW: Other CustomerAsks for UI
  workspace_id: UUID;
  source: SourceType;
  external_id: string;
  thread_id: string | null;
  content: string;
  title: string | null;
  channel_name: string | null;
  label_name: string | null;
  author_name: string | null;
  author_email: string | null;
  from_email: string | null;
  to_emails: string | null;
  message_count: number;
  sent_at: string | null;
  is_processed: boolean;
  ai_insights: MentionAIInsight | null;
}

export interface MentionListResponse {
  mentions: Mention[];
  total: number;
  has_more: boolean;
  next_cursor: string | null;
}
