/**
 * MobileNavigationHeader - Mobile-specific header with back navigation
 * Shows current step in the progressive flow and handles back navigation
 */
import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useExplorerStore } from '../store';
import type { MobileNavigationItem } from '../store/slices/uiSlice';

interface MobileNavigationHeaderProps {
  onBack?: () => void;
}

export const MobileNavigationHeader: React.FC<MobileNavigationHeaderProps> = ({ onBack }) => {
  const theme = useTheme();
  const { mobileNavigationStack, navigateBack } = useExplorerStore();

  const currentItem = mobileNavigationStack[mobileNavigationStack.length - 1];
  const canGoBack = mobileNavigationStack.length > 1;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigateBack();
    }
  };

  const getStepInfo = (item: MobileNavigationItem) => {
    switch (item.view) {
      case 'themes':
        return { step: 1, total: 3, label: 'Select Theme' };
      case 'subThemes':
        return { step: 2, total: 3, label: 'Select Sub-Theme' };
      case 'customerAsks':
        return { step: 3, total: 3, label: 'Customer Asks' };
      case 'mentions':
        return { step: 3, total: 3, label: 'Customer Asks' }; // Fallback, shouldn't be used
      default:
        return { step: 1, total: 3, label: 'Navigation' };
    }
  };

  const stepInfo = getStepInfo(currentItem);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 1px 3px rgba(0,0,0,0.2)' 
          : '0 1px 3px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Back Button */}
      {canGoBack && (
        <IconButton
          onClick={handleBack}
          sx={{
            mr: 1,
            color: theme.palette.primary.main,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ArrowBack />
        </IconButton>
      )}

      {/* Title and Step Info */}
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            fontSize: '1.1rem',
            color: theme.palette.text.primary,
            mb: 0.5,
          }}
        >
          {currentItem.title}
        </Typography>
        
        {/* Step Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.75rem',
            }}
          >
            Step {stepInfo.step} of {stepInfo.total}: {stepInfo.label}
          </Typography>
          
          {/* Progress Dots */}
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            {Array.from({ length: stepInfo.total }).map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: index < stepInfo.step 
                    ? theme.palette.primary.main 
                    : alpha(theme.palette.text.secondary, 0.3),
                  transition: 'background-color 0.2s ease',
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MobileNavigationHeader;