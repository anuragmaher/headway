import React from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import { Theme } from '../../types';
import { ThemeCard } from './ThemeCard';

interface ThemesListProps {
  themes: Theme[];
  hierarchicalThemes: Theme[];
  selectedThemeId: string;
  expandedThemes: Set<string>;
  loading: boolean;
  error: string | null;
  menuAnchorEl: HTMLElement | null;
  selectedThemeForMenu: Theme | null;
  onThemeSelect: (themeId: string) => void;
  onToggleExpansion: (themeId: string) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, theme: Theme) => void;
  onMenuClose: () => void;
  onMenuAction: (action: 'edit' | 'delete' | 'add-sub') => void;
  onCreateTheme: () => void;
  onAllThemesClick: () => void;
}

export const ThemesList: React.FC<ThemesListProps> = ({
  themes,
  hierarchicalThemes,
  selectedThemeId,
  expandedThemes,
  loading,
  error,
  menuAnchorEl,
  selectedThemeForMenu,
  onThemeSelect,
  onToggleExpansion,
  onMenuOpen,
  onMenuClose,
  onMenuAction,
  onCreateTheme,
  onAllThemesClick,
}) => {
  const renderTheme = (theme: Theme, depth: number = 0): React.ReactNode => {
    const hasChildren = (theme as any).children && (theme as any).children.length > 0;
    const isExpanded = expandedThemes.has(theme.id);
    const isSelected = selectedThemeId === theme.id;

    return (
      <React.Fragment key={theme.id}>
        <ThemeCard
          theme={theme}
          isSelected={isSelected}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          depth={depth}
          onSelect={onThemeSelect}
          onToggleExpansion={onToggleExpansion}
          onMenuOpen={onMenuOpen}
          menuAnchorEl={menuAnchorEl}
          selectedThemeForMenu={selectedThemeForMenu}
          onMenuClose={onMenuClose}
          onMenuAction={onMenuAction}
        />
        
        {hasChildren && isExpanded && (
          <Box>
            {(theme as any).children.map((childTheme: Theme) =>
              renderTheme(childTheme, depth + 1)
            )}
          </Box>
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Themes</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateTheme}
            disabled
          >
            Create Theme
          </Button>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Themes</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateTheme}
          >
            Create Theme
          </Button>
        </Box>
        
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Themes</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateTheme}
        >
          Create Theme
        </Button>
      </Box>

      <Button
        variant={selectedThemeId === '' ? 'contained' : 'outlined'}
        fullWidth
        onClick={onAllThemesClick}
        sx={{ mb: 2 }}
      >
        All Features ({themes.reduce((total, theme) => total + (theme.feature_count || 0), 0)})
      </Button>

      <Box>
        {hierarchicalThemes.length === 0 ? (
          <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
            No themes created yet. Create your first theme to get started!
          </Typography>
        ) : (
          hierarchicalThemes.map(theme => renderTheme(theme))
        )}
      </Box>
    </Box>
  );
};









