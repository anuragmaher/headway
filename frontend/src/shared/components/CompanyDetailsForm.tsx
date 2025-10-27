/**
 * Company Details Form Component
 * Allows users to manage company information including name, website, size, and description
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
  alpha,
  useTheme,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';

interface CompanyDetails {
  id?: string;
  name: string;
  website: string;
  size: string;
  description: string;
}

interface CompanyDetailsFormProps {
  companyData: CompanyDetails;
  onSave: (data: CompanyDetails) => Promise<void>;
  onGenerateDescription: (websiteUrl: string) => Promise<string>;
  isLoading?: boolean;
}

const COMPANY_SIZES = ['Startup', 'Small', 'Medium', 'Enterprise'];

export function CompanyDetailsForm({
  companyData,
  onSave,
  onGenerateDescription,
  isLoading = false,
}: CompanyDetailsFormProps): JSX.Element {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyDetails>(companyData);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleSizeChange = (e: any) => {
    setFormData(prev => ({
      ...prev,
      size: e.target.value,
    }));
  };

  const handleGenerateDescription = async () => {
    if (!formData.website) {
      setErrorMessage('Please enter a website URL first');
      setSnackbarOpen(true);
      return;
    }

    setIsGenerating(true);
    setErrorMessage(''); // Clear any previous errors
    try {
      const description = await onGenerateDescription(formData.website);
      setFormData(prev => ({
        ...prev,
        description,
      }));
      setSuccessMessage('Description generated successfully!');
      setSnackbarOpen(true);
      // Keep dialog open so user can review and edit the generated description
      setDialogOpen(true);
    } catch (error: any) {
      console.error('Description generation error:', error);
      setErrorMessage(error.message || 'Failed to generate description');
      setSnackbarOpen(true);
      // Keep dialog open on error so user can retry
      setDialogOpen(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!formData.name || !formData.website || !formData.size) {
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

  const isFormValid = formData.name && formData.website && formData.size;
  const isEdited = JSON.stringify(formData) !== JSON.stringify(companyData);

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        mb: 2,
      }}
    >
      <CardContent>
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
            }}
          >
            <BusinessIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Company Details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your company information
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleOpenDialog}
              disabled={isLoading}
            >
              Edit
            </Button>
          </Box>
        </Box>

        {/* Company Info Display */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Company Name
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {companyData.name || 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Company Size
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {companyData.size || 'Not set'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Website
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  fontWeight: 500,
                  color: companyData.website ? theme.palette.info.main : 'text.secondary',
                  textDecoration: companyData.website ? 'underline' : 'none',
                  cursor: companyData.website ? 'pointer' : 'default',
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
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Description
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {companyData.description || 'Not set'}
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
              />
            </Grid>

            {/* Website */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Website URL *"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                disabled={isLoading || isGenerating}
                variant="outlined"
                placeholder="https://example.com"
                helperText="Include https://"
              />
            </Grid>

            {/* Company Size */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Company Size *</InputLabel>
                <Select
                  name="size"
                  value={formData.size || ''}
                  onChange={handleSizeChange}
                  label="Company Size *"
                  disabled={isLoading}
                >
                  <MenuItem value="">
                    <em>Select a size</em>
                  </MenuItem>
                  {COMPANY_SIZES.map(size => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Description with Generate Button */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                  label="Company Description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={isLoading || isGenerating}
                  variant="outlined"
                  multiline
                  rows={4}
                  placeholder="Tell us about your company..."
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleGenerateDescription}
                  disabled={!formData.website || isGenerating || isLoading}
                  startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                  sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 140,
                    height: 'fit-content',
                    mt: 1
                  }}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </Box>
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
