/**
 * Hook to get transcript classification counts for themes and sub-themes
 * Uses cached counts from the store (fetched once on initial load)
 */
import { useExplorerStore } from '../store/explorerStore';

interface TranscriptCounts {
  themeCounts: Record<string, number>;
  subThemeCounts: Record<string, number>;
  isLoading: boolean;
}

export const useTranscriptCounts = (): TranscriptCounts => {
  // Use cached counts from store (fetched once, shared across all components)
  const transcriptCounts = useExplorerStore((state) => state.transcriptCounts);
  const isLoadingTranscriptCounts = useExplorerStore((state) => state.isLoadingTranscriptCounts);

  return {
    themeCounts: transcriptCounts.themeCounts || {},
    subThemeCounts: transcriptCounts.subThemeCounts || {},
    isLoading: isLoadingTranscriptCounts,
  };
};
