/**
 * SyncDetailsDrawer - Drawer component showing sync operation details
 * Shows error details, fetched messages, or loading state based on sync status
 * Uses Zustand store for state management and SyncedItemCard for expandable items
 */

import { useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { useSyncDetailsStore } from '@/shared/store/AllMessagesStore';
import { SyncedItemCard } from './SyncedItemCard';

interface SyncDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  syncId: string | null;
  workspaceId: string;
}

export function SyncDetailsDrawer({
  open,
  onClose,
  syncId,
  workspaceId,
}: SyncDetailsDrawerProps): JSX.Element {
  const theme = useTheme();

  // Get state and actions from Zustand store
  const {
    syncDetails,
    syncedItems,
    syncedItemsTotal,
    expandedItems,
    loading,
    error,
    fetchSyncDetails,
    toggleItemExpanded,
    reset,
  } = useSyncDetailsStore();

  useEffect(() => {
    if (open && syncId && workspaceId) {
      fetchSyncDetails(workspaceId, syncId);
    } else {
      // Reset state when drawer closes
      reset();
    }
  }, [open, syncId, workspaceId, fetchSyncDetails, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">
            Loading sync details...
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!syncDetails) {
      return null;
    }

    return (
      <Box>
        {/* Error Message for Failed Status */}
        {syncDetails.status === 'failed' && syncDetails.error_message && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="error">
              <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                {syncDetails.error_message}
              </Typography>
            </Alert>
          </Box>
        )}

        {/* In Progress State */}
        {syncDetails.status === 'in_progress' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Sync is currently in progress...
              <br />
              Check back in a moment for results.
            </Typography>
          </Box>
        )}

        {/* Synced Items for Successful Sync */}
        {syncDetails.status === 'success' && syncedItems.length > 0 && (
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 1, display: 'block' }}>
              {syncDetails.sync_type === 'source' ? 'Synced Items' : 'Updated Features'} ({syncedItemsTotal} total, showing {syncedItems.length})
            </Typography>
            <Box
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.background.default, 0.3),
                px: 2,
                py: 1,
              }}
            >
              {syncedItems.map((item, index) => (
                <SyncedItemCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedItems.has(item.id)}
                  onToggle={() => toggleItemExpanded(item.id)}
                  index={index}
                  totalItems={syncedItems.length}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Success message if no items to show */}
        {syncDetails.status === 'success' && syncedItems.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <SuccessIcon sx={{ fontSize: 48, color: theme.palette.success.main, mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Sync completed successfully. No new items to display.
            </Typography>
          </Box>
        )}

        {/* Failed with no error message */}
        {syncDetails.status === 'failed' && !syncDetails.error_message && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 48, color: theme.palette.error.main, mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Sync failed. No error details available.
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 450,
          maxWidth: '90vw',
          bgcolor: theme.palette.background.paper,
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          Sync Details
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5, overflow: 'auto', flex: 1 }}>
        {renderContent()}
      </Box>
    </Drawer>
  );
}

export default SyncDetailsDrawer;
