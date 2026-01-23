/**
 * ProductTaxonomyStep Component
 * Step 2: Generate product taxonomy from URL
 * Two-phase UI: URL input → Theme review with smooth transition
 */

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  InputAdornment,
  Fade,
  Snackbar,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Language as LanguageIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useTaxonomyGeneration } from '../../hooks/useTaxonomyGeneration';
import { useOnboardingStore } from '../../store/onboardingStore';
import { ThemeReviewList } from '../shared/ThemeReviewList';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: 2,
    '& fieldset': {
      borderColor: '#e2e8f0',
    },
    '&:hover fieldset': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2563eb',
      borderWidth: 2,
    },
  },
  '& .MuiInputBase-input': {
    color: '#1e293b',
  },
  '& .MuiInputLabel-root': {
    color: '#64748b',
  },
};

export function ProductTaxonomyStep(): JSX.Element {
  const [inputUrl, setInputUrl] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const prevThemesLength = useRef(0);

  const {
    generate,
    isGenerating,
    isCompleted,
    hasFailed,
    error,
    themes,
  } = useTaxonomyGeneration();

  const { selectedThemes, url: savedUrl } = useOnboardingStore(
    (state) => state.taxonomyData
  );
  const toggleThemeSelection = useOnboardingStore(
    (state) => state.toggleThemeSelection
  );
  const setTaxonomySubStep = useOnboardingStore(
    (state) => state.setTaxonomySubStep
  );
  const setTaxonomyThemes = useOnboardingStore(
    (state) => state.setTaxonomyThemes
  );
  const setTaxonomyStatus = useOnboardingStore(
    (state) => state.setTaxonomyStatus
  );

  // Show toast when themes are generated
  useEffect(() => {
    if (themes.length > 0 && prevThemesLength.current === 0) {
      setShowSuccessToast(true);
    }
    prevThemesLength.current = themes.length;
  }, [themes.length]);

  // Update sub-step based on completion state
  useEffect(() => {
    if (isCompleted && themes.length > 0) {
      setTaxonomySubStep('review-themes');
    } else {
      setTaxonomySubStep('website-url');
    }
  }, [isCompleted, themes.length, setTaxonomySubStep]);

  // Initialize input URL from saved URL
  useEffect(() => {
    if (savedUrl && !inputUrl) {
      setInputUrl(savedUrl);
    }
  }, [savedUrl, inputUrl]);

  const handleGenerate = () => {
    if (inputUrl.trim()) {
      generate(inputUrl.trim());
    }
  };

  const handleRegenerate = () => {
    setTaxonomyThemes([]);
    setTaxonomyStatus('idle');
    setTaxonomySubStep('website-url');
  };

  // Phase 1: URL Input
  if (!isCompleted || themes.length === 0) {
    return (
      <Fade in timeout={300}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* URL Input Section */}
          <Box
            sx={{
              bgcolor: 'white',
              borderRadius: 2,
              p: 2.5,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  bgcolor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LanguageIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#1e293b',
                  }}
                >
                  Enter your website URL
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  We'll analyze your docs to understand your product
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                fullWidth
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://help.yourcompany.com"
                disabled={isGenerating}
                size="small"
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LanguageIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputUrl.trim() && !isGenerating) {
                    handleGenerate();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={!inputUrl.trim() || isGenerating}
                startIcon={
                  isGenerating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                  )
                }
                sx={{
                  whiteSpace: 'nowrap',
                  px: 2.5,
                  textTransform: 'none',
                  bgcolor: '#2563eb',
                  borderRadius: 1.5,
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: '#1d4ed8',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  },
                  '&:disabled': {
                    bgcolor: '#cbd5e1',
                  },
                }}
              >
                {isGenerating ? 'Analyzing...' : 'Generate'}
              </Button>
            </Box>

            {hasFailed && error && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  borderRadius: 1.5,
                  bgcolor: '#fef2f2',
                  border: '1px solid #fecaca',
                  py: 0.5,
                  fontSize: '0.75rem',
                }}
              >
                {error}
              </Alert>
            )}
          </Box>

          {/* Generating Animation */}
          {isGenerating && (
            <Fade in timeout={500}>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    mb: 2.5,
                  }}
                >
                  <CircularProgress
                    size={48}
                    thickness={3}
                    sx={{ color: '#2563eb' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <AutoAwesomeIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    color: '#1e293b',
                    mb: 0.25,
                  }}
                >
                  Analyzing your website
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    textAlign: 'center',
                  }}
                >
                  Crawling docs to understand product categories...
                </Typography>
              </Box>
            </Fade>
          )}

          {/* Empty State */}
          {!isGenerating && (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
                mt: 3,
                borderRadius: 2,
                border: '2px dashed #e2e8f0',
                bgcolor: 'white',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.5,
                  bgcolor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 24, color: '#94a3b8' }} />
              </Box>
              <Typography
                sx={{
                  color: '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  mb: 0.25,
                }}
              >
                AI-powered taxonomy generation
              </Typography>
              <Typography
                sx={{
                  color: '#64748b',
                  fontSize: '0.75rem',
                  maxWidth: 280,
                  textAlign: 'center',
                }}
              >
                Enter your help center URL above to auto-generate product themes
              </Typography>
            </Box>
          )}
        </Box>
      </Fade>
    );
  }

  // Phase 2: Review Themes
  return (
    <Fade in timeout={300}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Theme Review List */}
        <ThemeReviewList
          themes={themes}
          selectedThemes={selectedThemes}
          onToggleTheme={toggleThemeSelection}
          onRegenerate={handleRegenerate}
        />

        {/* Success Toast */}
        <Snackbar
          open={showSuccessToast}
          autoHideDuration={3000}
          onClose={() => setShowSuccessToast(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setShowSuccessToast(false)}
            severity="success"
            icon={<CheckCircleIcon fontSize="small" />}
            sx={{
              borderRadius: 2,
              bgcolor: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              '& .MuiAlert-icon': {
                color: '#22c55e',
              },
            }}
          >
            Themes generated successfully!
          </Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
}
