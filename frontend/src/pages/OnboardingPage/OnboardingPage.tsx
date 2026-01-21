/**
 * OnboardingPage Component
 * Full-page immersive onboarding experience with split layout
 * Left: Navigation sidebar | Right: Content area
 * State is persisted both locally (zustand/persist) and server-side (onboarding_progress table)
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Link, Fade } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAuthStore, useAuthActions, useUser } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/lib/constants/routes';

import { OnboardingSidebar } from './components/OnboardingSidebar';
import { CompanySetupStep } from './components/steps/CompanySetupStep';
import { ProductTaxonomyStep } from './components/steps/ProductTaxonomyStep';
import { DataSourcesStep } from './components/steps/DataSourcesStep';
import { CompetitorsStep } from './components/steps/CompetitorsStep';

import {
  useOnboardingStore,
  useCurrentStep,
  useCompletedSteps,
  useCompanyData,
  useTaxonomySubStep,
} from './store/onboardingStore';
import { onboardingApi } from './services/onboarding-api';

const TOTAL_STEPS = 4;

// Step titles and descriptions for the content area
const STEP_CONTENT = [
  {
    title: 'Company setup',
    description: 'Tell us about your company and what you do.',
  },
  {
    title: 'Product taxonomy',
    description: 'We\'ll analyze your website to generate product categories.',
  },
  {
    title: 'Connect data sources',
    description: 'Connect your tools to start gathering customer insights.',
  },
  {
    title: 'Add competitors',
    description: 'Track what customers say about your competition.',
  },
];

export function OnboardingPage(): JSX.Element {
  const navigate = useNavigate();
  const [isCompleting, setIsCompleting] = useState(false);

  const user = useUser();
  const tokens = useAuthStore((state) => state.tokens);
  // Use workspace_id from tokens (returned by login/refresh endpoints)
  const workspaceId = tokens?.workspace_id;
  const { refreshToken, setUser } = useAuthActions();

  const currentStep = useCurrentStep();
  const completedSteps = useCompletedSteps();
  const companyData = useCompanyData();
  const taxonomySubStep = useTaxonomySubStep();

  const {
    goToNextStep,
    goToPreviousStep,
    resetWizard,
    loadProgress,
    saveProgress,
    saveCompanyData,
    isLoading,
    isSaving,
  } = useOnboardingStore();

  // If workspace_id is missing from tokens, refresh to get it
  useEffect(() => {
    if (!workspaceId && tokens?.refresh_token) {
      refreshToken().catch((err) => {
        console.error('Failed to refresh token for workspace_id:', err);
      });
    }
  }, [workspaceId, tokens?.refresh_token, refreshToken]);

  // Load progress from server on mount
  useEffect(() => {
    if (workspaceId) {
      loadProgress(workspaceId);
    }
  }, [workspaceId, loadProgress]);

  // Redirect if already completed (safety check)
  useEffect(() => {
    if (user?.onboarding_completed) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [user?.onboarding_completed, navigate]);

  // Validate current step
  const isStepValid = useCallback((): boolean => {
    switch (currentStep) {
      case 0:
        return !!(companyData.name.trim() && companyData.industry);
      case 1:
      case 2:
      case 3:
        return true;
      default:
        return false;
    }
  }, [currentStep, companyData]);

  // Handle continue click
  const handleContinue = useCallback(async () => {
    if (currentStep < TOTAL_STEPS - 1) {
      // Save company data to companies table when leaving step 0
      if (currentStep === 0 && workspaceId) {
        try {
          await saveCompanyData(workspaceId);
        } catch (err) {
          console.error('Failed to save company data:', err);
          return; // Don't proceed if save fails
        }
      }

      goToNextStep();

      // Save progress to server after moving to next step
      if (workspaceId) {
        // Use setTimeout to ensure state is updated before saving
        setTimeout(() => {
          saveProgress(workspaceId);
        }, 100);
      }
    } else {
      // Complete onboarding
      setIsCompleting(true);
      try {
        // Save final progress before completing
        if (workspaceId) {
          await saveProgress(workspaceId);
        }
        // Complete onboarding and get updated user with onboarding_completed = true
        const updatedUser = await onboardingApi.completeOnboarding();
        // Update user state so ProtectedRoute sees onboarding_completed = true
        setUser(updatedUser);
        resetWizard(); // Clear local state
        navigate(ROUTES.DASHBOARD, { replace: true });
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
        setIsCompleting(false);
      }
    }
  }, [workspaceId, currentStep, goToNextStep, saveCompanyData, saveProgress, resetWizard, setUser, navigate]);

  // Handle back click
  const handleBack = useCallback(() => {
    goToPreviousStep();
  }, [goToPreviousStep]);

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <CompanySetupStep />;
      case 1:
        return <ProductTaxonomyStep />;
      case 2:
        return <DataSourcesStep />;
      case 3:
        return <CompetitorsStep />;
      default:
        return null;
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const stepContent = STEP_CONTENT[currentStep];

  // Show loading state while loading progress from server
  if (isLoading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f1f5f9',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        bgcolor: '#f1f5f9',
        overflow: 'hidden',
      }}
    >
      {/* Left Sidebar - Navigation */}
      <OnboardingSidebar
        currentStep={currentStep}
        completedSteps={completedSteps}
        taxonomySubStep={taxonomySubStep}
      />

      {/* Right Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Top bar with help link */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            px: 4,
            py: 2,
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8125rem',
              color: '#64748b',
            }}
          >
            Having troubles?{' '}
            <Link
              href="#"
              sx={{
                color: '#2563eb',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Get Help
            </Link>
          </Typography>
        </Box>

        {/* Main content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            px: { xs: 3, sm: 5, md: 8, lg: 12 },
            pb: 3,
            maxWidth: 720,
            overflowY: 'auto',
            overflowX: 'hidden',
            // Hide scrollbar but keep functionality
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            '&::-webkit-scrollbar': {
              display: 'none', // Chrome/Safari/Opera
            },
          }}
        >
          {/* Step title and description */}
          <Fade in key={`header-${currentStep}`} timeout={300}>
            <Box sx={{ mb: 2.5, flexShrink: 0 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: '#1e293b',
                  mb: 0.5,
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                }}
              >
                {stepContent.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                }}
              >
                {stepContent.description}
              </Typography>
            </Box>
          </Fade>

          {/* Step content */}
          <Fade in key={`content-${currentStep}`} timeout={300}>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              {renderStepContent()}
            </Box>
          </Fade>

          {/* Navigation buttons - always visible at bottom */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 3,
              flexShrink: 0,
            }}
          >
            {/* Back button */}
            {!isFirstStep ? (
              <Button
                onClick={handleBack}
                startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
                sx={{
                  textTransform: 'uppercase',
                  color: '#64748b',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  letterSpacing: '0.05em',
                  py: 1,
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                Previous
              </Button>
            ) : (
              <Box />
            )}

            {/* Continue / Finish button */}
            <Button
              variant="contained"
              onClick={handleContinue}
              disabled={!isStepValid() || isCompleting || isSaving}
              sx={{
                textTransform: 'none',
                px: 4,
                py: 1.25,
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: 1.5,
                bgcolor: '#1e293b',
                boxShadow: 'none',
                minWidth: 120,
                '&:hover': {
                  bgcolor: '#0f172a',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
                '&:disabled': {
                  bgcolor: '#cbd5e1',
                  color: '#94a3b8',
                },
              }}
            >
              {isCompleting || isSaving ? (
                <CircularProgress size={18} color="inherit" />
              ) : isLastStep ? (
                'Finish Setup'
              ) : (
                <>
                  Next
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    &rarr;
                  </Box>
                </>
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
