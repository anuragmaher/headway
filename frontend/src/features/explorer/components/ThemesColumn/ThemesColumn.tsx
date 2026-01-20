/**
 * ThemesColumn - Left column displaying high-level themes
 * Clean, minimal design for fast scanning
 */
import React from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { ThemeItem } from './ThemeItem';
import {
  useThemes,
  useSelectedThemeId,
  useIsLoadingThemes,
  useExplorerActions,
} from '../../store';

interface ThemesColumnProps {
  width?: number;
}

export const ThemesColumn: React.FC<ThemesColumnProps> = ({
  width = 220,
}) => {
  const themes = useThemes();
  const selectedThemeId = useSelectedThemeId();
  const isLoading = useIsLoadingThemes();
  const {
    selectTheme,
    openAddThemeDialog,
    openEditThemeDialog,
    openDeleteConfirm,
    lockTheme,
    unlockTheme,
  } = useExplorerActions();


  const handleThemeSelect = (themeId: string) => {
    selectTheme(themeId);
  };

  const handleEditTheme = (themeId: string) => {
    openEditThemeDialog(themeId);
  };

  const handleDeleteTheme = (themeId: string) => {
    openDeleteConfirm(themeId, 'theme');
  };

  const handleLockTheme = async (themeId: string) => {
    try {
      await lockTheme(themeId);
    } catch (error) {
      console.error('Failed to lock theme:', error);
    }
  };

  const handleUnlockTheme = async (themeId: string) => {
    try {
      await unlockTheme(themeId);
    } catch (error) {
      console.error('Failed to unlock theme:', error);
    }
  };

  return (
    <Box
      sx={{
        width,
        minWidth: 180,
        maxWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: 'text.secondary',
            textTransform: 'uppercase',
          }}
        >
          Themes
        </Typography>
        <Tooltip title="Add Theme">
          <IconButton
            size="small"
            onClick={openAddThemeDialog}
            sx={{
              width: 26,
              height: 26,
              bgcolor: 'rgba(59, 130, 246, 0.08)',
              color: 'primary.main',
              '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.16)' },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {isLoading ? (
          <Box sx={{ px: 1.5 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={48}
                sx={{ my: 0.5, borderRadius: 1 }}
              />
            ))}
          </Box>
        ) : themes.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.8125rem',
                color: 'text.disabled',
                mb: 2,
              }}
            >
              No themes yet
            </Typography>
            <Box
              onClick={openAddThemeDialog}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 2,
                py: 0.75,
                borderRadius: 1,
                bgcolor: 'primary.main',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
              Create Theme
            </Box>
          </Box>
        ) : (
          <>
            {themes.map((theme) => (
              <ThemeItem
                key={theme.id}
                theme={theme}
                isSelected={theme.id === selectedThemeId}
                onSelect={handleThemeSelect}
                onEdit={handleEditTheme}
                onDelete={handleDeleteTheme}
                onLock={handleLockTheme}
                onUnlock={handleUnlockTheme}
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};

export default ThemesColumn;
