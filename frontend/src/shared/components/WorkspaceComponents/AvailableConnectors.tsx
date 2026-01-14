/**
 * Available Connectors Component
 */

import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import { CloudSync as CloudSyncIcon, Schedule as ScheduleIcon } from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useGmailStore } from "@/shared/store/gmailStore";
import { AVAILABLE_CONNECTORS } from "../../types/WorkspaceTypes";
import { getConnectorIcon } from "../../utils/WorkspaceUtils";

export function AvailableConnectors(): JSX.Element {
  const theme = useTheme();
  const { openModal } = useGmailStore();

  const {
    openSlackDialog,
    openGongDialog,
    openFathomDialog,
    slackIntegrations,
    connectors,
    gmailAccounts,
  } = useWorkspaceSettingsStore((state) => ({
    openSlackDialog: state.openSlackDialog,
    openGongDialog: state.openGongDialog,
    openFathomDialog: state.openFathomDialog,
    slackIntegrations: state.slackIntegrations,
    connectors: state.connectors,
    gmailAccounts: state.gmailAccounts,
  }));

  const handleConnectorClick = (connectorName: string) => {
    switch (connectorName) {
      case "Slack":
        openSlackDialog();
        break;
      case "Gmail":
        openModal();
        break;
      case "Gong":
        openGongDialog();
        break;
      case "Fathom":
        openFathomDialog();
        break;
    }
  };

  // Filter out connected connectors
  const isConnected = (connectorName: string): boolean => {
    switch (connectorName) {
      case "Slack":
        return slackIntegrations.length > 0;
      case "Gmail":
        return gmailAccounts.length > 0;
      case "Gong":
        return connectors.some((c) => c.connector_type === "gong" && c.is_active);
      case "Fathom":
        return connectors.some((c) => c.connector_type === "fathom" && c.is_active);
      default:
        return false;
    }
  };

  const filteredConnectors = AVAILABLE_CONNECTORS.filter(
    (connector) => !isConnected(connector.name)
  );

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
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <CloudSyncIcon sx={{ color: theme.palette.info.main, fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Available Connectors
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredConnectors.length} connectors available
            </Typography>
          </Box>
        </Box>

        {/* Connectors Grid */}
        {filteredConnectors.length === 0 ? (
          <Alert
            severity="info"
            sx={{
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              bgcolor: alpha(theme.palette.info.main, 0.06),
            }}
          >
            All connectors are connected.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {filteredConnectors.map((connector) => (
              <Grid item xs={6} sm={4} key={connector.name}>
                <Card
                  onClick={() => connector.available && handleConnectorClick(connector.name)}
                  sx={{
                    aspectRatio: "1",
                    borderRadius: 2.5,
                    background: connector.available
                      ? `linear-gradient(135deg, ${alpha(
                          theme.palette.background.paper,
                          0.9
                        )} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`
                      : `linear-gradient(135deg, ${alpha(
                          theme.palette.warning.main,
                          0.08
                        )} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
                    border: connector.available
                      ? `1px solid ${alpha(theme.palette.divider, 0.12)}`
                      : `1px dashed ${alpha(theme.palette.warning.main, 0.4)}`,
                    boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.04)}`,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: connector.available ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2.5,
                    position: "relative",
                    "&:hover": connector.available
                      ? {
                          transform: "translateY(-4px)",
                          boxShadow: `0 8px 24px ${alpha(
                            theme.palette.primary.main,
                            0.15
                          )}`,
                          borderColor: alpha(theme.palette.primary.main, 0.3),
                        }
                      : {
                          borderColor: alpha(theme.palette.warning.main, 0.6),
                        },
                  }}
                >
                  {/* Coming Soon Badge */}
                  {!connector.available && (
                    <Chip
                      icon={<ScheduleIcon sx={{ fontSize: "0.875rem !important" }} />}
                      label="Coming Soon"
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        bgcolor: alpha(theme.palette.warning.main, 0.15),
                        color: theme.palette.warning.dark,
                        fontWeight: 600,
                        fontSize: "0.625rem",
                        height: 22,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                        "& .MuiChip-icon": {
                          color: theme.palette.warning.main,
                          ml: 0.5,
                        },
                      }}
                    />
                  )}

                  {/* Icon */}
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 2.5,
                      background: connector.available
                        ? `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`
                        : `linear-gradient(135deg, ${alpha(
                            theme.palette.warning.main,
                            0.2
                          )} 0%, ${alpha(theme.palette.warning.light, 0.1)} 100%)`,
                      border: connector.available
                        ? "none"
                        : `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                      flexShrink: 0,
                    }}
                  >
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
                          color: connector.available ? "white" : theme.palette.warning.main,
                        },
                        "& > *:not(svg)": {
                          fontSize: "2.25rem",
                          color: connector.available ? "white" : theme.palette.warning.main,
                          lineHeight: 1,
                        },
                      }}
                    >
                      {getConnectorIcon(connector.name)}
                    </Box>
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
                    {connector.name}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
