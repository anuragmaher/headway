/**
 * CompanySetupStep Component
 * Step 1: Collect company information
 * Clean form design for split-layout onboarding
 */

import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Grid,
  InputAdornment,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Language as LanguageIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
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
        <Grid item xs={12} sm={6}>
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

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Website"
            value={companyData.website}
            onChange={(e) => updateCompanyData({ website: e.target.value })}
            placeholder="https://yourcompany.com"
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

        <Grid item xs={12}>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#64748b',
              fontWeight: 600,
              mt: 1,
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              letterSpacing: '0.05em',
            }}
          >
            About You
          </Typography>
        </Grid>

        <Grid item xs={6}>
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

        <Grid item xs={6}>
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
