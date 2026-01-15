/**
 * ThemeActionsMenu - Dropdown menu for theme actions
 */

import React from 'react';
import {
  Menu,
  MenuItem,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useThemesPageStore } from '../store';

export const ThemeActionsMenu: React.FC = () => {
  const theme = useTheme();
  const {
    menuAnchorEl,
    selectedThemeForMenu,
    closeMenu,
    handleMenuAction,
  } = useThemesPageStore();

  return (
    <Menu
      anchorEl={menuAnchorEl}
      open={Boolean(menuAnchorEl)}
      onClose={closeMenu}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      sx={{
        '& .MuiPaper-root': {
          borderRadius: 2,
          minWidth: 160,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        },
      }}
    >
      <MenuItem
        onClick={() => handleMenuAction('edit')}
        sx={{ py: 1.5, px: 2 }}
      >
        <EditIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
        Edit Theme
      </MenuItem>
      {selectedThemeForMenu && !selectedThemeForMenu.parent_theme_id && (
        <MenuItem
          onClick={() => handleMenuAction('add-sub')}
          sx={{ py: 1.5, px: 2 }}
        >
          <AddIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
          Add Sub-theme
        </MenuItem>
      )}
      <MenuItem
        onClick={() => handleMenuAction('delete')}
        sx={{
          py: 1.5,
          px: 2,
          color: 'error.main',
          '&:hover': {
            bgcolor: alpha(theme.palette.error.main, 0.1)
          }
        }}
      >
        <DeleteIcon sx={{ fontSize: 18, mr: 1.5 }} />
        Delete Theme
      </MenuItem>
    </Menu>
  );
};
