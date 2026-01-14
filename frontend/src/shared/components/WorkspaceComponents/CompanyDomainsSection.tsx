/**
 * Company Domains Section Component
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Alert,
  TextField,
  Button,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
} from "@mui/material";
import { Security as SecurityIcon, Add as AddIcon } from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useAuthStore } from "@/features/auth/store/auth-store";

export function CompanyDomainsSection(): JSX.Element {
  const theme = useTheme();
  const auth = useAuthStore();

  const {
    companyDomains,
    newDomain,
    isLoadingDomains,
    isSavingDomains,
    domainsError,
    domainsSuccess,
    setNewDomain,
    addDomain,
    removeDomain,
  } = useWorkspaceSettingsStore((state) => ({
    companyDomains: state.companyDomains,
    newDomain: state.newDomain,
    isLoadingDomains: state.isLoadingDomains,
    isSavingDomains: state.isSavingDomains,
    domainsError: state.domainsError,
    domainsSuccess: state.domainsSuccess,
    setNewDomain: state.setNewDomain,
    addDomain: state.addDomain,
    removeDomain: state.removeDomain,
  }));

  const workspaceId = auth.tokens?.workspace_id;
  const accessToken = auth.tokens?.access_token;

  const handleAddDomain = () => {
    if (workspaceId && accessToken) {
      addDomain(workspaceId, accessToken);
    }
  };

  const handleRemoveDomain = (domain: string) => {
    if (workspaceId && accessToken) {
      removeDomain(workspaceId, accessToken, domain);
    }
  };

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(
          theme.palette.background.paper,
          0.8
        )} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
        backdropFilter: "blur(10px)",
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Avatar
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
              width: 40,
              height: 40,
              flexShrink: 0,
            }}
          >
            <SecurityIcon sx={{ fontSize: 20 }} />
          </Avatar>
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
              Company Domains
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
              Exclude internal company domains from customer tracking
            </Typography>
          </Box>
        </Box>

        {domainsError && (
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 1.5 }}
            onClose={() => useWorkspaceSettingsStore.setState({ domainsError: null })}
          >
            {domainsError}
          </Alert>
        )}

        {domainsSuccess && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>
            Company domains updated successfully!
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1.5, mb: 2.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g., hiverhq.com or anurag@hiverhq.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDomain();
              }
            }}
            disabled={isSavingDomains}
            helperText="Enter a domain name or email address"
            FormHelperTextProps={{
              sx: {
                fontSize: '0.75rem',
                mt: 0.5,
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
                transition: "all 0.2s ease-in-out",
                fontSize: '0.9375rem',
                "&:hover": {
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
                "&.Mui-focused": {
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={
              isSavingDomains ? (
                <CircularProgress size={16} sx={{ color: "white" }} />
              ) : (
                <AddIcon />
              )
            }
            onClick={handleAddDomain}
            disabled={!newDomain.trim() || isSavingDomains}
            sx={{ 
              minWidth: "110px", 
              alignSelf: "flex-start",
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 500,
              fontSize: '0.875rem',
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                transform: "translateY(-1px)",
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
              },
              "&:disabled": {
                transform: "none",
              },
            }}
          >
            {isSavingDomains ? "Saving..." : "Add"}
          </Button>
        </Box>

        {isLoadingDomains ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} thickness={4} />
          </Box>
        ) : companyDomains.length === 0 ? (
          <Alert 
            severity="info"
            sx={{
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              bgcolor: alpha(theme.palette.info.main, 0.06),
            }}
          >
            No company domains configured. Add domains like "hiverhq.com" or
            "hiver.com" to exclude them from customer metrics.
          </Alert>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {companyDomains.map((domain) => (
              <Chip
                key={domain}
                label={domain}
                onDelete={() => handleRemoveDomain(domain)}
                disabled={isSavingDomains}
                sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.12)} 0%, ${alpha(theme.palette.warning.main, 0.08)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                  borderRadius: 2,
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  height: 32,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.18)} 0%, ${alpha(theme.palette.warning.main, 0.12)} 100())`,
                    transform: "translateY(-1px)",
                    boxShadow: `0 2px 8px ${alpha(theme.palette.warning.main, 0.2)}`,
                  },
                  "& .MuiChip-deleteIcon": {
                    color: theme.palette.warning.main,
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      color: theme.palette.warning.dark,
                      transform: "scale(1.1)",
                    },
                  },
                }}
              />
            ))}
          </Box>
        )}
        </CardContent>
      </Card>
  );
}
