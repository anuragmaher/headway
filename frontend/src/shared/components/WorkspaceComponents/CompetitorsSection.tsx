/**
 * Competitors Section Component
 * Displays selected competitors from onboarding and allows adding more
 */

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  alpha,
  useTheme,
  Skeleton,
  IconButton,
  Tooltip,
  Grid,
  Link,
} from "@mui/material";
import {
  Business as BusinessIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Language as LanguageIcon,
} from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { API_BASE_URL } from "@/config/api.config";
import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from "@mui/material";

export function CompetitorsSection(): JSX.Element {
  const theme = useTheme();
  const auth = useAuthStore();
  const workspaceId = auth.tokens?.workspace_id;
  const accessToken = auth.tokens?.access_token;

  const {
    competitors,
    isLoadingCompetitors,
    competitorsDialogOpen,
    openCompetitorsDialog,
    closeCompetitorsDialog,
    loadCompetitors,
  } = useWorkspaceSettingsStore((state) => ({
    competitors: state.competitors,
    isLoadingCompetitors: state.isLoadingCompetitors,
    competitorsDialogOpen: state.competitorsDialogOpen,
    openCompetitorsDialog: state.openCompetitorsDialog,
    closeCompetitorsDialog: state.closeCompetitorsDialog,
    loadCompetitors: state.loadCompetitors,
  }));

  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<{
    id: string;
    name: string;
    website?: string;
  } | null>(null);
  const [deletingCompetitorId, setDeletingCompetitorId] = useState<string | null>(null);

  const handleAddCompetitor = async () => {
    if (!workspaceId || !accessToken || !newCompetitorName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            competitors: [
              {
                name: newCompetitorName.trim(),
                website: newCompetitorWebsite.trim() || undefined,
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add competitor");
      }

      setNewCompetitorName("");
      setNewCompetitorWebsite("");
      closeCompetitorsDialog();
      await loadCompetitors(workspaceId, accessToken);
    } catch (error) {
      console.error("Failed to add competitor:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCompetitor = (competitor: { id: string; name: string; website?: string }) => {
    setEditingCompetitor(competitor);
    setNewCompetitorName(competitor.name);
    setNewCompetitorWebsite(competitor.website || "");
    openCompetitorsDialog();
  };

  const handleUpdateCompetitor = async () => {
    if (!workspaceId || !accessToken || !editingCompetitor || !newCompetitorName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors/${editingCompetitor.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newCompetitorName.trim(),
            website: newCompetitorWebsite.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update competitor");
      }

      setNewCompetitorName("");
      setNewCompetitorWebsite("");
      setEditingCompetitor(null);
      closeCompetitorsDialog();
      await loadCompetitors(workspaceId, accessToken);
    } catch (error) {
      console.error("Failed to update competitor:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    if (!workspaceId || !accessToken) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors/${competitorId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete competitor");
      }

      setDeletingCompetitorId(null);
      await loadCompetitors(workspaceId, accessToken);
    } catch (error) {
      console.error("Failed to delete competitor:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setNewCompetitorName("");
    setNewCompetitorWebsite("");
    setEditingCompetitor(null);
    closeCompetitorsDialog();
  };

  return (
    <>
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
                background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BusinessIcon sx={{ color: "white", fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
                Competitors
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                Track your competitors
              </Typography>
            </Box>
          </Box>

          {/* Competitors List */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {isLoadingCompetitors ? (
              <Grid container spacing={1.5}>
                {[0, 1, 2, 3].map((index) => (
                  <Grid item xs={6} key={index}>
                    <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                  </Grid>
                ))}
              </Grid>
            ) : competitors.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  background: alpha(theme.palette.grey[500], 0.06),
                  border: `1px solid ${alpha(theme.palette.grey[500], 0.15)}`,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 120,
                }}
              >
                <BusinessIcon
                  sx={{
                    fontSize: 40,
                    color: theme.palette.text.secondary,
                    opacity: 0.5,
                    mb: 1,
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  No competitors added yet
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Click "Add Competitor" to get started
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {competitors.map((competitor) => (
                  <Grid item xs={6} key={competitor.id}>
                    <Box
                      className="competitor-card"
                      sx={{
                        position: "relative",
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.secondary.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                        transition: "all 0.2s ease-in-out",
                        height: "100%",
                        minHeight: 80,
                        display: "flex",
                        flexDirection: "column",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.secondary.main, 0.12),
                          borderColor: alpha(theme.palette.secondary.main, 0.4),
                          transform: "translateY(-2px)",
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.15)}`,
                          "& .action-buttons": {
                            opacity: 1,
                          },
                        },
                      }}
                    >
                      {/* Edit/Delete Actions */}
                      <Box
                        className="action-buttons"
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          display: "flex",
                          gap: 0.5,
                          opacity: 0,
                          transition: "opacity 0.2s ease-in-out",
                        }}
                      >
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditCompetitor(competitor)}
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: alpha(theme.palette.background.paper, 0.9),
                              backdropFilter: "blur(8px)",
                              color: theme.palette.secondary.main,
                              "&:hover": {
                                bgcolor: theme.palette.secondary.main,
                                color: "white",
                              },
                            }}
                          >
                            <EditIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => setDeletingCompetitorId(competitor.id)}
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: alpha(theme.palette.background.paper, 0.9),
                              backdropFilter: "blur(8px)",
                              color: theme.palette.error.main,
                              "&:hover": {
                                bgcolor: theme.palette.error.main,
                                color: "white",
                              },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Competitor Content */}
                      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1.5,
                              bgcolor: alpha(theme.palette.secondary.main, 0.15),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <BusinessIcon
                              sx={{
                                color: theme.palette.secondary.main,
                                fontSize: 18,
                              }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: theme.palette.text.primary,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                          >
                            {competitor.name}
                          </Typography>
                        </Box>
                        {competitor.website && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              mt: "auto",
                            }}
                          >
                            <LanguageIcon
                              sx={{
                                fontSize: 14,
                                color: theme.palette.text.secondary,
                                opacity: 0.7,
                              }}
                            />
                            <Link
                              href={competitor.website.startsWith("http") ? competitor.website : `https://${competitor.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                fontSize: "0.75rem",
                                color: theme.palette.secondary.main,
                                textDecoration: "none",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              {competitor.website.replace(/^https?:\/\//, "")}
                            </Link>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Add More Button */}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={openCompetitorsDialog}
              sx={{
                mt: "auto",
                borderColor: alpha(theme.palette.secondary.main, 0.3),
                color: theme.palette.secondary.main,
                "&:hover": {
                  borderColor: theme.palette.secondary.main,
                  bgcolor: alpha(theme.palette.secondary.main, 0.08),
                },
              }}
            >
              Add Competitor
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Add/Edit Competitor Dialog */}
      <Dialog
        open={competitorsDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCompetitor ? "Edit Competitor" : "Add Competitor"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Competitor Name"
              value={newCompetitorName}
              onChange={(e) => setNewCompetitorName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Acme Corp"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Website (Optional)"
              value={newCompetitorWebsite}
              onChange={(e) => setNewCompetitorWebsite(e.target.value)}
              fullWidth
              placeholder="e.g., https://acme.com"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={editingCompetitor ? handleUpdateCompetitor : handleAddCompetitor}
            variant="contained"
            disabled={!newCompetitorName.trim() || isSaving}
          >
            {isSaving
              ? editingCompetitor
                ? "Updating..."
                : "Adding..."
              : editingCompetitor
              ? "Update"
              : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deletingCompetitorId !== null}
        onClose={() => setDeletingCompetitorId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Competitor</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this competitor? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingCompetitorId(null)}>Cancel</Button>
          <Button
            onClick={() => deletingCompetitorId && handleDeleteCompetitor(deletingCompetitorId)}
            variant="contained"
            color="error"
            disabled={isSaving}
          >
            {isSaving ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
