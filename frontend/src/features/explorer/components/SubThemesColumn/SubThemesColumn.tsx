/**
 * SubThemesColumn - Middle column displaying features for selected theme
 * Clean, minimal design with back navigation
 */
import React from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton, useTheme } from '@mui/material';
import { Add as AddIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { SubThemeItem } from './SubThemeItem';
import {
  useSubThemes,
  useSelectedTheme,
  useSelectedSubThemeId,
  useIsLoadingSubThemes,
  useExplorerActions,
} from '../../store';

interface SubThemesColumnProps {
  width?: number;
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
    selectTheme,
    selectSubTheme,
    openAddSubThemeDialog,
    openEditSubThemeDialog,
    openDeleteConfirm,
    openMergeDialog,
    lockSubTheme,
    unlockSubTheme,
  } = useExplorerActions();

  const handleBack = () => {
    selectTheme(null);
  };

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
      console.error('Failed to lock feature:', error);
    }
  };

  const handleUnlockSubTheme = async (subThemeId: string) => {
    try {
      await unlockSubTheme(subThemeId);
    } catch (error) {
      console.error('Failed to unlock feature:', error);
    }
  };

  // Empty state when no theme is selected
  if (!selectedTheme) {
    return (
      <Box
        sx={{
          width,
          minWidth: 200,
          maxWidth: 320,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: 'text.disabled',
              textTransform: 'uppercase',
            }}
          >
            Features
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
            Select a theme to view features
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width,
        minWidth: 200,
        maxWidth: 320,
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
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Back link */}
        <Box
          onClick={handleBack}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'text.secondary',
            mb: 1,
            '&:hover': { color: 'primary.main' },
          }}
        >
          <BackIcon sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 500 }}>
            Back to themes
          </Typography>
        </Box>

        {/* Theme name and stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: selectedTheme.color || 'primary.main',
                lineHeight: 1.3,
              }}
            >
              {selectedTheme.name}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.disabled',
                mt: 0.25,
              }}
            >
              {subThemes.length} features
            </Typography>
          </Box>
          <Tooltip title="Add Feature">
            <IconButton
              size="small"
              onClick={openAddSubThemeDialog}
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
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {isLoading ? (
          <Box sx={{ px: 1.5 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={52}
                sx={{ my: 0.5, borderRadius: 1 }}
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
              No features yet
            </Typography>
            <Box
              onClick={openAddSubThemeDialog}
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
              Add Feature
            </Box>
          </Box>
        ) : (
          <>
            {/* Feature items */}
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
