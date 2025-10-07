/**
 * Registration page for new users
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
  MenuItem,
  Grid
} from '@mui/material';
import { LandingLayout } from '@/shared/components/layouts';
import { API_BASE_URL } from '@/config/api.config';

interface RegisterForm {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companySize: string;
  jobTitle: string;
  password: string;
  confirmPassword: string;
}

const companySizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' }
];

export function RegisterPage(): JSX.Element {
  const [form, setForm] = useState<RegisterForm>({
    email: '',
    firstName: '',
    lastName: '',
    companyName: '',
    companySize: '',
    jobTitle: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof RegisterForm) => (
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
    
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    if (!form.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (!form.companySize) {
      setError('Please select your company size');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('${API_BASE_URL}/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          company_name: form.companyName,
          company_size: form.companySize,
          job_title: form.jobTitle || null,
          password: form.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        window.location.href = '/dashboard';
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
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
              maxWidth: 500,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Get Started
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Create your HeadwayHQ account. If your company exists, you'll join it automatically.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="firstName"
                    label="First Name"
                    name="firstName"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={handleChange('firstName')}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="lastName"
                    label="Last Name"
                    name="lastName"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={handleChange('lastName')}
                    disabled={loading}
                  />
                </Grid>
              </Grid>

              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Work Email Address"
                name="email"
                autoComplete="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                disabled={loading}
                helperText="Use your company email address"
              />

              <TextField
                margin="normal"
                required
                fullWidth
                id="companyName"
                label="Company Name"
                name="companyName"
                autoComplete="organization"
                value={form.companyName}
                onChange={handleChange('companyName')}
                disabled={loading}
                helperText="Enter your existing company name or create a new one"
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    select
                    id="companySize"
                    label="Company Size"
                    name="companySize"
                    value={form.companySize}
                    onChange={handleChange('companySize')}
                    disabled={loading}
                  >
                    {companySizeOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="normal"
                    fullWidth
                    id="jobTitle"
                    label="Job Title (Optional)"
                    name="jobTitle"
                    autoComplete="organization-title"
                    value={form.jobTitle}
                    onChange={handleChange('jobTitle')}
                    disabled={loading}
                    placeholder="e.g. Product Manager"
                  />
                </Grid>
              </Grid>

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange('password')}
                disabled={loading}
                helperText="Must be at least 8 characters"
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                id="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  'Create Account'
                )}
              </Button>
              <Box textAlign="center">
                <Link href="/login" variant="body2">
                  Already have an account? Sign in
                </Link>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    </LandingLayout>
  );
}