/**
 * Login page for user authentication
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Link,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { LandingLayout } from '@/shared/components/layouts';
import { useAuthActions, useAuth } from '@/features/auth/store/auth-store';
import { useNavigate } from 'react-router-dom';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage(): JSX.Element {
  const [form, setForm] = useState<LoginForm>({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const { login, demoLogin } = useAuthActions();
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleChange = (field: keyof LoginForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await login({
        email: form.email,
        password: form.password,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    }
  };

  const fillDemoCredentials = () => {
    setForm({
      email: 'demo@headwayhq.com',
      password: 'demo123'
    });
  };

  return (
    <LandingLayout showAuth={false}>
      <Container maxWidth="sm">
        <Box 
          sx={{ 
            mt: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              width: '100%',
              maxWidth: 400,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Welcome back to HeadwayHQ
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                disabled={isLoading}
                autoFocus
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange('password')}
                disabled={isLoading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  'Sign In'
                )}
              </Button>
              <Box textAlign="center">
                <Link href="/register" variant="body2">
                  Don't have an account? Sign up
                </Link>
              </Box>
            </Box>
          </Paper>

          {/* Demo Section */}
          <Card sx={{
            mt: 3,
            width: '100%',
            maxWidth: 400,
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Chip
                  label="DEMO"
                  size="small"
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Try Demo Access
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                Explore HeadwayHQ with pre-loaded mock data including feature requests, themes, and analytics.
              </Typography>

              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.background.paper, 0.7),
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                mb: 2
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  DEMO CREDENTIALS
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <strong>Email:</strong> demo@headwayhq.com
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <strong>Password:</strong> demo123
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={fillDemoCredentials}
                  disabled={isLoading}
                  sx={{
                    flex: 1,
                    borderColor: alpha(theme.palette.info.main, 0.3),
                    color: theme.palette.info.main,
                    '&:hover': { 
                      borderColor: theme.palette.info.main,
                      bgcolor: alpha(theme.palette.info.main, 0.05),
                    },
                  }}
                >
                  Fill Form
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  sx={{
                    flex: 1,
                    background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                    '&:hover': { 
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 20px ${alpha(theme.palette.info.main, 0.3)}`,
                    },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    'Quick Demo'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </LandingLayout>
  );
}