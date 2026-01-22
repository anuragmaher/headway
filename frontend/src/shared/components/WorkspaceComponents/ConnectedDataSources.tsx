/**
 * Connected Data Sources Component
 */

import { useState } from "react";
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Grid,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import {
  DataUsage as DataUsageIcon,
  DeleteOutline as DeleteIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { SlackIcon, GmailIcon, getConnectorIcon } from "../../utils/WorkspaceUtils";
import type { DataSource } from "../../types/WorkspaceTypes";
import { ConnectorDetailsDialog } from "./ConnectorDetailsDialog";
import { GmailDetailsDialog } from "./GmailDetailsDialog";

export function ConnectedDataSources(): JSX.Element {
  const theme = useTheme();
  const auth = useAuthStore();
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [connectorDetailsOpen, setConnectorDetailsOpen] = useState(false);
  const [gmailDetailsOpen, setGmailDetailsOpen] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [selectedConnectorType, setSelectedConnectorType] = useState<"gong" | "fathom" | null>(null);
  const [selectedGmailAccountId, setSelectedGmailAccountId] = useState<string | null>(null);

  const {
    isLoadingIntegrations,
    isDisconnectingSlack,
    getDataSources,
    disconnectSlackIntegration,
    disconnectGmailAccount,
    disconnectConnector,
    loadSlackIntegrations,
    loadGmailAccounts,
    loadConnectors,
    setConnectorError,
  } = useWorkspaceSettingsStore((state) => ({
    isLoadingIntegrations: state.isLoadingIntegrations,
    isDisconnectingSlack: state.isDisconnectingSlack,
    getDataSources: state.getDataSources,
    disconnectSlackIntegration: state.disconnectSlackIntegration,
    disconnectGmailAccount: state.disconnectGmailAccount,
    disconnectConnector: state.disconnectConnector,
    loadSlackIntegrations: state.loadSlackIntegrations,
    loadGmailAccounts: state.loadGmailAccounts,
    loadConnectors: state.loadConnectors,
    setConnectorError: state.setConnectorError,
  }));

  const dataSources = getDataSources();
  const workspaceId = auth.tokens?.workspace_id;

  const handleSourceClick = (source: DataSource) => {
    setSelectedSource(source);
    setActionDialogOpen(true);
  };

  const handleViewDetails = () => {
    setActionDialogOpen(false);
    if (!selectedSource) return;

    if (selectedSource.type === "gong" || selectedSource.type === "fathom") {
      setSelectedConnectorId(selectedSource.id);
      setSelectedConnectorType(selectedSource.type);
      setConnectorDetailsOpen(true);
    } else if (selectedSource.type === "gmail") {
      setSelectedGmailAccountId(selectedSource.id);
      setGmailDetailsOpen(true);
    }
  };

  const handleDisconnectClick = () => {
    setActionDialogOpen(false);
    setDisconnectDialogOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    console.log("handleDisconnectConfirm called", { selectedSource, workspaceId });
    if (!selectedSource) {
      console.error("Missing selectedSource", { selectedSource });
      return;
    }

    // Only require workspaceId for connectors (Gong/Fathom)
    if ((selectedSource.type === "gong" || selectedSource.type === "fathom") && !workspaceId) {
      console.error("Missing workspaceId for connector disconnect", { selectedSource, workspaceId });
      setConnectorError("Workspace ID is missing. Please refresh the page and try again.");
      return;
    }

    try {
      console.log("Starting disconnect for:", selectedSource.type, selectedSource.id);
      if (selectedSource.type === "slack") {
        console.log("Disconnecting Slack integration:", selectedSource.id, "Type:", typeof selectedSource.id);
        // Ensure integration ID is a string
        // Note: Slack disconnect doesn't need workspaceId - backend gets it from auth token
        const integrationId = String(selectedSource.id);
        console.log("Calling disconnectSlackIntegration with:", integrationId);
        await disconnectSlackIntegration(integrationId);
        console.log("Slack disconnect completed, reloading integrations");
        // loadSlackIntegrations is already called in disconnectSlackIntegration, but we call it again to ensure UI updates
        await loadSlackIntegrations();
        console.log("Integrations reloaded");
      } else if (selectedSource.type === "gmail") {
        // Gmail disconnect also doesn't need workspaceId - backend gets it from auth token
        await disconnectGmailAccount(selectedSource.id);
        await loadGmailAccounts();
      } else if (selectedSource.type === "gong" || selectedSource.type === "fathom") {
        // Validate connector ID is a valid UUID format
        if (!selectedSource.id || selectedSource.id === "gong" || selectedSource.id === "fathom") {
          console.error("Invalid connector ID:", selectedSource.id);
          setConnectorError("Unable to disconnect: Invalid connector ID. Please refresh the page and try again.");
          return;
        }
        // Connectors require workspaceId
        if (!workspaceId) {
          console.error("Missing workspaceId for connector disconnect");
          setConnectorError("Workspace ID is missing. Please refresh the page and try again.");
          return;
        }
        await disconnectConnector(workspaceId, selectedSource.id);
        await loadConnectors(workspaceId);
      }
      // Only close dialog if disconnect was successful
      console.log("Disconnect successful, closing dialog");
      setDisconnectDialogOpen(false);
      setSelectedSource(null);
    } catch (error: any) {
      console.error("Failed to disconnect:", error);
      console.error("Error stack:", error.stack);
      // Error is already handled by the store and will be shown in snackbar
      // Keep dialog open so user can try again or cancel
    }
  };

  const handleDisconnectCancel = () => {
    setDisconnectDialogOpen(false);
    setSelectedSource(null);
  };

  const handleActionDialogClose = () => {
    setActionDialogOpen(false);
    setSelectedSource(null);
  };

  return (
    <Card
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
        "&:hover": {
          boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.08)}`,
        },
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <DataUsageIcon
            sx={{ color: theme.palette.success.main, fontSize: 28 }}
          />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Connected Data Sources
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isLoadingIntegrations
                ? "Loading..."
                : `${dataSources.filter((s) => s.status === "connected").length} active connections`}
            </Typography>
          </Box>
        </Box>

        {/* Data Sources Grid */}
        {isLoadingIntegrations ? (
          <Grid container spacing={2}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid item xs={6} sm={4} key={`shimmer-${index}`}>
                <Box
                  sx={{
                    aspectRatio: "1",
                    borderRadius: 2.5,
                    background: `linear-gradient(135deg, ${alpha(
                      theme.palette.background.paper,
                      0.8
                    )} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    animation: "pulse 1.5s ease-in-out infinite",
                    "@keyframes pulse": {
                      "0%": { opacity: 1 },
                      "50%": { opacity: 0.4 },
                      "100%": { opacity: 1 },
                    },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        ) : dataSources.length === 0 ? (
          <Alert
            severity="info"
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(
                theme.palette.info.main,
                0.1
              )} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            }}
          >
            No data sources connected. Add your first source to start collecting
            feedback in this workspace.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {dataSources.map((source) => (
              <Grid item xs={6} sm={4} key={source.id}>
                <Card
                  onClick={() => handleSourceClick(source)}
                  sx={{
                    aspectRatio: "1",
                    borderRadius: 2.5,
                    background: `linear-gradient(135deg, ${alpha(
                      theme.palette.background.paper,
                      0.9
                    )} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                    boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.04)}`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2.5,
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 8px 24px ${alpha(
                        theme.palette.primary.main,
                        0.15
                      )}`,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                  }}
                >
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 2.5,
                      background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                      flexShrink: 0,
                    }}
                  >
                    {source.type === "slack" ? (
                      <SlackIcon color="white" />
                    ) : source.type === "gmail" ? (
                      <GmailIcon color="white" />
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          "& svg": {
                            width: "36px",
                            height: "36px",
                            color: "white",
                          },
                          "& > *:not(svg)": {
                            fontSize: "2.25rem",
                            color: "white",
                            lineHeight: 1,
                          },
                        }}
                      >
                        {getConnectorIcon(source.name)}
                      </Box>
                    )}
                  </Box>

                  {/* Name */}
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      textAlign: "center",
                      fontSize: "0.9375rem",
                      color: "text.primary",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  >
                    {source.name}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      {/* Action Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={handleActionDialogClose}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            minWidth: 320,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {selectedSource?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* View Details Button - only for Gmail, Gong, Fathom */}
            {selectedSource && ["gmail", "gong", "fathom"].includes(selectedSource.type) && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={handleViewDetails}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.25,
                  justifyContent: "flex-start",
                  px: 2,
                }}
              >
                View Details
              </Button>
            )}
            {/* Disconnect Button */}
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDisconnectClick}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                py: 1.25,
                justifyContent: "flex-start",
                px: 2,
              }}
            >
              Disconnect
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            onClick={handleActionDialogClose}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={disconnectDialogOpen}
        onClose={handleDisconnectCancel}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Disconnect Data Source</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Are you sure you want to disconnect{" "}
            <strong>{selectedSource?.name}</strong>? This will stop collecting data from this
            source.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={handleDisconnectCancel} sx={{ borderRadius: 2, textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Disconnect button clicked");
              handleDisconnectConfirm();
            }}
            variant="contained"
            color="error"
            disabled={isDisconnectingSlack && selectedSource?.type === "slack"}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {isDisconnectingSlack && selectedSource?.type === "slack" ? "Disconnecting..." : "Disconnect"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connector Details Dialog */}
      <ConnectorDetailsDialog
        open={connectorDetailsOpen}
        onClose={() => {
          setConnectorDetailsOpen(false);
          setSelectedConnectorId(null);
          setSelectedConnectorType(null);
        }}
        connectorId={selectedConnectorId}
        connectorType={selectedConnectorType}
        workspaceId={workspaceId || null}
      />

      {/* Gmail Details Dialog */}
      <GmailDetailsDialog
        open={gmailDetailsOpen}
        onClose={() => {
          setGmailDetailsOpen(false);
          setSelectedGmailAccountId(null);
        }}
        accountId={selectedGmailAccountId}
      />
    </Card>
  );
}
