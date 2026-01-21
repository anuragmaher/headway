/**
 * Hook for taxonomy generation (synchronous API call)
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '../store/onboardingStore';
import { onboardingApi } from '../services/onboarding-api';
import type { Theme } from '../types';

interface UseTaxonomyGenerationReturn {
  generate: (url: string) => Promise<void>;
  isGenerating: boolean;
  isCompleted: boolean;
  hasFailed: boolean;
  error: string | null;
  themes: Theme[];
}

export function useTaxonomyGeneration(): UseTaxonomyGenerationReturn {
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = tokens?.workspace_id;

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    setTaxonomyUrl,
    setTaxonomyThemes,
    setTaxonomyStatus,
  } = useOnboardingStore();

  const themes = useOnboardingStore((state) => state.taxonomyData.themes);
  const status = useOnboardingStore((state) => state.taxonomyStatus);

  const generate = useCallback(
    async (url: string) => {
      if (!workspaceId) {
        setError('Workspace not found');
        return;
      }

      setIsGenerating(true);
      setError(null);
      setTaxonomyUrl(url);
      setTaxonomyStatus('processing');
      setTaxonomyThemes([]);

      try {
        const response = await onboardingApi.generateTaxonomy(workspaceId, url);

        setTaxonomyThemes(response.themes);
        setTaxonomyStatus('completed');
      } catch (err) {
        console.error('Error generating taxonomy:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate taxonomy';
        setError(errorMessage);
        setTaxonomyStatus('failed');
      } finally {
        setIsGenerating(false);
      }
    },
    [workspaceId, setTaxonomyUrl, setTaxonomyThemes, setTaxonomyStatus]
  );

  return {
    generate,
    isGenerating,
    isCompleted: status === 'completed' && themes.length > 0,
    hasFailed: status === 'failed',
    error,
    themes,
  };
}
