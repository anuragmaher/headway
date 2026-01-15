/**
 * Onboarding Blocker Component
 * Prevents users from accessing main dashboard without completing onboarding
 * Requires company details to be filled, data sources to be added, and themes to exist
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
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  Storage as StorageIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { ROUTES } from '@/lib/constants/routes';

export interface OnboardingBlockerProps {
  isBlocked: boolean;
  missingItems?: {
    companyDetails?: boolean;
    dataSources?: boolean;
    themes?: boolean;
  };
  onDismiss?: () => void;
}

interface OnboardingStep {
  key: 'companyDetails' | 'dataSources' | 'themes';
  label: string;
  description: string;
  incompleteDescription: string;
  icon: React.ReactNode;
  route: string;
  buttonLabel: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'companyDetails',
    label: 'Company Details',
    description: 'Tell us about your company',
    incompleteDescription: 'Fill in your company name, website, size, and description',
    icon: <BusinessIcon />,
    route: ROUTES.SETTINGS_WORKSPACE,
    buttonLabel: 'Go to Settings',
  },
  {
    key: 'dataSources',
    label: 'Connect Data Sources',
    description: 'Connect your communication tools',
    incompleteDescription: 'Connect at least one data source (Slack, Gmail, Gong, or Fathom)',
    icon: <StorageIcon />,
    route: ROUTES.SETTINGS_WORKSPACE,
    buttonLabel: 'Add Data Source',
  },
  {
    key: 'themes',
    label: 'Create Themes',
    description: 'Organize your feedback into themes',
    incompleteDescription: 'Create at least one theme to organize your customer feedback',
    icon: <CategoryIcon />,
    route: ROUTES.THEMES,
    buttonLabel: 'Create Theme',
  },
];

export function OnboardingBlocker({
  isBlocked,
  missingItems = {
    companyDetails: false,
    dataSources: false,
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

  // Find the first incomplete step
  const getActiveStep = () => {
    if (missingItems.companyDetails) return 0;
    if (missingItems.dataSources) return 1;
    if (missingItems.themes) return 2;
    return 3; // All complete
  };

  const activeStep = getActiveStep();

  const handleNavigate = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const handleDismiss = () => {
    setOpen(false);
    onDismiss?.();
  };

  if (!open) return null;

  // Calculate progress
  const completedSteps = Object.values(missingItems).filter(missing => !missing).length;
  const totalSteps = Object.keys(missingItems).length;

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
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
        Welcome to Headway!
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Let's get you set up. Complete these {totalSteps - completedSteps} remaining step{totalSteps - completedSteps !== 1 ? 's' : ''} to start analyzing your customer feedback.
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {ONBOARDING_STEPS.map((step, index) => {
            const isComplete = !missingItems[step.key];
            const isActive = index === activeStep;

            return (
              <Step key={step.key} completed={isComplete}>
                <StepLabel
                  StepIconComponent={() => (
                    isComplete ? (
                      <CheckCircleIcon
                        sx={{
                          color: theme.palette.success.main,
                          fontSize: 28,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isActive 
                            ? theme.palette.primary.main 
                            : alpha(theme.palette.text.secondary, 0.2),
                          color: isActive ? '#fff' : theme.palette.text.secondary,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {index + 1}
                        </Typography>
                      </Box>
                    )
                  )}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: isComplete ? 'text.secondary' : 'text.primary',
                      textDecoration: isComplete ? 'line-through' : 'none',
                    }}
                  >
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {isComplete ? step.description : step.incompleteDescription}
                  </Typography>
                  {!isComplete && isActive && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleNavigate(step.route)}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                      }}
                    >
                      {step.buttonLabel}
                    </Button>
                  )}
                </StepContent>
              </Step>
            );
          })}
        </Stepper>

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
            Tip: Start by filling in your company details, then connect your data sources. Once you have data flowing in, create themes to organize your feedback.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={handleDismiss} variant="text" color="inherit">
          I'll do this later
        </Button>
        {activeStep < ONBOARDING_STEPS.length && (
          <Button
            onClick={() => handleNavigate(ONBOARDING_STEPS[activeStep].route)}
            variant="contained"
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            {ONBOARDING_STEPS[activeStep].buttonLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
