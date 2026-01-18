/**
 * React Query Client Configuration
 *
 * Optimized for fast data loading with smart caching:
 * - Short stale time for frequently changing data
 * - Longer cache time to avoid refetching
 * - Background refetching for seamless updates
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache data for 5 minutes even if stale
      cacheTime: 5 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Refetch when window regains focus (if stale)
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
      // Refetch in background when reconnecting
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

export default queryClient;
