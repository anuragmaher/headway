/**
 * Custom hook for intelligent sync history polling
 * Automatically detects new syncs and triggers refresh
 */

import { useEffect, useRef, useCallback } from 'react';
import sourcesService from '@/services/sources';

interface UseSyncHistoryPollingOptions {
  workspaceId: string | undefined;
  enabled: boolean;
  onNewSync?: () => void;
  pollingInterval?: number;
}

interface SyncHistoryPollingState {
  lastSyncId: string | null;
  lastCheckedAt: Date | null;
}

/**
 * Hook that polls for new syncs and triggers callbacks when detected
 */
export function useSyncHistoryPolling({
  workspaceId,
  enabled,
  onNewSync,
  pollingInterval = 30000, // 30 seconds default
}: UseSyncHistoryPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<SyncHistoryPollingState>({
    lastSyncId: null,
    lastCheckedAt: null,
  });

  const checkForNewSyncs = useCallback(async () => {
    if (!workspaceId) return;

    try {
      // Fetch the latest sync history item (page 1, size 1)
      const response = await sourcesService.getSyncHistory(
        workspaceId,
        1,
        1
      );

      if (response.items.length > 0) {
        const latestSync = response.items[0];
        const previousSyncId = stateRef.current.lastSyncId;

        // Update the last checked state
        stateRef.current = {
          lastSyncId: latestSync.id,
          lastCheckedAt: new Date(),
        };

        // If we have a previous sync ID and it's different, we found a new sync
        if (previousSyncId && previousSyncId !== latestSync.id) {
          console.log('[SyncPolling] New sync detected:', latestSync.id);
          onNewSync?.();
        } else if (!previousSyncId) {
          // First check, just store the ID
          console.log('[SyncPolling] Initial sync ID stored:', latestSync.id);
        }
      }
    } catch (error) {
      console.error('[SyncPolling] Error checking for new syncs:', error);
      // Don't throw - silently fail and retry on next interval
    }
  }, [workspaceId, onNewSync]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled || !workspaceId) {
      return;
    }

    // Initial check
    checkForNewSyncs();

    // Set up polling interval
    intervalRef.current = setInterval(checkForNewSyncs, pollingInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, workspaceId, pollingInterval, checkForNewSyncs]);

  // Return cleanup function for manual control
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!intervalRef.current && enabled && workspaceId) {
      checkForNewSyncs();
      intervalRef.current = setInterval(checkForNewSyncs, pollingInterval);
    }
  }, [enabled, workspaceId, pollingInterval, checkForNewSyncs]);

  return {
    stopPolling,
    startPolling,
  };
}
