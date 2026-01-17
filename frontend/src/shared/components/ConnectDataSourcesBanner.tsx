/**
 * Connect Data Sources Banner Component
 * Shows an eye-catching banner when user hasn't connected any data sources
 * Banner persists until data sources are connected - dismiss only hides for current session
 */

import { Box, Typography, Button, alpha, useTheme, IconButton } from '@mui/material';
import { CloudSync as CloudSyncIcon, Close as CloseIcon } from '@mui/icons-material';
import { useState } from 'react';

const BANNER_DISMISSED_KEY = 'headway-datasource-banner-dismissed';

interface ConnectDataSourcesBannerProps {
  onConnectClick: () => void;
}

export function ConnectDataSourcesBanner({
  onConnectClick,
}: ConnectDataSourcesBannerProps): JSX.Element | null {
  const theme = useTheme();
  // Use sessionStorage so banner comes back after browser restart
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  });

  const handleDismiss = () => {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1300, // Above most content but below modals
        maxWidth: { xs: 'calc(100% - 48px)', sm: 480 },
        borderRadius: 3,
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.dark, 0.15)} 100%)`
          : `linear-gradient(135deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha('#f8f9fa', 0.98)} 100%)`,
        border: `1.5px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}, 0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
        overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        animation: 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1), pulse 3s ease-in-out infinite',
        '@keyframes slideInUp': {
          '0%': {
            transform: 'translateY(100px)',
            opacity: 0,
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: 1,
          },
        },
        '@keyframes pulse': {
          '0%, 100%': {
            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}, 0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
          },
          '50%': {
            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.25)}, 0 2px 8px ${alpha(theme.palette.common.black, 0.12)}`,
          },
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 70%)`,
          filter: 'blur(30px)',
          zIndex: 0,
          animation: 'float 6s ease-in-out infinite',
          '@keyframes float': {
            '0%, 100%': {
              transform: 'translate(0, 0) scale(1)',
            },
            '50%': {
              transform: 'translate(-10px, -10px) scale(1.1)',
            },
          },
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.secondary?.main || theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          filter: 'blur(25px)',
          zIndex: 0,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          p: 3,
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={handleDismiss}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary',
            opacity: 0.6,
            '&:hover': {
              opacity: 1,
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              color: theme.palette.error.main,
            },
            transition: 'all 0.2s ease',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2.5,
            pr: 4, // Space for close button
          }}
        >
          {/* Icon with animated glow */}
          <Box
            sx={{
              position: 'relative',
              flexShrink: 0,
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: -4,
                borderRadius: 2.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                opacity: 0.3,
                filter: 'blur(8px)',
                animation: 'glow 2s ease-in-out infinite',
                '@keyframes glow': {
                  '0%, 100%': {
                    opacity: 0.3,
                    transform: 'scale(1)',
                  },
                  '50%': {
                    opacity: 0.5,
                    transform: 'scale(1.05)',
                  },
                },
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 56,
                height: 56,
                borderRadius: 2.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05) rotate(5deg)',
                },
              }}
            >
              <CloudSyncIcon sx={{ color: 'white', fontSize: 30 }} />
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 0.75,
                fontSize: '1.125rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.3,
              }}
            >
              Connect Data Sources
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                fontWeight: 400,
                lineHeight: 1.6,
                mb: 2,
                fontSize: '0.875rem',
              }}
            >
              Connect Slack, Gmail, Gong, or Fathom to start capturing customer feedback and feature requests
            </Typography>
            <Button
              variant="contained"
              size="medium"
              onClick={onConnectClick}
              startIcon={<CloudSyncIcon sx={{ fontSize: 18 }} />}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.875rem',
                letterSpacing: '0.01em',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(90deg, transparent, ${alpha('#fff', 0.3)}, transparent)`,
                  transition: 'left 0.5s ease',
                },
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
                  '&::before': {
                    left: '100%',
                  },
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Connect Now
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
