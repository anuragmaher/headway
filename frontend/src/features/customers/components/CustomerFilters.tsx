/**
 * Customer Filters Component
 *
 * Provides filtering options for the customer list including:
 * - Industry filter
 * - ARR range filter
 * - Deal stage filter
 * - Sort options
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Chip,
  Typography,
  alpha,
  useTheme,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

export interface CustomerFilterValues {
  industry?: string;
  dealStage?: string;
  sortBy?: string;
  minMessages?: number;
}

interface CustomerFiltersProps {
  filters: CustomerFilterValues;
  onFiltersChange: (filters: CustomerFilterValues) => void;
  availableIndustries?: string[];
}

const DEAL_STAGES = [
  'All Stages',
  'Prospect',
  'Qualified',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'messages_desc', label: 'Most Messages' },
  { value: 'messages_asc', label: 'Fewest Messages' },
  { value: 'recent', label: 'Recently Active' },
];

const MESSAGE_COUNT_OPTIONS = [
  { label: 'All Customers', value: 0 },
  { label: '1+ messages', value: 1 },
  { label: '5+ messages', value: 5 },
  { label: '10+ messages', value: 10 },
  { label: '25+ messages', value: 25 },
  { label: '50+ messages', value: 50 },
];

export function CustomerFilters({
  filters,
  onFiltersChange,
  availableIndustries = [],
}: CustomerFiltersProps): JSX.Element {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleFilterChange = (key: keyof CustomerFilterValues, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };


  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== '' && value !== 'All Stages'
  ).length;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {/* Industry Filter */}
      {availableIndustries.length > 0 && (
        <TextField
          select
          size="small"
          value={filters.industry || ''}
          onChange={(e) => handleFilterChange('industry', e.target.value)}
          sx={{
            minWidth: 140,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.background.default, 0.5),
            },
          }}
          SelectProps={{
            displayEmpty: true,
            renderValue: (value) => {
              if (!value) return <Box sx={{ color: 'text.secondary' }}>Industry</Box>;
              return value;
            },
          }}
        >
          <MenuItem value="">All Industries</MenuItem>
          {availableIndustries.map((industry) => (
            <MenuItem key={industry} value={industry}>
              {industry}
            </MenuItem>
          ))}
        </TextField>
      )}

      {/* Message Count Filter */}
      <TextField
        select
        size="small"
        value={filters.minMessages || 0}
        onChange={(e) => handleFilterChange('minMessages', Number(e.target.value) || undefined)}
        sx={{
          minWidth: 140,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          },
        }}
        SelectProps={{
          displayEmpty: true,
          renderValue: (value) => {
            const option = MESSAGE_COUNT_OPTIONS.find(o => o.value === value);
            return <Box sx={{ color: value ? 'text.primary' : 'text.secondary' }}>
              {option?.label || 'Message Count'}
            </Box>;
          },
        }}
      >
        {MESSAGE_COUNT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {/* Deal Stage Filter */}
      <TextField
        select
        size="small"
        value={filters.dealStage || 'All Stages'}
        onChange={(e) => handleFilterChange('dealStage', e.target.value)}
        sx={{
          minWidth: 140,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          },
        }}
        SelectProps={{
          displayEmpty: true,
          renderValue: (value) => {
            return <Box sx={{ color: value && value !== 'All Stages' ? 'text.primary' : 'text.secondary' }}>
              {value || 'Deal Stage'}
            </Box>;
          },
        }}
      >
        {DEAL_STAGES.map((stage) => (
          <MenuItem key={stage} value={stage}>
            {stage}
          </MenuItem>
        ))}
      </TextField>

      {/* Sort By */}
      <TextField
        select
        size="small"
        value={filters.sortBy || 'name_asc'}
        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        sx={{
          minWidth: 140,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          },
        }}
        SelectProps={{
          displayEmpty: true,
          renderValue: (value) => {
            const option = SORT_OPTIONS.find(o => o.value === value);
            return <Box sx={{ color: 'text.secondary' }}>
              {option?.label || 'Sort By'}
            </Box>;
          },
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {/* Clear Filters Button */}
      {activeFilterCount > 0 && (
        <Button
          size="small"
          startIcon={<ClearIcon />}
          onClick={handleClearFilters}
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            fontSize: '0.75rem',
            minWidth: 'auto',
          }}
        >
          Clear ({activeFilterCount})
        </Button>
      )}
    </Box>
  );
}
