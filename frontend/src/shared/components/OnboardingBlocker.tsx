/**
 * Onboarding Blocker Component
 * Prevents users from accessing main dashboard without completing onboarding
 * Requires company details to be filled and at least one theme to exist
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CircleOutlined as CircleOutlinedIcon,
} from '@mui/icons-material';
import { ROUTES } from '@/lib/constants/routes';

export interface OnboardingBlockerProps {
  isBlocked: boolean;
  missingItems?: {
    companyDetails?: boolean;
    themes?: boolean;
  };
  onDismiss?: () => void;
}

export function OnboardingBlocker({
  isBlocked,
  missingItems = {
    companyDetails: false,
    themes: false,
  },
  onDismiss,
}: OnboardingBlockerProps): JSX.Element | null {
  const navigate = useNavigate();
  const theme = useTheme();
  const [open, setOpen] = useState(isBlocked);

  useEffect(() => {
    setOpen(isBlocked);
  }, [isBlocked]);

  const handleGoToSettings = () => {
    setOpen(false);
    navigate(ROUTES.SETTINGS_WORKSPACE);
  };

  const handleDismiss = () => {
    setOpen(false);
    onDismiss?.();
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: '1.5rem',
          fontWeight: 700,
          pb: 1,
        }}
      >
        Complete Your Setup
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Before you can access the full dashboard, please complete the following items:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Company Details Check */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {missingItems.companyDetails ? (
              <CircleOutlinedIcon
                sx={{
                  color: theme.palette.warning.main,
                  fontSize: 24,
                  mt: 0.25,
                  flexShrink: 0,
                }}
              />
            ) : (
              <CheckCircleIcon
                sx={{
                  color: theme.palette.success.main,
                  fontSize: 24,
                  mt: 0.25,
                  flexShrink: 0,
                }}
              />
            )}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: missingItems.companyDetails ? 'text.primary' : 'text.secondary',
                }}
              >
                Company Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {missingItems.companyDetails
                  ? 'Fill in your company name, website, size, and description'
                  : 'Completed'}
              </Typography>
            </Box>
          </Box>

          {/* Themes Check */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {missingItems.themes ? (
              <CircleOutlinedIcon
                sx={{
                  color: theme.palette.warning.main,
                  fontSize: 24,
                  mt: 0.25,
                  flexShrink: 0,
                }}
              />
            ) : (
              <CheckCircleIcon
                sx={{
                  color: theme.palette.success.main,
                  fontSize: 24,
                  mt: 0.25,
                  flexShrink: 0,
                }}
              />
            )}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: missingItems.themes ? 'text.primary' : 'text.secondary',
                }}
              >
                Create Your First Theme
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {missingItems.themes
                  ? 'Create at least one theme to organize your features'
                  : 'Completed'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            background: alpha(theme.palette.info.main, 0.1),
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            💡 Tip: Start by filling in your company details. Then you can create themes to organize your customer
            feedback.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleDismiss} variant="text">
          Maybe Later
        </Button>
        {missingItems.companyDetails && (
          <Button
            onClick={handleGoToSettings}
            variant="contained"
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
            }}
          >
            Go to Settings
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
