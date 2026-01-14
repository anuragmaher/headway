/**
 * Workspace Info Section Component
 */

import {
  Box,
  Typography,
  Avatar,
  Card,
  CardContent,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Workspaces as WorkspacesIcon,
  Person as PersonIcon,
  Tag as TagIcon,
} from "@mui/icons-material";
import { useUser } from "@/features/auth/store/auth-store";

export function WorkspaceInfoSection(): JSX.Element {
  const theme = useTheme();
  const user = useUser();

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
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WorkspacesIcon sx={{ color: "white", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
              Workspace Info
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
              Your workspace details
            </Typography>
          </Box>
        </Box>

        {/* Workspace Details */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {/* Workspace Name */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.primary.main, 0.06),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Avatar
              sx={{
                width: 44,
                height: 44,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                fontSize: "1.1rem",
                fontWeight: 700,
              }}
            >
              {user?.company_name?.[0] || "W"}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                {user?.company_name || "HeadwayHQ Demo"}
              </Typography>
              <Chip
                label="Active"
                size="small"
                sx={{
                  mt: 0.5,
                  height: 20,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.success.main, 0.15),
                  color: theme.palette.success.main,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                }}
              />
            </Box>
          </Box>

          {/* Admin Info */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.5),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.secondary.main, 0.15),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PersonIcon sx={{ color: theme.palette.secondary.main, fontSize: 16 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                ADMIN
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.875rem" }}>
              {user?.first_name} {user?.last_name}
            </Typography>
          </Box>

          {/* Workspace ID */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.background.paper, 0.5),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.grey[500], 0.15),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TagIcon sx={{ color: theme.palette.grey[500], fontSize: 16 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                WORKSPACE ID
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                color: "text.secondary",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.company_id || "demo-workspace-1"}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
