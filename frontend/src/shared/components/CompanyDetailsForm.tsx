/**
 * Company Details Form Component
 * Displays company information collected during onboarding
 * Fields: Company Name, Website, Industry, Team Size, Role
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Snackbar,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Edit as EditIcon,
  Language as LanguageIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

interface CompanyDetails {
  id?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  role?: string;
}

interface CompanyDetailsFormProps {
  companyData: CompanyDetails;
  onSave: (data: CompanyDetails) => Promise<void>;
  isLoading?: boolean;
}

const INDUSTRIES = [
  'SaaS / Software',
  'E-commerce',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Marketing',
  'HR / Recruiting',
  'Developer Tools',
  'Security',
  'Analytics',
  'Other',
];

const TEAM_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
];

const ROLES = [
  'Product Manager',
  'Engineering',
  'Design',
  'Customer Success',
  'Sales',
  'Marketing',
  'Founder / Executive',
  'Other',
];

export function CompanyDetailsForm({
  companyData,
  onSave,
  isLoading = false,
}: CompanyDetailsFormProps): JSX.Element {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyDetails>(companyData);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleOpenDialog = () => {
    setFormData(companyData);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setErrorMessage('');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    const { name, value } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (field: keyof CompanyDetails) => (e: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSaveDetails = async () => {
    if (!formData.name || !formData.industry) {
      setErrorMessage('Please fill in all required fields');
      setSnackbarOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      setSuccessMessage('Company details saved successfully!');
      setSnackbarOpen(true);
      handleCloseDialog();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save company details');
      setSnackbarOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = formData.name && formData.industry;
  const isEdited = JSON.stringify(formData) !== JSON.stringify(companyData);

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BusinessIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                mb: 0.25,
                fontSize: '1.1rem',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}
            >
              Company Details
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.875rem',
                lineHeight: 1.4,
                fontWeight: 400,
              }}
            >
              Manage your company information
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={handleOpenDialog}
              disabled={isLoading}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                px: 2,
              }}
            >
              Edit
            </Button>
          </Box>
        </Box>

        {/* Company Info Display */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Company Name
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {companyData.name || 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Website
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  color: companyData.website ? theme.palette.info.main : 'text.secondary',
                  cursor: companyData.website ? 'pointer' : 'default',
                  '&:hover': companyData.website ? {
                    textDecoration: 'underline',
                  } : {},
                  transition: 'all 0.2s ease-in-out',
                }}
                onClick={() => {
                  if (companyData.website) {
                    const url = companyData.website.startsWith('http')
                      ? companyData.website
                      : `https://${companyData.website}`;
                    window.open(url, '_blank');
                  }
                }}
              >
                {companyData.website || 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Industry
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {companyData.industry || 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Team Size
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {companyData.teamSize ? `${companyData.teamSize} employees` : 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Your Role
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {companyData.role || 'Not set'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Company Details</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Company Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Company Name *"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isLoading}
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Website */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Website"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                disabled={isLoading}
                variant="outlined"
                placeholder="https://example.com"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LanguageIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Industry */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Industry *</InputLabel>
                <Select
                  name="industry"
                  value={formData.industry || ''}
                  onChange={handleSelectChange('industry')}
                  label="Industry *"
                  disabled={isLoading}
                  startAdornment={
                    <InputAdornment position="start">
                      <CategoryIcon sx={{ color: 'text.secondary', fontSize: 20, ml: 0.5 }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">
                    <em>Select an industry</em>
                  </MenuItem>
                  {INDUSTRIES.map(industry => (
                    <MenuItem key={industry} value={industry}>
                      {industry}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Team Size */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Team Size</InputLabel>
                <Select
                  name="teamSize"
                  value={formData.teamSize || ''}
                  onChange={handleSelectChange('teamSize')}
                  label="Team Size"
                  disabled={isLoading}
                  startAdornment={
                    <InputAdornment position="start">
                      <PeopleIcon sx={{ color: 'text.secondary', fontSize: 20, ml: 0.5 }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {TEAM_SIZES.map(size => (
                    <MenuItem key={size} value={size}>
                      {size} employees
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Role */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Your Role</InputLabel>
                <Select
                  name="role"
                  value={formData.role || ''}
                  onChange={handleSelectChange('role')}
                  label="Your Role"
                  disabled={isLoading}
                  startAdornment={
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'text.secondary', fontSize: 20, ml: 0.5 }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {ROLES.map(role => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} disabled={isLoading || isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveDetails}
            variant="contained"
            disabled={!isFormValid || isLoading || isSaving || !isEdited}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={errorMessage ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {errorMessage || successMessage}
        </Alert>
      </Snackbar>
    </Card>
  );
}
