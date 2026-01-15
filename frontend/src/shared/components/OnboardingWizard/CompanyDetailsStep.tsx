/**
 * Company Details Step Component
 * Step 1: Collect company name, website, size, and description
 */

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { companyService, type CompanyDetails } from '@/services/company';
import { COMPANY_SIZES } from './types';

interface CompanyDetailsStepProps {
  companyData: CompanyDetails;
  setCompanyData: React.Dispatch<React.SetStateAction<CompanyDetails>>;
  workspaceId: string;
  setError: (error: string | null) => void;
}

export function CompanyDetailsStep({
  companyData,
  setCompanyData,
  workspaceId,
  setError,
}: CompanyDetailsStepProps): JSX.Element {
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const handleGenerateDescription = async () => {
    if (!workspaceId || !companyData.website) return;

    setIsGeneratingDescription(true);
    setError(null);
    try {
      const description = await companyService.generateDescription(workspaceId, companyData.website);
      setCompanyData((prev) => ({ ...prev, description }));
    } catch (err) {
      console.error('Failed to generate description:', err);
      setError('Failed to generate description. Please try again or enter manually.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
    <Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Tell us about your company so we can better understand your feedback.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Company Name"
            value={companyData.name}
            onChange={(e) => setCompanyData((prev) => ({ ...prev, name: e.target.value }))}
            required
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Website URL"
            value={companyData.website}
            onChange={(e) => setCompanyData((prev) => ({ ...prev, website: e.target.value }))}
            required
            variant="outlined"
            placeholder="https://example.com"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Company Size</InputLabel>
            <Select
              value={companyData.size}
              onChange={(e) => setCompanyData((prev) => ({ ...prev, size: e.target.value }))}
              label="Company Size"
            >
              {COMPANY_SIZES.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="Company Description"
              value={companyData.description}
              onChange={(e) => setCompanyData((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              variant="outlined"
              placeholder="What does your company do?"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleGenerateDescription}
              disabled={!companyData.website || isGeneratingDescription}
              startIcon={isGeneratingDescription ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
              sx={{
                whiteSpace: 'nowrap',
                minWidth: 120,
                height: 'fit-content',
                mt: 1,
              }}
            >
              {isGeneratingDescription ? 'Generating...' : 'Auto-fill'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
