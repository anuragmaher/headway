/**
 * SyncSourcesDropdown - Dropdown button with checkboxes to select which sources to sync
 */

import { useState, useRef } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
  Divider,
  Box,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ChatBubbleOutline as MessagesIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';

const SOURCE_OPTIONS = [
  { value: 'fathom', label: 'Fathom' },
  { value: 'gong', label: 'Gong' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'slack', label: 'Slack' },
] as const;

type SourceValue = typeof SOURCE_OPTIONS[number]['value'];

interface SyncSourcesDropdownProps {
  syncing: boolean;
  disabled: boolean;
  onSync: (selectedSources: SourceValue[]) => void;
}

export function SyncSourcesDropdown({
  syncing,
  disabled,
  onSync,
}: SyncSourcesDropdownProps): JSX.Element {
  const theme = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSources, setSelectedSources] = useState<Set<SourceValue>>(
    new Set(SOURCE_OPTIONS.map((s) => s.value))
  );

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (syncing) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggleSource = (source: SourceValue) => {
    setSelectedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(source)) {
        newSet.delete(source);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedSources(new Set(SOURCE_OPTIONS.map((s) => s.value)));
  };

  const handleDeselectAll = () => {
    setSelectedSources(new Set());
  };

  const handleSync = () => {
    handleClose();
    const sourcesToSync = Array.from(selectedSources);
    onSync(sourcesToSync);
  };

  const allSelected = selectedSources.size === SOURCE_OPTIONS.length;
  const noneSelected = selectedSources.size === 0;

  const getButtonLabel = (): string => {
    if (syncing) return 'Syncing...';
    if (allSelected) return 'Sync All Sources';
    if (noneSelected) return 'Select Sources';
    if (selectedSources.size === 1) {
      const source = SOURCE_OPTIONS.find((s) => selectedSources.has(s.value));
      return `Sync ${source?.label}`;
    }
    return `Sync ${selectedSources.size} Sources`;
  };

  return (
    <>
      <Button
        ref={buttonRef}
        variant="contained"
        size="small"
        startIcon={
          syncing ? (
            <CircularProgress size={14} color="inherit" />
          ) : (
            <MessagesIcon sx={{ fontSize: 16 }} />
          )
        }
        endIcon={!syncing && <ArrowDownIcon sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        disabled={disabled}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.8rem',
          borderRadius: 1.5,
          px: 1.5,
          py: 0.5,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        }}
      >
        {getButtonLabel()}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              mt: 0.5,
              borderRadius: 2,
              boxShadow: theme.shadows[8],
            },
          },
        }}
      >
        {/* Select All / Deselect All */}
        <Box sx={{ px: 1, py: 0.5 }}>
          <Button
            size="small"
            onClick={allSelected ? handleDeselectAll : handleSelectAll}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              color: theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </Box>

        <Divider />

        {/* Source checkboxes */}
        {SOURCE_OPTIONS.map((source) => (
          <MenuItem
            key={source.value}
            onClick={() => handleToggleSource(source.value)}
            dense
            sx={{ py: 0.5 }}
          >
            <Checkbox
              checked={selectedSources.has(source.value)}
              size="small"
              sx={{ p: 0.5, mr: 1 }}
            />
            <ListItemText
              primary={source.label}
              primaryTypographyProps={{ fontSize: '0.85rem' }}
            />
          </MenuItem>
        ))}

        <Divider />

        {/* Sync button */}
        <Box sx={{ p: 1 }}>
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={handleSync}
            disabled={noneSelected}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.8rem',
              borderRadius: 1,
            }}
          >
            {allSelected ? 'Sync All' : `Sync Selected (${selectedSources.size})`}
          </Button>
        </Box>
      </Menu>
    </>
  );
}

export default SyncSourcesDropdown;
