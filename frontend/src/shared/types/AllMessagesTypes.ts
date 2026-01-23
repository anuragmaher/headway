/**
 * Types for the Sources/Data Sync page
 */

export type SourceType = 'all' | 'gmail' | 'gong' | 'fathom' | 'slack';

export type MessageType = 'email' | 'transcript' | 'meeting' | 'slack';

export type SyncType = 'all' | 'source' | 'theme';

export type SyncStatus = 'pending' | 'in_progress' | 'success' | 'failed';

/** How the sync was triggered */
export type TriggerType = 'manual' | 'periodic';

export interface MessageAIInsight {
  id: string;
  summary: string | null;
  pain_point: string | null;
  pain_point_quote: string | null;
  feature_request: string | null;
  customer_usecase: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  keywords: string[];
  model_version: string | null;
  tokens_used: number | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  title: string;
  sender: string;
  sourceType: MessageType;
  preview: string;
  timestamp: string;
  source: SourceType;
  ai_insights?: MessageAIInsight | null;  // Included when fetching with insights
}

export interface SyncHistoryItem {
  id: string;
  type: 'source' | 'theme';
  name: string;
  sourceType?: SourceType;
  sourceIcons?: SourceType[];
  status: SyncStatus;
  triggerType: TriggerType;
  startedAt: string;
  processed: number;
  newItems: number;
  errorMessage?: string | null;
}
