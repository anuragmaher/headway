/**
 * Connectors Configuration Section Component
 */

import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme,
} from "@mui/material";
import { CloudSync as CloudSyncIcon, ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useUser } from "@/features/auth/store/auth-store";

export function ConnectorsConfigSection(): JSX.Element {
  const theme = useTheme();
  const user = useUser();

  const {
    expandedSections,
    setExpandedSection,
    gongAccessKey,
    gongSecretKey,
    fathomApiToken,
    isSavingConnectors,
    connectorError,
    connectors,
    isLoadingConnectors,
    setGongAccessKey,
    setGongSecretKey,
    setFathomApiToken,
    setConnectorError,
    saveAllConnectors,
  } = useWorkspaceSettingsStore((state) => ({
    expandedSections: state.expandedSections,
    setExpandedSection: state.setExpandedSection,
    gongAccessKey: state.gongAccessKey,
    gongSecretKey: state.gongSecretKey,
    fathomApiToken: state.fathomApiToken,
    isSavingConnectors: state.isSavingConnectors,
    connectorError: state.connectorError,
    connectors: state.connectors,
    isLoadingConnectors: state.isLoadingConnectors,
    setGongAccessKey: state.setGongAccessKey,
    setGongSecretKey: state.setGongSecretKey,
    setFathomApiToken: state.setFathomApiToken,
    setConnectorError: state.setConnectorError,
    saveAllConnectors: state.saveAllConnectors,
  }));

  const handleAccordionChange = (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection("connectors", isExpanded);
  };

  const handleSaveConnectors = () => {
    if (user?.workspace_id) {
      saveAllConnectors(user.workspace_id);
    }
  };

  return (
    <Accordion
      id="connectors-config-accordion"
      expanded={expandedSections.connectors}
      onChange={handleAccordionChange}
      sx={{
        borderRadius: 2.5,
        background: `linear-gradient(135deg, ${alpha(
          theme.palette.background.paper,
          0.95
        )} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
        backdropFilter: "blur(12px)",
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        boxShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.04)}`,
        transition: "all 0.3s ease-in-out",
        "&:before": { display: "none" },
        "&.Mui-expanded": { 
          margin: 0,
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.06)}`,
        },
        "&:hover": {
          boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.08)}`,
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CloudSyncIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Connectors Configuration
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
        {isLoadingConnectors ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Gong Connector */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 2, color: theme.palette.primary.main }}
              >
                🎤 Gong Credentials
              </Typography>
              <TextField
                label="Access Key"
                value={gongAccessKey}
                onChange={(e) => setGongAccessKey(e.target.value)}
                fullWidth
                size="small"
                type="password"
                placeholder="Enter your Gong access key"
                sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
              />
              <TextField
                label="Secret Key"
                value={gongSecretKey}
                onChange={(e) => setGongSecretKey(e.target.value)}
                fullWidth
                size="small"
                type="password"
                placeholder="Enter your Gong secret key"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
              />
            </Box>

            {/* Fathom Connector */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.info.main, 0.05),
                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 2, color: theme.palette.info.main }}
              >
                📹 Fathom Credentials
              </Typography>
              <TextField
                label="API Token"
                value={fathomApiToken}
                onChange={(e) => setFathomApiToken(e.target.value)}
                fullWidth
                size="small"
                type="password"
                placeholder="Enter your Fathom API token"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
              />
            </Box>

            {/* Error Alert */}
            {connectorError && (
              <Alert
                severity="error"
                sx={{ borderRadius: 1.5 }}
                onClose={() => setConnectorError(null)}
              >
                {connectorError}
              </Alert>
            )}

            {/* Save Button */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSaveConnectors}
              disabled={
                isSavingConnectors || ((!gongAccessKey || !gongSecretKey) && !fathomApiToken)
              }
              sx={{
                borderRadius: 1.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                },
                "&:disabled": {
                  background: alpha(theme.palette.primary.main, 0.3),
                },
              }}
            >
              {isSavingConnectors ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                "Save Connectors"
              )}
            </Button>

            {/* Configured Connectors Status */}
            {connectors.length > 0 && (
              <Box sx={{ pt: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, display: "block", mb: 1 }}
                >
                  CONFIGURED CONNECTORS
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {connectors.map((connector) => (
                    <Chip
                      key={connector.id}
                      label={connector.connector_type === "gong" ? "🎤 Gong" : "📹 Fathom"}
                      size="small"
                      sx={{
                        bgcolor:
                          connector.connector_type === "gong"
                            ? alpha(theme.palette.primary.main, 0.2)
                            : alpha(theme.palette.info.main, 0.2),
                        color:
                          connector.connector_type === "gong"
                            ? theme.palette.primary.main
                            : theme.palette.info.main,
                        fontWeight: 600,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
