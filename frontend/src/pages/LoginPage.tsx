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
  CircularProgress
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
  const { login } = useAuthActions();
  const { isLoading } = useAuth();
  const navigate = useNavigate();

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
        </Box>
      </Container>
    </LandingLayout>
  );
}