/**
 * OnboardingSidebar Component
 * Left sidebar with logo, vertical step navigation, and decorative illustration
 */

import { Box, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { ONBOARDING_STEPS, type TaxonomySubStep } from '../types';

interface OnboardingSidebarProps {
  currentStep: number;
  completedSteps: number[];
  taxonomySubStep?: TaxonomySubStep;
}

export function OnboardingSidebar({
  currentStep,
  completedSteps,
  taxonomySubStep = 'website-url',
}: OnboardingSidebarProps): JSX.Element {
  return (
    <Box
      sx={{
        width: 320,
        minHeight: '100vh',
        bgcolor: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Logo - positioned at top */}
      <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>
              H
            </Typography>
          </Box>
          <Typography
            sx={{
              fontWeight: 600,
              color: '#1e293b',
              fontSize: '1.125rem',
              letterSpacing: '-0.02em',
            }}
          >
            Headway
          </Typography>
        </Box>
      </Box>

      {/* Step Navigation */}
      <Box sx={{ px: 2 }}>
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isExpanded = isCurrent && step.subSteps && step.subSteps.length > 0;

          return (
            <Box key={step.id} sx={{ mb: 0.5 }}>
              {/* Main step item */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  bgcolor: isCurrent ? 'white' : 'transparent',
                  boxShadow: isCurrent ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Step indicator */}
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isCompleted
                      ? '#22c55e'
                      : isCurrent
                        ? '#2563eb'
                        : '#e2e8f0',
                    color: isCompleted || isCurrent ? 'white' : '#94a3b8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isCompleted ? (
                    <CheckIcon sx={{ fontSize: 16 }} />
                  ) : (
                    index + 1
                  )}
                </Box>

                {/* Step label */}
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isCurrent
                      ? '#1e293b'
                      : isCompleted
                        ? '#22c55e'
                        : '#64748b',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    flex: 1,
                  }}
                >
                  {step.label}
                </Typography>
              </Box>

              {/* Sub-steps (expanded when current) */}
              {isExpanded && step.subSteps && (
                <Box sx={{ ml: 6, mt: 0.5, mb: 1 }}>
                  {step.subSteps.map((subStep) => {
                    const isActiveSubStep = taxonomySubStep === subStep.id;
                    return (
                      <Box
                        key={subStep.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 0.75,
                          px: 2,
                          borderRadius: 1,
                          bgcolor: isActiveSubStep ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: isActiveSubStep ? '#2563eb' : '#cbd5e1',
                            transition: 'all 0.2s ease',
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: '0.8125rem',
                            color: isActiveSubStep ? '#2563eb' : '#64748b',
                            fontWeight: isActiveSubStep ? 600 : 400,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {subStep.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Decorative Illustration - pushed to bottom */}
      <Box
        sx={{
          mt: 'auto',
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <Box
          sx={{
            width: 140,
            height: 100,
            position: 'relative',
          }}
        >
          {/* Document stack illustration */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 70,
              height: 85,
              bgcolor: '#dbeafe',
              borderRadius: 1.5,
              border: '2px solid #93c5fd',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%) rotate(-5deg)',
              width: 62,
              height: 75,
              bgcolor: '#bfdbfe',
              borderRadius: 1.5,
              border: '2px solid #60a5fa',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%) rotate(5deg)',
              width: 54,
              height: 65,
              bgcolor: '#2563eb',
              borderRadius: 1.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
            }}
          >
            {/* Document lines */}
            {[1, 2, 3].map((line) => (
              <Box
                key={line}
                sx={{
                  width: '60%',
                  height: 4,
                  bgcolor: 'rgba(255,255,255,0.3)',
                  borderRadius: 0.5,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
