/**
 * Preferences Section Component
 */

import {
  Box,
  Typography,
  Switch,
  Card,
  CardContent,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Notifications as NotificationsIcon,
  Sync as SyncIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";

export function PreferencesSection(): JSX.Element {
  const theme = useTheme();

  const {
    autoSync,
    setAutoSync,
    emailNotifications,
    setEmailNotifications,
  } = useWorkspaceSettingsStore((state) => ({
    autoSync: state.autoSync,
    setAutoSync: state.setAutoSync,
    emailNotifications: state.emailNotifications,
    setEmailNotifications: state.setEmailNotifications,
  }));

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
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.08)}`,
        },
      }}
    >
      <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NotificationsIcon sx={{ color: "white", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
              Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
              Manage sync and notification settings
            </Typography>
          </Box>
        </Box>

        {/* Settings */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {/* Auto-sync Setting */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.success.main, 0.06),
              border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: alpha(theme.palette.success.main, 0.3),
                background: alpha(theme.palette.success.main, 0.1),
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.success.main, 0.15),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SyncIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
                  Auto-sync data sources
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sync new data every hour
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: theme.palette.success.main,
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: theme.palette.success.main,
                },
              }}
            />
          </Box>

          {/* Email Notifications Setting */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.info.main, 0.06),
              border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: alpha(theme.palette.info.main, 0.3),
                background: alpha(theme.palette.info.main, 0.1),
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.info.main, 0.15),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <EmailIcon sx={{ color: theme.palette.info.main, fontSize: 18 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
                  Email notifications
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Weekly summaries & alerts
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: theme.palette.info.main,
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: theme.palette.info.main,
                },
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
