/**
 * Types specific to ThemesPage components
 */

import { ThemeData, ThemeFormData, ThemeHierarchy } from '@/shared/types/theme.types';
import { ThemeSuggestion, FeatureSuggestion } from '@/services/theme';

// Re-export for convenience
export type { ThemeData, ThemeFormData, ThemeHierarchy, ThemeSuggestion, FeatureSuggestion };

export type Theme = ThemeData;

export interface Feature {
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
  data_points?: DataPoint[];
  ai_metadata?: FeatureAIMetadata;
}

export interface DataPoint {
  author?: string;
  timestamp?: string;
  customer_name?: string;
  customer_email?: string;
  sender_name?: string;
  business_metrics?: Record<string, any>;
  entities?: Record<string, any>;
  structured_metrics?: Record<string, any>;
  ai_insights?: AIInsights;
}

export interface FeatureAIMetadata {
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
}

export interface AIInsights {
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

export interface Message {
  id: string;
  title?: string;
  content: string;
  sent_at: string;
  sender_name: string;
  channel_name: string;
  customer_name: string | null;
  customer_email: string | null;
  ai_insights: AIInsights | null;
  source?: string;
  external_id?: string;
  message_metadata?: Record<string, any>;
  metadata?: {
    [key: string]: any;
    call_id?: string;
    recording_url?: string;
    session_id?: string;
    share_url?: string;
  };
}

export interface ThemeWithChildren extends Theme {
  children: ThemeWithChildren[];
}

export type MentionDetailsTab = 'summary' | 'features' | 'bugs' | 'pain-points' | 'highlights' | '';
export type DrawerLevel = 'mentions' | 'details';

// Filter and sort types
export interface FeatureFilters {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filterStatus: string;
  filterUrgency: string;
  filterMrrMin: string;
  filterMrrMax: string;
  searchQuery: string;
}
