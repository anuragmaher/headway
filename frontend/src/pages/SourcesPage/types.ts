/**
 * Types for the Sources/Data Sync page
 */

export type SourceType = 'all' | 'gmail' | 'outlook' | 'gong' | 'fathom' | 'slack';

export type MessageType = 'email' | 'transcript' | 'meeting' | 'slack';

export type SyncType = 'all' | 'source' | 'theme';

export type SyncStatus = 'pending' | 'in_progress' | 'success' | 'failed';

export interface Message {
  id: string;
  title: string;
  sender: string;
  sourceType: MessageType;
  preview: string;
  timestamp: string;
  source: SourceType;
}

export interface SyncHistoryItem {
  id: string;
  type: 'source' | 'theme';
  name: string;
  sourceType?: SourceType;
  sourceIcons?: SourceType[];
  status: SyncStatus;
  startedAt: string;
  processed: number;
  newItems: number;
  errorMessage?: string | null;
}
