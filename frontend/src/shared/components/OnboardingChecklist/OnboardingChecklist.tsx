/**
 * OnboardingChecklist Component
 * Compact floating card in bottom-right corner showing onboarding progress
 * Replaces the ConnectDataSourcesBanner with a checklist-style UI
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ChecklistItem } from './ChecklistItem';
import { useChecklistState } from './useChecklistState';
import type { OnboardingChecklistProps } from './types';

const CHECKLIST_DISMISSED_KEY = 'headway-checklist-dismissed';

export function OnboardingChecklist({
  onStepClick,
  onDismiss,
}: OnboardingChecklistProps): JSX.Element | null {
  const theme = useTheme();
  const { steps, completedCount, totalCount, isAllComplete } = useChecklistState();

  // Local state for expansion
  const [isExpanded, setIsExpanded] = useState(true);

  // Check if dismissed from sessionStorage
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem(CHECKLIST_DISMISSED_KEY) === 'true';
  });

  // Handle dismiss
  const handleDismiss = () => {
    sessionStorage.setItem(CHECKLIST_DISMISSED_KEY, 'true');
    setIsDismissed(true);
    onDismiss();
  };

  // Handle step click - navigate to wizard step
  const handleStepClick = (wizardStepIndex: number) => {
    onStepClick(wizardStepIndex);
  };

  // Don't render if dismissed or all complete
  if (isDismissed || isAllComplete) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1300,
        width: 320,
        maxWidth: 'calc(100vw - 48px)',
        borderRadius: 2.5,
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.95)
            : alpha('#ffffff', 0.98),
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}, 0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        '@keyframes slideInUp': {
          '0%': {
            transform: 'translateY(20px)',
            opacity: 0,
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: 1,
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: isExpanded
            ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
            : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: theme.palette.text.primary,
            }}
          >
            Getting Started
          </Typography>
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                color: theme.palette.primary.main,
              }}
            >
              {completedCount} of {totalCount}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            sx={{
              width: 28,
              height: 28,
              color: theme.palette.text.secondary,
            }}
          >
            {isExpanded ? (
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            sx={{
              width: 28,
              height: 28,
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.error.main,
                backgroundColor: alpha(theme.palette.error.main, 0.08),
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Checklist Items */}
      <Collapse in={isExpanded}>
        <Box sx={{ py: 0.5 }}>
          {steps.map((step) => (
            <ChecklistItem
              key={step.id}
              step={step}
              onClick={() => handleStepClick(step.wizardStepIndex)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
