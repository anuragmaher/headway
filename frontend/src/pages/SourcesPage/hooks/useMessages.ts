/**
 * useMessages Hook - React Query powered message fetching with caching
 *
 * Features:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates support
 * - Prefetching for next page
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import sourcesService, {
  MessageListResponse,
  MessageSortField,
  SortOrder,
} from '@/services/sources';

interface UseMessagesParams {
  workspaceId: string | undefined;
  page: number;
  pageSize: number;
  source?: string;
  sortBy: MessageSortField;
  sortOrder: SortOrder;
  enabled?: boolean;
}

interface UseMessagesResult {
  messages: MessageListResponse['messages'];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

// Query key factory for consistent key generation
const messagesKeys = {
  all: ['messages'] as const,
  lists: () => [...messagesKeys.all, 'list'] as const,
  list: (params: Omit<UseMessagesParams, 'enabled'>) =>
    [
      ...messagesKeys.lists(),
      params.workspaceId,
      params.page,
      params.pageSize,
      params.source,
      params.sortBy,
      params.sortOrder,
    ] as const,
};

export function useMessages({
  workspaceId,
  page,
  pageSize,
  source,
  sortBy,
  sortOrder,
  enabled = true,
}: UseMessagesParams): UseMessagesResult {
  const queryClient = useQueryClient();

  const queryKey = messagesKeys.list({
    workspaceId,
    page,
    pageSize,
    source,
    sortBy,
    sortOrder,
  });

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');

      return sourcesService.getMessages(
        workspaceId,
        page,
        pageSize,
        source !== 'all' ? source : undefined,
        sortBy,
        sortOrder
      );
    },
    enabled: enabled && !!workspaceId,
    // Keep previous data while fetching new page (smooth pagination)
    keepPreviousData: true,
    // Shorter stale time for messages (they update frequently)
    staleTime: 15 * 1000, // 15 seconds
  });

  // Prefetch next page for faster navigation
  const prefetchNextPage = useCallback(() => {
    if (!workspaceId || !data?.has_next) return;

    const nextPageKey = messagesKeys.list({
      workspaceId,
      page: page + 1,
      pageSize,
      source,
      sortBy,
      sortOrder,
    });

    queryClient.prefetchQuery({
      queryKey: nextPageKey,
      queryFn: () =>
        sourcesService.getMessages(
          workspaceId,
          page + 1,
          pageSize,
          source !== 'all' ? source : undefined,
          sortBy,
          sortOrder
        ),
      staleTime: 15 * 1000,
    });
  }, [workspaceId, data?.has_next, page, pageSize, source, sortBy, sortOrder, queryClient]);

  // Prefetch next page when current data loads
  useEffect(() => {
    if (data?.has_next) {
      prefetchNextPage();
    }
  }, [data?.has_next, prefetchNextPage]);

  return {
    messages: data?.messages ?? [],
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 1,
    hasNext: data?.has_next ?? false,
    hasPrev: data?.has_prev ?? false,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    isFetching,
  };
}

// Hook to invalidate messages cache (useful after sync)
export function useInvalidateMessages() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: messagesKeys.all });
  }, [queryClient]);
}

export default useMessages;
