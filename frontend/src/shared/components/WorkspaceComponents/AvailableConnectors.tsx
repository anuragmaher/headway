/**
 * Available Connectors Component
 * Shows available connectors in a list format, with coming soon connectors
 * appearing dynamically as users connect their data sources.
 */

import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Chip,
  alpha,
  useTheme,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  CloudSync as CloudSyncIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useGmailStore } from "@/shared/store/gmailStore";
import { ACTIVE_CONNECTORS, COMING_SOON_CONNECTORS } from "../../types/WorkspaceTypes";
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

  // Check if a connector is already connected
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

  // Filter active connectors to show only unconnected ones
  const availableConnectors = ACTIVE_CONNECTORS.filter(
    (connector) => !isConnected(connector.name)
  );

  // Calculate how many coming soon connectors to show
  // As available connectors decrease from the max (4), show more coming soon
  const maxActiveConnectors = ACTIVE_CONNECTORS.length;
  const connectedCount = maxActiveConnectors - availableConnectors.length;
  
  // Show coming soon connectors when less than 3 available connectors remain
  const showComingSoonCount = availableConnectors.length < 3 
    ? Math.min(COMING_SOON_CONNECTORS.length, 3 - availableConnectors.length + connectedCount)
    : 0;
  
  const visibleComingSoon = COMING_SOON_CONNECTORS.slice(0, showComingSoonCount);

  const allConnectorsConnected = availableConnectors.length === 0;

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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloudSyncIcon sx={{ color: "white", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Available Connectors
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {availableConnectors.length} of {maxActiveConnectors} connectors available
            </Typography>
          </Box>
        </Box>

        {/* All Connected Alert */}
        {allConnectorsConnected ? (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity="success"
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                bgcolor: alpha(theme.palette.success.main, 0.06),
                mb: visibleComingSoon.length > 0 ? 2 : 0,
              }}
            >
              All available connectors are connected!
            </Alert>
            
            {/* Show coming soon when all are connected */}
            {visibleComingSoon.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    mb: 1,
                    mt: 2,
                  }}
                >
                  Coming Soon
                </Typography>
                <List disablePadding>
                  {visibleComingSoon.map((connector, index) => (
                    <ListItem
                      key={connector.name}
                      disablePadding
                      sx={{
                        mb: index < visibleComingSoon.length - 1 ? 1 : 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 1.5,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${alpha(
                            theme.palette.warning.main,
                            0.06
                          )} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
                          border: `1px dashed ${alpha(theme.palette.warning.main, 0.3)}`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            background: `linear-gradient(135deg, ${alpha(
                              theme.palette.warning.main,
                              0.15
                            )} 0%, ${alpha(theme.palette.warning.light, 0.08)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            "& svg": {
                              width: 20,
                              height: 20,
                              color: theme.palette.warning.main,
                            },
                          }}
                        >
                          {getConnectorIcon(connector.name)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                          >
                            {connector.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {connector.description}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: "0.75rem !important" }} />}
                          label="Soon"
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.12),
                            color: theme.palette.warning.dark,
                            fontWeight: 600,
                            fontSize: "0.625rem",
                            height: 22,
                            borderRadius: 1,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                            "& .MuiChip-icon": {
                              color: theme.palette.warning.main,
                            },
                          }}
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        ) : (
          <>
            {/* Available Connectors List */}
            <List disablePadding sx={{ mb: visibleComingSoon.length > 0 ? 2 : 0 }}>
              {availableConnectors.map((connector, index) => (
                <ListItem
                  key={connector.name}
                  disablePadding
                  sx={{
                    mb: index < availableConnectors.length - 1 ? 1 : 0,
                  }}
                >
                  <ListItemButton
                    onClick={() => handleConnectorClick(connector.name)}
                    sx={{
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                      background: `linear-gradient(135deg, ${alpha(
                        theme.palette.background.paper,
                        0.9
                      )} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                      transition: "all 0.2s ease-in-out",
                      py: 1.5,
                      px: 2,
                      "&:hover": {
                        transform: "translateX(4px)",
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                        background: `linear-gradient(135deg, ${alpha(
                          theme.palette.primary.main,
                          0.05
                        )} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 52 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.5,
                          background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          "& svg": {
                            width: 20,
                            height: 20,
                            color: "white",
                          },
                        }}
                      >
                        {getConnectorIcon(connector.name)}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={connector.name}
                      secondary={connector.description}
                      primaryTypographyProps={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                      }}
                      secondaryTypographyProps={{
                        fontSize: "0.75rem",
                        sx: {
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      }}
                    />
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: theme.palette.primary.main,
                      }}
                    >
                      <AddIcon sx={{ fontSize: 18 }} />
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>

            {/* Coming Soon Section - Shows dynamically */}
            {visibleComingSoon.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    mb: 1.5,
                  }}
                >
                  Coming Soon
                </Typography>
                <List disablePadding>
                  {visibleComingSoon.map((connector, index) => (
                    <ListItem
                      key={connector.name}
                      disablePadding
                      sx={{
                        mb: index < visibleComingSoon.length - 1 ? 1 : 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 1.5,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${alpha(
                            theme.palette.warning.main,
                            0.06
                          )} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
                          border: `1px dashed ${alpha(theme.palette.warning.main, 0.3)}`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            background: `linear-gradient(135deg, ${alpha(
                              theme.palette.warning.main,
                              0.15
                            )} 0%, ${alpha(theme.palette.warning.light, 0.08)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            "& svg": {
                              width: 20,
                              height: 20,
                              color: theme.palette.warning.main,
                            },
                          }}
                        >
                          {getConnectorIcon(connector.name)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                          >
                            {connector.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {connector.description}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: "0.75rem !important" }} />}
                          label="Soon"
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.12),
                            color: theme.palette.warning.dark,
                            fontWeight: 600,
                            fontSize: "0.625rem",
                            height: 22,
                            borderRadius: 1,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                            "& .MuiChip-icon": {
                              color: theme.palette.warning.main,
                            },
                          }}
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
