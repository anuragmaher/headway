/**
 * CompanySetupStep Component
 * Step 0: Collect company information
 * Clean form design for split-layout onboarding
 *
 * Fields stored in companies table:
 * - name (required)
 * - website (optional)
 * - industry (required)
 * - teamSize (optional) -> maps to 'size' column
 * - role (optional) -> user's role in the company
 */

import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  InputAdornment,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Language as LanguageIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  AlternateEmail as AlternateEmailIcon,
} from '@mui/icons-material';
import {
  useCompanyData,
  useOnboardingStore,
} from '../../store/onboardingStore';
import { INDUSTRIES, TEAM_SIZES, ROLES } from '../../types';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: 1.5,
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

const selectSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: 1.5,
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
  '& .MuiSelect-select': {
    color: '#1e293b',
  },
  '& .MuiInputLabel-root': {
    color: '#64748b',
  },
};

export function CompanySetupStep(): JSX.Element {
  const companyData = useCompanyData();
  const updateCompanyData = useOnboardingStore(
    (state) => state.updateCompanyData
  );

  return (
    <Box>
      <Grid container spacing={2}>
        {/* Company Name */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label="Company Name"
            value={companyData.name}
            onChange={(e) => updateCompanyData({ name: e.target.value })}
            placeholder="Enter your company name"
            size="small"
            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BusinessIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
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
            value={companyData.website}
            onChange={(e) => updateCompanyData({ website: e.target.value })}
            placeholder="https://example.com"
            size="small"
            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LanguageIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Company Domains */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Company Domains"
            value={companyData.domainsInput ?? companyData.domains?.join(', ') ?? ''}
            onChange={(e) => {
              // Store raw input while typing
              updateCompanyData({ domainsInput: e.target.value });
            }}
            onBlur={(e) => {
              // Parse into array on blur
              const domains = e.target.value
                .split(',')
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean);
              updateCompanyData({ domains, domainsInput: undefined });
            }}
            placeholder="e.g., hiver.com, hiverhq.com"
            helperText="Email domains to identify internal team members (comma-separated)"
            size="small"
            sx={inputSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AlternateEmailIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Industry */}
        <Grid item xs={12}>
          <FormControl fullWidth required size="small" sx={selectSx}>
            <InputLabel>Industry</InputLabel>
            <Select
              value={companyData.industry}
              onChange={(e) => updateCompanyData({ industry: e.target.value })}
              label="Industry"
              startAdornment={
                <InputAdornment position="start">
                  <CategoryIcon sx={{ color: '#94a3b8', fontSize: 18, ml: 0.5 }} />
                </InputAdornment>
              }
            >
              {INDUSTRIES.map((industry) => (
                <MenuItem key={industry} value={industry}>
                  {industry}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* About You Section */}
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          mt: 4,
          mb: 2,
        }}
      >
        About you
      </Typography>

      <Grid container spacing={2}>
        {/* Team Size */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small" sx={selectSx}>
            <InputLabel>Team Size</InputLabel>
            <Select
              value={companyData.teamSize}
              onChange={(e) => updateCompanyData({ teamSize: e.target.value })}
              label="Team Size"
              startAdornment={
                <InputAdornment position="start">
                  <PeopleIcon sx={{ color: '#94a3b8', fontSize: 18, ml: 0.5 }} />
                </InputAdornment>
              }
            >
              <MenuItem value="">
                <em>Select</em>
              </MenuItem>
              {TEAM_SIZES.map((size) => (
                <MenuItem key={size} value={size}>
                  {size} employees
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Your Role */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small" sx={selectSx}>
            <InputLabel>Your Role</InputLabel>
            <Select
              value={companyData.role}
              onChange={(e) => updateCompanyData({ role: e.target.value })}
              label="Your Role"
              startAdornment={
                <InputAdornment position="start">
                  <PersonIcon sx={{ color: '#94a3b8', fontSize: 18, ml: 0.5 }} />
                </InputAdornment>
              }
            >
              <MenuItem value="">
                <em>Select</em>
              </MenuItem>
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
}
