/**
 * TranscriptClassification Slice - Manages transcript classifications data
 *
 * This slice handles:
 * - Fetching TranscriptClassifications for a selected SubTheme
 * - Managing the transcript classifications panel state
 */
import { StateCreator } from 'zustand';
import type { ExplorerStore } from '../explorerStore';
import { themesApi } from '../../../../services/themes.api';
import type { TranscriptClassification } from '../../../../shared/types/api.types';

export interface TranscriptClassificationItem {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string | null;
  themeId: string | null;
  subThemeId: string | null;
  themeIds: string[] | null;  // Array of all theme IDs from mappings
  subThemeIds: string[] | null;  // Array of all sub-theme IDs from mappings
  extractedData: Record<string, unknown>;
  rawAiResponse: Record<string, unknown> | null;
  processingStatus: string;
  errorMessage: string | null;
  confidenceScore: string | null;
  transcriptDate: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TranscriptClassificationState {
  // TranscriptClassifications state
  transcriptClassifications: TranscriptClassificationItem[];
  totalTranscriptClassifications: number;
  isLoadingTranscriptClassifications: boolean;
  transcriptClassificationsError: string | null;
  currentSubThemeIdForClassifications: string | null;

  // Transcript counts (fetched once, shared across all components)
  transcriptCounts: {
    themeCounts: Record<string, number>;
    subThemeCounts: Record<string, number>;
  };
  isLoadingTranscriptCounts: boolean;

  // Selected TranscriptClassification
  selectedTranscriptClassificationId: string | null;
}

export interface TranscriptClassificationActions {
  // TranscriptClassification actions
  fetchTranscriptCounts: () => Promise<void>;  // Fetch counts once (lightweight)
  fetchTranscriptClassifications: (subThemeId: string, themeId?: string) => Promise<void>;  // Fetch transcripts when sub-theme clicked
  selectTranscriptClassification: (classificationId: string | null) => void;
  clearTranscriptClassifications: () => void;
  clearTranscriptClassificationsError: () => void;
}

export type TranscriptClassificationSlice = TranscriptClassificationState & TranscriptClassificationActions;

const initialTranscriptClassificationState: TranscriptClassificationState = {
  transcriptClassifications: [],
  totalTranscriptClassifications: 0,
  isLoadingTranscriptClassifications: false,
  transcriptClassificationsError: null,
  currentSubThemeIdForClassifications: null,
  transcriptCounts: {
    themeCounts: {},
    subThemeCounts: {},
  },
  isLoadingTranscriptCounts: false,
  selectedTranscriptClassificationId: null,
};

export const createTranscriptClassificationSlice: StateCreator<
  ExplorerStore,
  [],
  [],
  TranscriptClassificationSlice
> = (set, get) => ({
  ...initialTranscriptClassificationState,

  // Fetch transcript counts once (lightweight, shared across all components)
  fetchTranscriptCounts: async () => {
    // If already loaded, skip
    const currentCounts = get().transcriptCounts;
    if (Object.keys(currentCounts.themeCounts).length > 0 || Object.keys(currentCounts.subThemeCounts).length > 0) {
      if (!get().isLoadingTranscriptCounts) {
        console.log('[Explorer] Transcript counts already loaded, skipping fetch');
        return;
      }
    }

    set({ isLoadingTranscriptCounts: true });

    try {
      console.log('[Explorer] Fetching transcript counts (single call)');
      const response = await themesApi.getTranscriptClassificationCounts();

      set({
        transcriptCounts: {
          themeCounts: response.theme_counts || {},
          subThemeCounts: response.sub_theme_counts || {},
        },
        isLoadingTranscriptCounts: false,
      });

      console.log('[Explorer] Loaded transcript counts:', {
        themes: Object.keys(response.theme_counts || {}).length,
        subThemes: Object.keys(response.sub_theme_counts || {}).length,
      });
    } catch (error) {
      console.error('[Explorer] Failed to fetch transcript counts:', error);
      set({ 
        isLoadingTranscriptCounts: false 
      });
    }
  },

  // Fetch transcript classifications for a sub-theme (fetches from API when clicked)
  fetchTranscriptClassifications: async (subThemeId: string, themeId?: string) => {
    set({
      isLoadingTranscriptClassifications: true,
      transcriptClassificationsError: null,
      currentSubThemeIdForClassifications: subThemeId,
    });

    try {
      // Fetch from API (not from cache) - only fetch when sub-theme is clicked
      console.log('[Explorer] Fetching transcript classifications for sub-theme:', subThemeId);
      const response = await themesApi.listTranscriptClassifications(
        themeId,
        subThemeId
      );

      const transcriptClassifications: TranscriptClassificationItem[] = response.transcript_classifications.map((tc) => ({
        id: tc.id,
        workspaceId: tc.workspace_id,
        sourceType: tc.source_type,
        sourceId: tc.source_id,
        sourceTitle: tc.source_title,
        themeId: tc.theme_id,
        subThemeId: tc.sub_theme_id,
        themeIds: tc.theme_ids || null,
        subThemeIds: tc.sub_theme_ids || null,
        extractedData: tc.extracted_data,
        rawAiResponse: tc.raw_ai_response,
        processingStatus: tc.processing_status,
        errorMessage: tc.error_message,
        confidenceScore: tc.confidence_score,
        transcriptDate: tc.transcript_date,
        createdAt: tc.created_at,
        updatedAt: tc.updated_at,
      }));

      console.log('[Explorer] Received', transcriptClassifications.length, 'transcript classifications for sub-theme:', subThemeId);

      set({
        transcriptClassifications,
        totalTranscriptClassifications: response.total,
        isLoadingTranscriptClassifications: false,
      });
    } catch (error) {
      console.error('[Explorer] Failed to fetch transcript classifications:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch transcript classifications';
      set({ transcriptClassificationsError: message, isLoadingTranscriptClassifications: false });
    }
  },

  // Select a transcript classification
  selectTranscriptClassification: (classificationId: string | null) => {
    set({ selectedTranscriptClassificationId: classificationId });
  },

  // Clear transcript classifications (but keep allTranscriptClassifications cache)
  clearTranscriptClassifications: () => {
    set({
      transcriptClassifications: [],
      totalTranscriptClassifications: 0,
      currentSubThemeIdForClassifications: null,
      selectedTranscriptClassificationId: null,
    });
  },

  // Clear error
  clearTranscriptClassificationsError: () => {
    set({ transcriptClassificationsError: null });
  },
});
