/**
 * FeedbackHeader - Header with search, filters, and sort for feedback column
 */
import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  AccessTime as ClockIcon,
  LocalFireDepartment as FireIcon,
  ChatBubbleOutline as ChatIcon,
  TrackChanges as TargetIcon,
} from '@mui/icons-material';
import { useFilters, useSortBy, useExplorerActions } from '../../store';
import type { SortOption, FeedbackSource, FeedbackTag } from '../../types';
import { SOURCE_COLORS, TAG_STYLES } from '../../types';

interface FeedbackHeaderProps {
  title: string;
  subtitle: string;
  totalCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: 'recent', label: 'Most Recent', icon: ClockIcon },
  { value: 'oldest', label: 'Oldest First', icon: ClockIcon },
  { value: 'mentions', label: 'Most Mentions', icon: ChatIcon },
  { value: 'urgency', label: 'Highest Urgency', icon: FireIcon },
  { value: 'confidence', label: 'Best Match', icon: TargetIcon },
];

const SOURCE_OPTIONS: FeedbackSource[] = ['slack', 'gmail', 'gong', 'fathom', 'intercom', 'zendesk'];

const TAG_OPTIONS: FeedbackTag[] = ['FR', 'Bug', 'UX', 'Integration', 'Performance', 'Security'];

export const FeedbackHeader: React.FC<FeedbackHeaderProps> = ({
  title,
  subtitle,
  totalCount,
}) => {
  const filters = useFilters();
  const sortBy = useSortBy();
  const { setFilters, setSortBy, setSearchQuery, clearFilters } = useExplorerActions();

  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(filters.searchQuery);

  const hasActiveFilters = filters.sources.length > 0 || filters.tags.length > 0 || filters.urgency.length > 0;

  // Debounced search
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchValue(value);

    // Debounce the actual search
    const timeoutId = setTimeout(() => {
      setSearchQuery(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [setSearchQuery]);

  const handleClearSearch = () => {
    setSearchValue('');
    setSearchQuery('');
  };

  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSortSelect = (sort: SortOption) => {
    setSortBy(sort);
    handleSortClose();
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const toggleSourceFilter = (source: FeedbackSource) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    setFilters({ sources: newSources });
  };

  const toggleTagFilter = (tag: FeedbackTag) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    setFilters({ tags: newTags });
  };

  const currentSortOption = SORT_OPTIONS.find((opt) => opt.value === sortBy) || SORT_OPTIONS[0];

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Title Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            {subtitle} · {totalCount} item{totalCount !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search feedback..."
        value={searchValue}
        onChange={handleSearchChange}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#9E9E9E' }} />
              </InputAdornment>
            ),
            endAdornment: searchValue && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          mb: 1.5,
          '& .MuiOutlinedInput-root': {
            bgcolor: 'action.hover',
            borderRadius: 1.5,
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: 'divider',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'primary.main',
              borderWidth: 1,
            },
          },
          '& .MuiInputBase-input': {
            fontSize: '0.875rem',
            py: 0.75,
          },
        }}
      />

      {/* Filter Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {/* Sort Button */}
        <Tooltip title="Sort by">
          <Chip
            icon={<SortIcon sx={{ fontSize: 14 }} />}
            label={currentSortOption.label}
            size="small"
            onClick={handleSortClick}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          />
        </Tooltip>

        {/* Filter Button */}
        <Tooltip title="Filter">
          <Chip
            icon={<FilterIcon sx={{ fontSize: 14 }} />}
            label={hasActiveFilters ? `Filters (${filters.sources.length + filters.tags.length})` : 'Filter'}
            size="small"
            onClick={handleFilterClick}
            color={hasActiveFilters ? 'primary' : 'default'}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: hasActiveFilters ? 'primary.light' : 'action.hover',
              '&:hover': { bgcolor: hasActiveFilters ? 'primary.main' : 'action.selected' },
            }}
          />
        </Tooltip>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Chip
            label="Clear"
            size="small"
            onDelete={clearFilters}
            deleteIcon={<CloseIcon sx={{ fontSize: 12 }} />}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          />
        )}
      </Box>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { minWidth: 180, mt: 0.5 },
          },
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => handleSortSelect(option.value)}
            selected={sortBy === option.value}
          >
            <ListItemIcon>
              <option.icon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary={option.label} />
            {sortBy === option.value && (
              <CheckIcon sx={{ fontSize: 16, color: '#1976D2' }} />
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { minWidth: 220, mt: 0.5, maxHeight: 400 },
          },
        }}
      >
        {/* Sources Section */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 0.5,
            display: 'block',
            fontSize: '0.625rem',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          Source
        </Typography>
        {SOURCE_OPTIONS.map((source) => (
          <MenuItem
            key={source}
            onClick={() => toggleSourceFilter(source)}
            dense
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: SOURCE_COLORS[source],
                }}
              />
            </ListItemIcon>
            <ListItemText
              primary={source.charAt(0).toUpperCase() + source.slice(1)}
            />
            {filters.sources.includes(source) && (
              <CheckIcon sx={{ fontSize: 14, color: '#1976D2' }} />
            )}
          </MenuItem>
        ))}

        <Divider sx={{ my: 1 }} />

        {/* Tags Section */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 0.5,
            display: 'block',
            fontSize: '0.625rem',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          Type
        </Typography>
        {TAG_OPTIONS.map((tag) => (
          <MenuItem
            key={tag}
            onClick={() => toggleTagFilter(tag)}
            dense
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  bgcolor: TAG_STYLES[tag].bg,
                  border: `1px solid ${TAG_STYLES[tag].text}20`,
                }}
              />
            </ListItemIcon>
            <ListItemText primary={tag} />
            {filters.tags.includes(tag) && (
              <CheckIcon sx={{ fontSize: 14, color: '#1976D2' }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default FeedbackHeader;
