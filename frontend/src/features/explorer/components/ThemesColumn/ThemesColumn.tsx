/**
 * ThemesColumn - Left column displaying high-level themes
 * Clean, minimal design for fast scanning
 */
import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton, Fade, Snackbar, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { ThemeItem } from './ThemeItem';
import { ConnectSlackDialog } from '../dialogs/ConnectSlackDialog';
import { themeService } from '@/services/theme';
import {
  useThemes,
  useSelectedThemeId,
  useIsLoadingThemes,
  useExplorerActions,
} from '../../store';

interface ThemesColumnProps {
  width?: number | string;
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
    fetchThemes,
  } = useExplorerActions();

  // Slack connection dialog state
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackDialogThemeId, setSlackDialogThemeId] = useState<string>('');
  const [slackDialogThemeName, setSlackDialogThemeName] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

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

  const handleConnectSlack = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (theme) {
      setSlackDialogThemeId(themeId);
      setSlackDialogThemeName(theme.name);
      setSlackDialogOpen(true);
    }
  };

  const handleDisconnectSlack = async (themeId: string) => {
    try {
      await themeService.disconnectThemeFromSlack(themeId);
      setSnackbar({
        open: true,
        message: 'Slack channel disconnected',
        severity: 'success',
      });
      // Refresh themes to update the UI
      fetchThemes();
    } catch (error) {
      console.error('Failed to disconnect Slack:', error);
      setSnackbar({
        open: true,
        message: 'Failed to disconnect Slack channel',
        severity: 'error',
      });
    }
  };

  const handleSlackConnectSuccess = () => {
    setSnackbar({
      open: true,
      message: 'Slack channel connected successfully',
      severity: 'success',
    });
    // Refresh themes to update the UI
    fetchThemes();
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const isMobileFullWidth = typeof width === 'string' && width === '100%';

  return (
    <>
      <Box
        sx={{
          width,
          minWidth: isMobileFullWidth ? 'auto' : 180,
          maxWidth: isMobileFullWidth ? 'auto' : 280,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: isMobileFullWidth ? 'none' : '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.75rem',
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
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <Box>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  height={isMobileFullWidth ? 60 : 52}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    mb: isMobileFullWidth ? 1 : 0,
                    borderRadius: isMobileFullWidth ? 1 : 0,
                    animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite alternate`,
                  }}
                />
              ))}
            </Box>
          ) : themes.length === 0 ? (
            <Fade in timeout={500}>
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
            </Fade>
          ) : (
            <Fade in timeout={500}>
              <Box>
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
                  onConnectSlack={handleConnectSlack}
                  onDisconnectSlack={handleDisconnectSlack}
                />
              ))}
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {/* Slack Connection Dialog */}
      <ConnectSlackDialog
        open={slackDialogOpen}
        onClose={() => setSlackDialogOpen(false)}
        themeId={slackDialogThemeId}
        themeName={slackDialogThemeName}
        onSuccess={handleSlackConnectSuccess}
      />

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ThemesColumn;
