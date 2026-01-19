/**
 * SyncHistoryTabContent - Content area for the Sync History tab
 */

import { Box, Typography, CircularProgress, Pagination, Paper, alpha, useTheme } from '@mui/material';
import { SyncHistoryTable } from './SyncHistoryTable';
import { SyncHistoryItem } from '@/shared/types/AllMessagesTypes';
import { SyncHistorySortField, SortOrder } from '@/services/sources';

interface SyncHistoryTabContentProps {
  items: SyncHistoryItem[];
  loading: boolean;
  totalPages: number;
  currentPage: number;
  onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
  onRowClick: (item: SyncHistoryItem) => void;
  sortBy: SyncHistorySortField;
  sortOrder: SortOrder;
  onSortChange: (field: SyncHistorySortField) => void;
}

export function SyncHistoryTabContent({
  items,
  loading,
  totalPages,
  currentPage,
  onPageChange,
  onRowClick,
  sortBy,
  sortOrder,
  onSortChange,
}: SyncHistoryTabContentProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        bgcolor: theme.palette.background.default,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          width: '100%',
          overflow: 'hidden',
          minWidth: 0,
          px: 2.5,
          py: 1.5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: theme.palette.background.paper,
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading sync history...
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              <SyncHistoryTable
                items={items}
                onRowClick={onRowClick}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 1.5,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
              }}
            >
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={onPageChange}
                size="small"
                color="primary"
              />
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export default SyncHistoryTabContent;
