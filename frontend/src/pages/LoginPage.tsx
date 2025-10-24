/**
 * Login page for user authentication with Google Sign-In
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { LandingLayout } from '@/shared/components/layouts';
import { useAuthActions, useAuth } from '@/features/auth/store/auth-store';
import { useNavigate } from 'react-router-dom';

export function LoginPage(): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const { googleLogin } = useAuthActions();
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    if (!credentialResponse.credential) {
      setError('Failed to get Google credential');
      return;
    }

    try {
      await googleLogin({
        credential: credentialResponse.credential,
      });
      navigate('/app/themes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
    }
  };

  const handleGoogleError = () => {
    setError('Failed to login with Google');
  };

  return (
    <LandingLayout showAuth={false}>
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Artistic Background */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.mode === 'dark' ? '#1a1a2e' : '#f5f7fa',
              1
            )} 0%, ${alpha(theme.palette.mode === 'dark' ? '#16213e' : '#eef2f5', 1)} 100%)`,
            overflow: 'hidden',
          }}
        >
          {/* SVG Background Elements */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1200 800"
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 1,
            }}
          >
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#667eea" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#764ba2" stopOpacity="0.15" />
              </linearGradient>
              <filter id="blur">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
              </filter>
            </defs>

            {/* Large circles - background elements */}
            <circle cx="100" cy="100" r="200" fill="url(#grad1)" filter="url(#blur)" />
            <circle cx="1100" cy="700" r="250" fill="url(#grad1)" filter="url(#blur)" />
            <circle cx="600" cy="400" r="300" fill="url(#grad1)" opacity="0.12" filter="url(#blur)" />

            {/* Organic curved lines */}
            <path
              d="M 0 200 Q 300 100 600 150 T 1200 200"
              stroke="url(#grad1)"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M 0 600 Q 400 500 800 550 T 1200 600"
              stroke="url(#grad1)"
              strokeWidth="2"
              fill="none"
              opacity="0.25"
            />

            {/* Floating geometric shapes */}
            <g opacity="0.15">
              <rect x="150" y="300" width="100" height="100" fill="#667eea" transform="rotate(45 200 350)" />
              <rect x="950" y="200" width="120" height="120" fill="#764ba2" transform="rotate(25 1010 260)" />
            </g>
          </svg>

          {/* Gradient overlay for depth */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 60% 40%, ${alpha(
                theme.palette.mode === 'dark' ? '#667eea' : '#667eea',
                0.05
              )} 0%, transparent 50%)`,
              pointerEvents: 'none',
            }}
          />
        </Box>

        {/* Content Container */}
        <Container maxWidth="lg">
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              py: 8,
            }}
          >
            {/* Hero Section */}
            <Box
              sx={{
                textAlign: 'center',
                mb: 6,
                maxWidth: 600,
              }}
            >
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                HeadwayHQ
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 500,
                  mb: 2,
                  color: 'text.primary',
                }}
              >
                Capture every customer insight
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                }}
              >
                Turn customer feedback from Slack into actionable product insights. Organized by themes, powered by AI.
              </Typography>
            </Box>

            {/* Login Card */}
            <Paper
              elevation={0}
              sx={{
                padding: 5,
                width: '100%',
                maxWidth: 480,
                background: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 3,
              }}
            >
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    color: 'text.primary',
                  }}
                >
                  Get started
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Sign in with your Google account to access your workspace
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  mb: 3,
                }}
              >
                {isLoading ? (
                  <CircularProgress size={48} />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      '& > div': {
                        width: '100% !important',
                      },
                    }}
                  >
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="outline"
                      size="large"
                      width="480"
                    />
                  </Box>
                )}
              </Box>

              {/* Features List */}
              <Box
                sx={{
                  mt: 4,
                  pt: 3,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 500,
                    mb: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  What you'll get
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                  }}
                >
                  {['AI-powered feature extraction', 'Intelligent duplicate detection', 'Theme-based organization'].map(
                    (feature) => (
                      <Typography
                        key={feature}
                        variant="body2"
                        sx={{
                          py: 0.75,
                          color: 'text.secondary',
                          display: 'flex',
                          alignItems: 'center',
                          '&:before': {
                            content: '"✓"',
                            display: 'inline-block',
                            mr: 1.5,
                            color: 'success.main',
                            fontWeight: 700,
                          },
                        }}
                      >
                        {feature}
                      </Typography>
                    )
                  )}
                </Box>
              </Box>
            </Paper>

            {/* Footer */}
            <Typography
              variant="caption"
              sx={{
                mt: 4,
                color: 'text.secondary',
                textAlign: 'center',
              }}
            >
              By signing in, you agree to our{' '}
              <Typography
                component="a"
                variant="caption"
                href="#"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Terms of Service
              </Typography>{' '}
              and{' '}
              <Typography
                component="a"
                variant="caption"
                href="#"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Privacy Policy
              </Typography>
            </Typography>
            </Box>
          </Container>
        </Box>
    </LandingLayout>
  );
}