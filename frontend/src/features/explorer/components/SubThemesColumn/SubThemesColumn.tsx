/**
 * SubThemesColumn - Middle column displaying sub-themes for selected theme
 * Clean, minimal design
 */
import React from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton, useTheme, alpha } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { SubThemeItem } from './SubThemeItem';
import {
  useSubThemes,
  useSelectedTheme,
  useSelectedSubThemeId,
  useIsLoadingSubThemes,
  useExplorerActions,
} from '../../store';

interface SubThemesColumnProps {
  width?: number | string;
}

export const SubThemesColumn: React.FC<SubThemesColumnProps> = ({
  width = 260,
}) => {
  const theme = useTheme();
  const subThemes = useSubThemes();
  const selectedTheme = useSelectedTheme();
  const selectedSubThemeId = useSelectedSubThemeId();
  const isLoading = useIsLoadingSubThemes();
  const {
    selectSubTheme,
    openAddSubThemeDialog,
    openEditSubThemeDialog,
    openDeleteConfirm,
    openMergeDialog,
    lockSubTheme,
    unlockSubTheme,
  } = useExplorerActions();

  const handleSubThemeSelect = (subThemeId: string) => {
    selectSubTheme(subThemeId);
  };

  const handleEditSubTheme = (subThemeId: string) => {
    openEditSubThemeDialog(subThemeId);
  };

  const handleDeleteSubTheme = (subThemeId: string) => {
    openDeleteConfirm(subThemeId, 'subTheme');
  };

  const handleMergeSubTheme = (subThemeId: string) => {
    openMergeDialog(subThemeId);
  };

  const handleLockSubTheme = async (subThemeId: string) => {
    try {
      await lockSubTheme(subThemeId);
    } catch (error) {
      console.error('Failed to lock sub theme:', error);
    }
  };

  const handleUnlockSubTheme = async (subThemeId: string) => {
    try {
      await unlockSubTheme(subThemeId);
    } catch (error) {
      console.error('Failed to unlock sub theme:', error);
    }
  };

  const isMobileFullWidth = typeof width === 'string' && width === '100%';

  // Empty state when no theme is selected
  if (!selectedTheme) {
    return (
      <Box
        sx={{
          width,
          minWidth: isMobileFullWidth ? 'auto' : 200,
          maxWidth: isMobileFullWidth ? 'auto' : 320,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: isMobileFullWidth ? 'none' : `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Sub Themes
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            p: 3,
          }}
        >
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>
            Select a theme to view sub themes
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width,
        minWidth: isMobileFullWidth ? 'auto' : 200,
        maxWidth: isMobileFullWidth ? 'auto' : 320,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: isMobileFullWidth ? 'none' : `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
      }}
    >
      {/* Header - Shows selected theme name */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 0.5,
            }}
          >
            {selectedTheme.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Select a sub-theme to view customer asks
          </Typography>
        </Box>
        <Tooltip title="Add Sub Theme">
          <IconButton
            size="small"
            onClick={openAddSubThemeDialog}
            sx={{
              ml: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA' }}>
        {isLoading ? (
          <Box>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={52}
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              />
            ))}
          </Box>
        ) : subThemes.length === 0 ? (
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
              No sub themes yet
            </Typography>
            <Box
              onClick={openAddSubThemeDialog}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 2,
                py: 0.75,
                bgcolor: 'primary.main',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
              Add Sub Theme
            </Box>
          </Box>
        ) : (
          <>
            {/* Sub theme items */}
            {subThemes.map((subTheme) => (
              <SubThemeItem
                key={subTheme.id}
                subTheme={subTheme}
                isSelected={subTheme.id === selectedSubThemeId}
                onSelect={handleSubThemeSelect}
                onEdit={handleEditSubTheme}
                onDelete={handleDeleteSubTheme}
                onMerge={handleMergeSubTheme}
                onLock={handleLockSubTheme}
                onUnlock={handleUnlockSubTheme}
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};

export default SubThemesColumn;
