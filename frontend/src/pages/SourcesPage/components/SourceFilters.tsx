/**
 * SourceFilters component - Filter chips for selecting data sources
 */

import {
  Box,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { FilterList as FilterIcon } from '@mui/icons-material';
import { SourceType, SyncType } from '../types';

interface SourceFiltersProps {
  selectedSource: SourceType;
  onSourceChange: (source: SourceType) => void;
}

interface TypeFiltersProps {
  selectedType: SyncType;
  onTypeChange: (type: SyncType) => void;
}

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'gong', label: 'Gong' },
  { value: 'fathom', label: 'Fathom' },
  { value: 'slack', label: 'Slack' },
];

const typeOptions: { value: SyncType; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'source', label: 'Source Syncs' },
  { value: 'theme', label: 'Theme Syncs' },
];

export function SourceFilters({ selectedSource, onSourceChange }: SourceFiltersProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <FilterIcon sx={{ color: theme.palette.text.secondary, fontSize: 16, mr: 0.25 }} />
      {sourceOptions.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          onClick={() => onSourceChange(option.value)}
          sx={{
            height: 26,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 1.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            bgcolor: selectedSource === option.value
              ? alpha(theme.palette.primary.main, 0.1)
              : 'transparent',
            color: selectedSource === option.value
              ? theme.palette.primary.main
              : theme.palette.text.secondary,
            border: selectedSource === option.value
              ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
              : `1px solid transparent`,
            '&:hover': {
              bgcolor: selectedSource === option.value
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.action.hover, 0.06),
            },
            '& .MuiChip-label': {
              px: 1,
            },
          }}
        />
      ))}
    </Box>
  );
}

export function TypeFilters({ selectedType, onTypeChange }: TypeFiltersProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {typeOptions.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          onClick={() => onTypeChange(option.value)}
          sx={{
            height: 26,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 1.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            bgcolor: selectedType === option.value
              ? alpha(theme.palette.primary.main, 0.1)
              : 'transparent',
            color: selectedType === option.value
              ? theme.palette.primary.main
              : theme.palette.text.secondary,
            border: selectedType === option.value
              ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
              : `1px solid transparent`,
            '&:hover': {
              bgcolor: selectedType === option.value
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.action.hover, 0.06),
            },
            '& .MuiChip-label': {
              px: 1,
            },
          }}
        />
      ))}
    </Box>
  );
}

export default SourceFilters;
