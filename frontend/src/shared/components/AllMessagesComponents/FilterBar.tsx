/**
 * FilterBar - Source filters, type filters, and sort controls
 */

import { Box, alpha, useTheme } from '@mui/material';
import { SourceFilters, TypeFilters } from './SourceFilters';
import { SortMenu } from './SortMenu';
import { AIProgressBadge } from './AIProgressBadge';
import { SourceType, SyncType } from '@/shared/types/AllMessagesTypes';
import { MessageSortField, SortOrder } from '@/services/sources';

interface FilterBarProps {
  activeTab: number;
  selectedSource: SourceType;
  selectedType: SyncType;
  onSourceChange: (source: SourceType) => void;
  onTypeChange: (type: SyncType) => void;
  // Sort props for Messages tab
  sortBy: MessageSortField;
  sortOrder: SortOrder;
  sortAnchorEl: HTMLElement | null;
  onSortMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onSortMenuClose: () => void;
  onSortChange: (field: MessageSortField) => void;
  onSortOrderToggle: () => void;
  // AI progress props
  aiProgress: number;
  aiIsProcessing: boolean;
}

export function FilterBar({
  activeTab,
  selectedSource,
  selectedType,
  onSourceChange,
  onTypeChange,
  sortBy,
  sortOrder,
  sortAnchorEl,
  onSortMenuOpen,
  onSortMenuClose,
  onSortChange,
  onSortOrderToggle,
  aiProgress,
  aiIsProcessing,
}: FilterBarProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: alpha(theme.palette.background.default, 0.5),
      }}
    >
      <SourceFilters
        selectedSource={selectedSource}
        onSourceChange={onSourceChange}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {activeTab === 1 && (
          <TypeFilters
            selectedType={selectedType}
            onTypeChange={onTypeChange}
          />
        )}

        {activeTab === 0 && (
          <>
            <AIProgressBadge progress={aiProgress} isProcessing={aiIsProcessing} />
            <SortMenu
              sortBy={sortBy}
              sortOrder={sortOrder}
              anchorEl={sortAnchorEl}
              onMenuOpen={onSortMenuOpen}
              onMenuClose={onSortMenuClose}
              onSortChange={onSortChange}
              onOrderToggle={onSortOrderToggle}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

export default FilterBar;
