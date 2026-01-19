/**
 * SortMenu - Sort dropdown menu for messages
 */

import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Sort as SortIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Source as SourceIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { MessageSortField, SortOrder } from '@/services/sources';

interface SortMenuProps {
  sortBy: MessageSortField;
  sortOrder: SortOrder;
  anchorEl: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onSortChange: (field: MessageSortField) => void;
  onOrderToggle: () => void;
}

const SORT_LABELS: Record<MessageSortField, string> = {
  timestamp: 'Date',
  sender: 'Sender',
  source: 'Source',
};

export function SortMenu({
  sortBy,
  sortOrder,
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onSortChange,
  onOrderToggle,
}: SortMenuProps): JSX.Element {
  const theme = useTheme();

  return (
    <>
      <Tooltip title="Sort messages">
        <Button
          size="small"
          variant="outlined"
          startIcon={<SortIcon sx={{ fontSize: 16 }} />}
          endIcon={sortOrder === 'desc' ? <DescIcon sx={{ fontSize: 14 }} /> : <AscIcon sx={{ fontSize: 14 }} />}
          onClick={onMenuOpen}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.75rem',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.5,
            borderColor: alpha(theme.palette.divider, 0.3),
            color: theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          {SORT_LABELS[sortBy]}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            borderRadius: 2,
          },
        }}
      >
        <MenuItem
          onClick={() => onSortChange('timestamp')}
          sx={{ fontSize: '0.85rem' }}
        >
          <ListItemIcon>
            <TimeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Date</ListItemText>
          {sortBy === 'timestamp' && (
            <CheckIcon fontSize="small" color="primary" />
          )}
        </MenuItem>
        <MenuItem
          onClick={() => onSortChange('sender')}
          sx={{ fontSize: '0.85rem' }}
        >
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sender</ListItemText>
          {sortBy === 'sender' && (
            <CheckIcon fontSize="small" color="primary" />
          )}
        </MenuItem>
        <MenuItem
          onClick={() => onSortChange('source')}
          sx={{ fontSize: '0.85rem' }}
        >
          <ListItemIcon>
            <SourceIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Source</ListItemText>
          {sortBy === 'source' && (
            <CheckIcon fontSize="small" color="primary" />
          )}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={onOrderToggle}
          sx={{ fontSize: '0.85rem' }}
        >
          <ListItemIcon>
            {sortOrder === 'desc' ? <DescIcon fontSize="small" /> : <AscIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default SortMenu;
