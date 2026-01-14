/**
 * Connector Details Dialog Component
 * Shows details for Gong and Fathom connectors
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";
import { connectorService } from "@/services/connectors";
import type { ConnectorResponse } from "@/services/connectors";

interface ConnectorDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  connectorId: string | null;
  connectorType: "gong" | "fathom" | null;
  workspaceId: string | null;
}

export function ConnectorDetailsDialog({
  open,
  onClose,
  connectorId,
  connectorType,
  workspaceId,
}: ConnectorDetailsDialogProps): JSX.Element {
  const theme = useTheme();
  const [connector, setConnector] = useState<ConnectorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (open && connectorId && workspaceId) {
      loadConnectorDetails();
    } else {
      setConnector(null);
      setError(null);
    }
  }, [open, connectorId, workspaceId]);

  const loadConnectorDetails = async () => {
    if (!connectorId || !workspaceId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await connectorService.getConnector(workspaceId, connectorId);
      setConnector(data);
    } catch (err: any) {
      console.error("Failed to load connector details:", err);
      setError(err.response?.data?.detail || "Failed to load connector details");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskValue = (value: string | undefined): string => {
    if (!value) return "";
    if (value.length <= 4) return "***";
    return value.substring(0, 4) + "***";
  };

  const getConnectorTitle = () => {
    if (connectorType === "gong") return "Gong Connector Details";
    if (connectorType === "fathom") return "Fathom Connector Details";
    return "Connector Details";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
        {getConnectorTitle()}
      </DialogTitle>

      <DialogContent 
        sx={{ 
          pt: 3,
          px: 3,
          pb: 2,
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2.5,
              borderRadius: 1.5,
              "& .MuiAlert-message": {
                fontSize: "0.875rem",
              },
            }}
          >
            {error}
          </Alert>
        ) : connector ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {connectorType === "gong" && (
              <>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      mb: 1,
                    }}
                  >
                    Access Key
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={
                      showAccessKey
                        ? connector.gong_access_key || ""
                        : maskValue(connector.gong_access_key)
                    }
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowAccessKey(!showAccessKey)}
                            sx={{ mr: 0.5 }}
                          >
                            {showAccessKey ? (
                              <VisibilityOffIcon fontSize="small" />
                            ) : (
                              <VisibilityIcon fontSize="small" />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleCopy(connector.gong_access_key || "", "accessKey")
                            }
                          >
                            <ContentCopyIcon
                              fontSize="small"
                              sx={{
                                color:
                                  copied === "accessKey"
                                    ? theme.palette.success.main
                                    : "inherit",
                              }}
                            />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.background.paper, 0.5),
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.background.paper, 0.7),
                        },
                        "&.Mui-focused": {
                          bgcolor: alpha(theme.palette.background.paper, 0.9),
                          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
                        },
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      mb: 1,
                    }}
                  >
                    Secret Key
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={
                      showSecretKey
                        ? connector.gong_secret_key || ""
                        : maskValue(connector.gong_secret_key)
                    }
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            sx={{ mr: 0.5 }}
                          >
                            {showSecretKey ? (
                              <VisibilityOffIcon fontSize="small" />
                            ) : (
                              <VisibilityIcon fontSize="small" />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleCopy(connector.gong_secret_key || "", "secretKey")
                            }
                          >
                            <ContentCopyIcon
                              fontSize="small"
                              sx={{
                                color:
                                  copied === "secretKey"
                                    ? theme.palette.success.main
                                    : "inherit",
                              }}
                            />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.background.paper, 0.5),
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.background.paper, 0.7),
                        },
                        "&.Mui-focused": {
                          bgcolor: alpha(theme.palette.background.paper, 0.9),
                          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
                        },
                      },
                    }}
                  />
                </Box>
              </>
            )}

            {connectorType === "fathom" && (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    mb: 1,
                  }}
                >
                  API Token
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={
                    showApiToken
                      ? connector.fathom_api_token || ""
                      : maskValue(connector.fathom_api_token)
                  }
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowApiToken(!showApiToken)}
                          sx={{ mr: 0.5 }}
                        >
                          {showApiToken ? (
                            <VisibilityOffIcon fontSize="small" />
                          ) : (
                            <VisibilityIcon fontSize="small" />
                          )}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(connector.fathom_api_token || "", "apiToken")
                          }
                        >
                          <ContentCopyIcon
                            fontSize="small"
                            sx={{
                              color:
                                copied === "apiToken"
                                  ? theme.palette.success.main
                                  : "inherit",
                            }}
                          />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.background.paper, 0.5),
                    },
                  }}
                />
              </Box>
            )}

            <Box 
              sx={{ 
                mt: 1,
                pt: 2,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ 
                  fontSize: "0.75rem", 
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                Created: {new Date(connector.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 3,
          pt: 2,
          px: 3,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
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
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
