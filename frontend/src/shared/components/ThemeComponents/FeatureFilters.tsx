/**
 * FeatureFilters - Filter and sort controls for features
 */

import React from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Collapse,
  Chip,
  InputAdornment,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import { useThemesPageStore } from '@/shared/store/ThemesStore';

interface FeatureFiltersProps {
  filteredCount: number;
  totalCount: number;
}

export const FeatureFilters: React.FC<FeatureFiltersProps> = ({ filteredCount, totalCount }) => {
  const theme = useTheme();
  const {
    filters,
    showFilters,
    setFilters,
    clearFilters,
    setShowFilters,
  } = useThemesPageStore();

  const hasActiveFilters = 
    filters.filterStatus !== 'all' || 
    filters.filterUrgency !== 'all' || 
    filters.filterMrrMin || 
    filters.filterMrrMax || 
    filters.searchQuery;

  const activeFilterCount = [
    filters.filterStatus !== 'all',
    filters.filterUrgency !== 'all',
    filters.filterMrrMin,
    filters.filterMrrMax,
  ].filter(Boolean).length;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Mobile Layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search features..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { borderRadius: 2, fontSize: '0.85rem' }
          }}
          fullWidth
          sx={{ mb: 1 }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'contained' : 'outlined'}
              sx={{ 
                flex: 1,
                borderRadius: 1.5,
                textTransform: 'none',
              }}
            >
              Filters
              {activeFilterCount > 0 && (
                <Chip 
                  label={activeFilterCount} 
                  size="small" 
                  sx={{ 
                    ml: 1, 
                    height: 18, 
                    fontSize: '0.7rem',
                    bgcolor: showFilters ? 'rgba(255,255,255,0.2)' : theme.palette.primary.main,
                    color: showFilters ? 'inherit' : 'white',
                  }} 
                />
              )}
            </Button>

            <FormControl size="small" sx={{ flex: 2, minWidth: 120 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={filters.sortBy}
                label="Sort By"
                onChange={(e) => setFilters({ sortBy: e.target.value })}
                sx={{ borderRadius: 1.5 }}
              >
                <MenuItem value="last_mentioned">Last Mentioned</MenuItem>
                <MenuItem value="mention_count">Mentions</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="urgency">Urgency</MenuItem>
                <MenuItem value="mrr">MRR</MenuItem>
              </Select>
            </FormControl>

            <IconButton
              size="small"
              onClick={() => setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              sx={{ 
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                borderRadius: 1.5,
              }}
            >
              {filters.sortOrder === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {hasActiveFilters ? (
              <Button
                size="small"
                startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
                onClick={clearFilters}
                sx={{ 
                  color: theme.palette.error.main,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                }}
              >
                Clear Filters
              </Button>
            ) : <Box />}
            
            <Typography variant="caption" color="text.secondary">
              Showing {filteredCount} of {totalCount}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Desktop Layout */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1.5, alignItems: 'center', mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search features..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { 
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }
          }}
          sx={{ minWidth: 220 }}
        />

        <Button
          size="small"
          startIcon={<FilterListIcon sx={{ fontSize: 18 }} />}
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters || activeFilterCount > 0 ? 'contained' : 'outlined'}
          sx={{
            borderRadius: 1.5,
            textTransform: 'none',
            px: 2,
          }}
        >
          Filters
          {activeFilterCount > 0 && (
            <Chip 
              label={activeFilterCount} 
              size="small" 
              sx={{ 
                ml: 0.75, 
                height: 18, 
                fontSize: '0.7rem',
                minWidth: 18,
                bgcolor: 'rgba(255,255,255,0.2)',
                '& .MuiChip-label': { px: 0.5 },
              }} 
            />
          )}
        </Button>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={filters.sortBy}
            label="Sort By"
            onChange={(e) => setFilters({ sortBy: e.target.value })}
            sx={{ borderRadius: 1.5 }}
          >
            <MenuItem value="last_mentioned">Last Mentioned</MenuItem>
            <MenuItem value="mention_count">Mentions</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="status">Status</MenuItem>
            <MenuItem value="urgency">Urgency</MenuItem>
            <MenuItem value="mrr">MRR</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          size="small"
          onClick={() => setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          sx={{ 
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            borderRadius: 1.5,
            width: 36,
            height: 36,
          }}
          title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {filters.sortOrder === 'asc' ? (
            <ArrowUpIcon sx={{ fontSize: 20 }} />
          ) : (
            <ArrowDownIcon sx={{ fontSize: 20 }} />
          )}
        </IconButton>

        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
            onClick={clearFilters}
            sx={{ 
              color: theme.palette.error.main,
              textTransform: 'none',
            }}
          >
            Clear
          </Button>
        )}

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
            <strong>{filteredCount}</strong> of {totalCount} features
          </Typography>
        </Box>
      </Box>

      {/* Collapsible Filter Section */}
      <Collapse in={showFilters}>
        <Box sx={{
          p: 2,
          mt: 1,
          borderRadius: 2,
          background: alpha(theme.palette.background.default, 0.5),
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.filterStatus}
                  label="Status"
                  onChange={(e) => setFilters({ filterStatus: e.target.value })}
                  sx={{ borderRadius: 1.5 }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={filters.filterUrgency}
                  label="Urgency"
                  onChange={(e) => setFilters({ filterUrgency: e.target.value })}
                  sx={{ borderRadius: 1.5 }}
                >
                  <MenuItem value="all">All Urgencies</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                size="small"
                fullWidth
                label="MRR Min"
                type="number"
                value={filters.filterMrrMin}
                onChange={(e) => setFilters({ filterMrrMin: e.target.value })}
                placeholder="e.g. 100"
                InputProps={{ sx: { borderRadius: 1.5 } }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                size="small"
                fullWidth
                label="MRR Max"
                type="number"
                value={filters.filterMrrMax}
                onChange={(e) => setFilters({ filterMrrMax: e.target.value })}
                placeholder="e.g. 1000"
                InputProps={{ sx: { borderRadius: 1.5 } }}
              />
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Box>
  );
};
