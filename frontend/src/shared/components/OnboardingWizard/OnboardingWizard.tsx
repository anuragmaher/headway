/**
 * Onboarding Wizard Component
 * Multi-step wizard for new user onboarding
 * Automatically skips completed steps and starts at the first incomplete step
 */

import { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Storage as StorageIcon,
  Category as CategoryIcon,
  Groups as GroupsIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '@/shared/store/onboardingStore';
import { companyService, type CompanyDetails } from '@/services/company';
import { API_BASE_URL } from '@/config/api.config';

import { CompanyDetailsStep } from './CompanyDetailsStep';
import { DataSourcesStep, DEFAULT_DATA_SOURCES } from './DataSourcesStep';
import { CreateThemeStep, type SelectedTheme } from './CreateThemeStep';
import { CompetitorsStep, type Competitor } from './CompetitorsStep';
import { STEPS, OnboardingWizardProps } from './types';

export function OnboardingWizard({
  open,
  onComplete,
  onDismiss,
}: OnboardingWizardProps): JSX.Element {
  const theme = useTheme();
  const tokens = useAuthStore((state) => state.tokens);
  const workspaceId = tokens?.workspace_id;
  const accessToken = tokens?.access_token;

  // Get current onboarding status to determine starting step
  const onboardingStatus = useOnboardingStore((state) => state.onboardingStatus);

  // Step management
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Company details state
  const [companyData, setCompanyData] = useState<CompanyDetails>({
    name: '',
    website: '',
    size: '',
    description: '',
  });


  // Theme creation state - multiple themes
  const [selectedThemes, setSelectedThemes] = useState<SelectedTheme[]>([]);

  // Competitors state
  const [selectedCompetitors, setSelectedCompetitors] = useState<Competitor[]>([]);

  // Determine the starting step based on onboarding status
  useEffect(() => {
    const determineStartingStep = async () => {
      if (!open || !workspaceId || !accessToken) {
        setInitializing(false);
        return;
      }

      console.log('[OnboardingWizard] Determining starting step...');
      console.log('[OnboardingWizard] Status:', onboardingStatus);

      // Find the first incomplete step
      let startStep = 0;
      
      // Check if we have a stored step to continue from (after Gmail label selection)
      // This takes priority over status-based step determination
      const continueStep = localStorage.getItem('onboarding-continue-step');
      if (continueStep) {
        const stepNum = parseInt(continueStep, 10);
        if (!isNaN(stepNum) && stepNum >= 0 && stepNum < STEPS.length) {
          startStep = stepNum;
          localStorage.removeItem('onboarding-continue-step');
          console.log('[OnboardingWizard] Continuing from stored step:', startStep);
          setActiveStep(startStep);
          setInitializing(false);
          return; // Early return to skip normal step determination
        }
      }
      
      // Also check if Gmail was just connected (even if status not updated yet)
      // This is a fallback if the continue step was cleared too early
      const gmailJustConnected = localStorage.getItem('gmail-oauth-success') === 'true';
      if (gmailJustConnected && onboardingStatus.companyDetails) {
        // Gmail is connected, so data sources are complete, go to Themes
        startStep = 2;
        localStorage.removeItem('gmail-oauth-success');
        console.log('[OnboardingWizard] Gmail just connected, going to Themes step');
        setActiveStep(startStep);
        setInitializing(false);
        return;
      }
      
      // Normal flow: determine step based on completion status
      // If company details are complete, skip to data sources
      if (onboardingStatus.companyDetails) {
        startStep = 1; // Skip to data sources
        console.log('[OnboardingWizard] Company details complete, skipping step 0');
      }
      
      // If both company details and data sources are complete, skip to themes
      if (onboardingStatus.companyDetails && onboardingStatus.dataSources) {
        startStep = 2; // Skip to themes
        console.log('[OnboardingWizard] Data sources complete, skipping step 1');
      }
      

      // Load existing company data if available (for display purposes)
      if (startStep === 0) {
        try {
          const existingData = await companyService.getCompanyDetails(workspaceId);
          if (existingData) {
            setCompanyData(existingData);
          }
        } catch (err) {
          console.log('[OnboardingWizard] Could not load existing company data');
        }
      }

      setActiveStep(startStep);
      setInitializing(false);
      console.log('[OnboardingWizard] Starting at step:', startStep);
    };

    determineStartingStep();
  }, [open, workspaceId, accessToken, onboardingStatus]);

  // Check if step is valid
  const isStepValid = () => {
    switch (activeStep) {
      case 0: // Company details
        return companyData.name.trim() !== '' && companyData.website.trim() !== '' && companyData.size !== '';
      case 1: // Data sources - optional, can skip
        return true;
      case 2: // Theme - need at least one theme selected
        return selectedThemes.length > 0;
      case 3: // Competitors - optional, can skip
        return true;
      default:
        return false;
    }
  };

  // Handle next step
  const handleNext = async () => {
    setError(null);

    if (activeStep === 0) {
      // Save company details
      if (!workspaceId) {
        setError('Workspace not found. Please try logging in again.');
        return;
      }

      setLoading(true);
      try {
        await companyService.updateCompanyDetails(workspaceId, companyData);
        setActiveStep(1);
      } catch (err) {
        console.error('Failed to save company details:', err);
        setError('Failed to save company details. Please try again.');
      } finally {
        setLoading(false);
      }
    } else if (activeStep === 1) {
      // Data sources step - just move to next
      setActiveStep(2);
    } else if (activeStep === 2) {
      // Create all selected themes and move to competitors
      if (!workspaceId || !accessToken) {
        setError('Workspace not found. Please try logging in again.');
        return;
      }

      if (selectedThemes.length === 0) {
        setError('Please select at least one theme.');
        return;
      }

      setLoading(true);
      try {
        // Create all themes in parallel
        const createPromises = selectedThemes.map(themeData =>
          fetch(
            `${API_BASE_URL}/api/v1/features/themes?workspace_id=${workspaceId}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: themeData.name,
                description: themeData.description,
              }),
            }
          )
        );

        const responses = await Promise.all(createPromises);
        
        // Check if any failed
        const failedCount = responses.filter(r => !r.ok).length;
        if (failedCount > 0) {
          throw new Error(`Failed to create ${failedCount} theme(s)`);
        }

        // Move to competitors step
        setActiveStep(3);
      } catch (err) {
        console.error('Failed to create themes:', err);
        setError('Failed to create themes. Please try again.');
      } finally {
        setLoading(false);
      }
    } else if (activeStep === 3) {
      // Save competitors and complete onboarding
      if (!workspaceId || !accessToken) {
        setError('Workspace not found. Please try logging in again.');
        return;
      }

      setLoading(true);
      try {
        // Save competitors if any selected
        if (selectedCompetitors.length > 0) {
          const response = await fetch(
            `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                competitors: selectedCompetitors,
              }),
            }
          );

          if (!response.ok) {
            console.warn('Failed to save competitors, continuing anyway');
          }
        }

        // Complete onboarding
        onComplete();
      } catch (err) {
        console.error('Failed to save competitors:', err);
        // Don't block completion, just log the error
        onComplete();
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle back step - only go back to incomplete steps
  const handleBack = () => {
    let prevStep = activeStep - 1;
    
    // Skip completed steps when going back
    while (prevStep >= 0) {
      if (prevStep === 0 && onboardingStatus.companyDetails) {
        prevStep--;
        continue;
      }
      if (prevStep === 1 && onboardingStatus.dataSources) {
        prevStep--;
        continue;
      }
      break;
    }
    
    if (prevStep >= 0) {
      setActiveStep(prevStep);
      setError(null);
    }
  };

  // Check if back button should be shown
  const canGoBack = () => {
    if (activeStep === 0) return false;
    
    // Check if there's any incomplete step before the current one
    for (let i = activeStep - 1; i >= 0; i--) {
      if (i === 0 && !onboardingStatus.companyDetails) return true;
      if (i === 1 && !onboardingStatus.dataSources) return true;
    }
    return false;
  };

  // Get step icon
  const getStepIcon = (step: number) => {
    switch (step) {
      case 0:
        return <BusinessIcon sx={{ fontSize: 14 }} />;
      case 1:
        return <StorageIcon sx={{ fontSize: 14 }} />;
      case 2:
        return <CategoryIcon sx={{ fontSize: 14 }} />;
      case 3:
        return <GroupsIcon sx={{ fontSize: 14 }} />;
      default:
        return null;
    }
  };

  // Check if a step is completed
  const isStepCompleted = (step: number) => {
    switch (step) {
      case 0:
        return onboardingStatus.companyDetails || activeStep > 0;
      case 1:
        return onboardingStatus.dataSources || activeStep > 1;
      case 2:
        // Themes is completed if we're on competitors step (step 3) or if onboarding says so
        return onboardingStatus.themes || activeStep > 2;
      case 3:
        return false; // Competitors is the last step
      default:
        return false;
    }
  };

  // Render step content
  const renderStepContent = () => {
    if (initializing) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }

    switch (activeStep) {
      case 0:
        return (
          <CompanyDetailsStep
            companyData={companyData}
            setCompanyData={setCompanyData}
            workspaceId={workspaceId || ''}
            setError={setError}
          />
        );
      case 1:
        return (
          <DataSourcesStep
            dataSources={DEFAULT_DATA_SOURCES}
            setError={setError}
            workspaceId={workspaceId}
          />
        );
      case 2:
        return (
          <CreateThemeStep
            selectedThemes={selectedThemes}
            setSelectedThemes={setSelectedThemes}
            workspaceId={workspaceId || ''}
            setError={setError}
          />
        );
      case 3:
        return (
          <CompetitorsStep
            selectedCompetitors={selectedCompetitors}
            setSelectedCompetitors={setSelectedCompetitors}
            workspaceId={workspaceId || ''}
            accessToken={accessToken || ''}
            setError={setError}
          />
        );
      default:
        return null;
    }
  };

  // Calculate button label
  const getButtonLabel = () => {
    if (loading) return 'Saving...';
    if (activeStep === 1) return 'Skip';
    if (activeStep === 3) return selectedCompetitors.length > 0 ? 'Complete Setup' : 'Skip & Complete';
    if (activeStep === STEPS.length - 1) return 'Complete Setup';
    return 'Continue';
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
          maxHeight: '90vh',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, pt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Welcome to Headway!
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Let's get you set up in just a few steps
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 1, overflow: 'visible' }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
          {STEPS.map((label, index) => {
            const completed = isStepCompleted(index);
            const isActive = index === activeStep;
            const isPast = index < activeStep || completed;

            return (
              <Step key={label} completed={completed}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: completed
                          ? theme.palette.success.main
                          : isActive
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.secondary, 0.2),
                        color: isPast || isActive ? '#fff' : theme.palette.text.secondary,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {completed ? <CheckIcon sx={{ fontSize: 14 }} /> : getStepIcon(index)}
                    </Box>
                  )}
                />
              </Step>
            );
          })}
        </Stepper>

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, py: 0 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step content */}
        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onDismiss} color="inherit" size="small" disabled={loading || initializing}>
          I'll do this later
        </Button>
        <Box sx={{ flex: 1 }} />
        {canGoBack() && (
          <Button onClick={handleBack} size="small" disabled={loading || initializing}>
            Back
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={handleNext}
          disabled={!isStepValid() || loading || initializing}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{
            borderRadius: 1.5,
            px: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }}
        >
          {getButtonLabel()}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
