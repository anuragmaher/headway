/**
 * Gmail Details Dialog Component
 * Shows selected labels and allows adding more
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { fetchLabels, getSelectedLabels, saveSelectedLabels } from "@/services/gmail";
import type { GmailLabel } from "@/shared/types/GmailTypes";

interface GmailDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
}

export function GmailDetailsDialog({
  open,
  onClose,
  accountId,
}: GmailDetailsDialogProps): JSX.Element {
  const theme = useTheme();
  const [selectedLabels, setSelectedLabels] = useState<GmailLabel[]>([]);
  const [allLabels, setAllLabels] = useState<GmailLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open && accountId) {
      loadLabels();
    } else {
      setSelectedLabels([]);
      setAllLabels([]);
      setError(null);
      setSuccess(false);
      setSearchQuery("");
    }
  }, [open, accountId]);

  const loadLabels = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load selected labels
      const selected = await getSelectedLabels();
      setSelectedLabels(selected);

      // Load all available labels from /gmail/labels endpoint
      const fetchedLabels = await fetchLabels();
      
      // Store all labels (we'll filter dynamically)
      setAllLabels(fetchedLabels);
    } catch (err: any) {
      console.error("Failed to load labels:", err);
      setError(err.response?.data?.detail || "Failed to load labels");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLabel = (label: GmailLabel) => {
    const isSelected = selectedLabels.some((l) => l.id === label.id);
    if (isSelected) {
      setSelectedLabels(selectedLabels.filter((l) => l.id !== label.id));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await saveSelectedLabels(selectedLabels);
      setSuccess(true);
      // Reload labels to refresh the available labels list
      await loadLabels();
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error("Failed to save labels:", err);
      setError(err.response?.data?.detail || "Failed to save labels");
    } finally {
      setSaving(false);
    }
  };

  // Compute available labels dynamically based on selected labels
  const selectedIds = new Set(selectedLabels.map((l) => l.id));
  const systemLabelIds = new Set(["INBOX", "SENT", "DRAFT", "SPAM", "TRASH", "UNREAD", "STARRED", "IMPORTANT"]);
  
  const availableLabels = allLabels.filter(
    (label) => {
      // Skip if already selected
      if (selectedIds.has(label.id)) {
        return false;
      }
      
      // Only skip very specific system labels by ID (not by type, as IMAP labels might have different types)
      if (systemLabelIds.has(label.id)) {
        return false;
      }
      
      // Include all other labels (user labels, IMAP labels, etc.)
      return true;
    }
  );

  const filteredAvailableLabels = availableLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.background.paper,
            0.98
          )} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: "1.25rem",
          pb: 2,
          pt: 3,
          px: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          letterSpacing: "-0.01em",
        }}
      >
        Gmail Labels Configuration
      </DialogTitle>

      <DialogContent 
        sx={{ 
          pt: 3,
          px: 3,
          pb: 2,
          overflow: "hidden", // Prevent entire content from scrolling
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0, // Important for flex children to shrink
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4, flex: 1 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 2.5 }}>
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  borderRadius: 1.5,
                  "& .MuiAlert-message": {
                    fontSize: "0.875rem",
                  },
                }}
              >
                {error}
              </Alert>
            )}

            {success && (
              <Alert 
                severity="success" 
                sx={{ 
                  borderRadius: 1.5,
                  "& .MuiAlert-message": {
                    fontSize: "0.875rem",
                  },
                }}
              >
                Labels saved successfully!
              </Alert>
            )}

            {/* Selected Labels Section - Fixed */}
            <Box sx={{ flexShrink: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    color: "text.primary",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Selected Labels
                </Typography>
                <Chip
                  label={selectedLabels.length}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    height: 24,
                    borderRadius: 1.5,
                  }}
                />
              </Box>
              {selectedLabels.length === 0 ? (
                <Box
                  sx={{
                    py: 2,
                    px: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.paper, 0.4),
                    border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ 
                      fontStyle: "italic",
                      fontSize: "0.875rem",
                      textAlign: "center",
                    }}
                  >
                    No labels selected. Select labels below to start collecting emails.
                  </Typography>
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    display: "flex", 
                    flexWrap: "wrap", 
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    minHeight: 56,
                  }}
                >
                  {selectedLabels.map((label) => (
                    <Chip
                      key={label.id}
                      label={label.name}
                      onDelete={() => handleToggleLabel(label)}
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: theme.palette.primary.main,
                        fontWeight: 500,
                        fontSize: "0.8125rem",
                        height: 32,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.22),
                          transform: "translateY(-2px)",
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                        "& .MuiChip-deleteIcon": {
                          color: theme.palette.primary.main,
                          fontSize: "1.1rem",
                          transition: "all 0.2s ease-in-out",
                          "&:hover": {
                            color: theme.palette.primary.dark,
                            transform: "scale(1.15)",
                          },
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Available Labels Section - Scrollable */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    color: "text.primary",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Available Labels
                </Typography>
                <Chip
                  label={filteredAvailableLabels.length}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.12),
                    color: theme.palette.success.main,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    height: 24,
                    borderRadius: 1.5,
                  }}
                />
              </Box>

              <TextField
                fullWidth
                size="small"
                placeholder="Search labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 2,
                  flexShrink: 0,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                    "&.Mui-focused": {
                      bgcolor: alpha(theme.palette.background.paper, 0.95),
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
                    },
                  },
                }}
              />

              {/* Scrollable Labels List */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.4),
                  // Custom scrollbar styling
                  "&::-webkit-scrollbar": {
                    width: "8px",
                  },
                  "&::-webkit-scrollbar-track": {
                    background: alpha(theme.palette.background.paper, 0.3),
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: alpha(theme.palette.primary.main, 0.3),
                    borderRadius: "4px",
                    "&:hover": {
                      background: alpha(theme.palette.primary.main, 0.5),
                    },
                  },
                  scrollbarWidth: "thin",
                  scrollbarColor: `${alpha(theme.palette.primary.main, 0.3)} ${alpha(theme.palette.background.paper, 0.3)}`,
                }}
              >
                {filteredAvailableLabels.length === 0 ? (
                  <Box
                    sx={{
                      py: 4,
                      px: 2,
                      textAlign: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ 
                        fontStyle: "italic",
                        fontSize: "0.875rem",
                      }}
                    >
                      {searchQuery
                        ? "No labels found matching your search."
                        : "No additional labels available."}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 1.5 }}>
                    {filteredAvailableLabels.map((label, index) => {
                      const isSelected = selectedLabels.some((l) => l.id === label.id);
                      return (
                        <Box
                          key={label.id}
                          sx={{
                            mb: index < filteredAvailableLabels.length - 1 ? 0.5 : 0,
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleToggleLabel(label)}
                                size="small"
                                sx={{
                                  color: theme.palette.primary.main,
                                  "&.Mui-checked": {
                                    color: theme.palette.primary.main,
                                  },
                                  transition: "all 0.2s ease-in-out",
                                  "&:hover": {
                                    transform: "scale(1.15)",
                                  },
                                }}
                              />
                            }
                            label={
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: "0.875rem",
                                  fontWeight: isSelected ? 600 : 400,
                                  color: isSelected ? theme.palette.primary.main : "text.primary",
                                  transition: "all 0.2s ease-in-out",
                                }}
                              >
                                {label.name}
                              </Typography>
                            }
                            sx={{
                              display: "flex",
                              px: 1.5,
                              py: 1,
                              borderRadius: 1.5,
                              transition: "all 0.2s ease-in-out",
                              cursor: "pointer",
                              bgcolor: isSelected 
                                ? alpha(theme.palette.primary.main, 0.08)
                                : "transparent",
                              border: isSelected
                                ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                                : `1px solid transparent`,
                              "&:hover": {
                                bgcolor: alpha(theme.palette.primary.main, 0.12),
                                borderColor: alpha(theme.palette.primary.main, 0.3),
                                transform: "translateX(4px)",
                              },
                              "&:active": {
                                transform: "translateX(2px)",
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 3,
          pt: 2,
          px: 3,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          gap: 1.5,
        }}
      >
        <Button 
          onClick={onClose} 
          sx={{ 
            borderRadius: 2, 
            textTransform: "none",
            fontWeight: 500,
            px: 2.5,
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              bgcolor: alpha(theme.palette.text.secondary, 0.08),
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: "white" }} /> : <AddIcon />}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
            },
            "&:disabled": {
              transform: "none",
            },
          }}
        >
          {saving ? "Saving..." : "Save Labels"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
