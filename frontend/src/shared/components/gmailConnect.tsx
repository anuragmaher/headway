import { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useGmailStore } from "@/shared/store/gmailStore";
import { useWorkspaceSettingsStore } from "@/shared/store/WorkspaceStore/workspaceSettingsStore";

const GmailConnectModal = () => {
  const theme = useTheme();
  const loadGmailAccounts = useWorkspaceSettingsStore((state) => state.loadGmailAccounts);

  const {
    open,
    step,
    labels,
    selected,
    loading,
    error,
    closeModal,
    startConnect,
    openModal,
    loadLabels,
    toggleLabel,
    saveLabels,
  } = useGmailStore();

  /**
   * When modal opens after OAuth redirect
   * automatically load labels
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("gmail") === "connected") {
      // 1️⃣ Re-open modal
      openModal();

      // 2️⃣ Move to labels step
      useGmailStore.setState({ step: "labels" });

      // 3️⃣ Fetch labels
      loadLabels();

      // 4️⃣ Clean URL (optional but recommended)
      window.history.replaceState(
        {},
        "",
        "/app/settings/workspace"
      );
    }
  }, []);

  return (
    <Dialog
      open={open}
      onClose={closeModal}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.background.paper,
            0.95
          )} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
        },
      }}
    >
      {/* ================= TITLE ================= */}
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.3rem", pb: 1 }}>
        📧 Connect Gmail
      </DialogTitle>

      {/* ================= CONTENT ================= */}
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        {/* -------- STEP: IDLE (CONNECT) -------- */}
        {step === "idle" && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect your Gmail account to fetch customer feedback and feature
              requests.
            </Typography>

            <Box textAlign="center">
              <Button
                variant="contained"
                onClick={startConnect}
                sx={{
                  borderRadius: 2,
                  px: 4,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                }}
              >
                Connect Gmail
              </Button>
            </Box>
          </>
        )}

        {/* -------- STEP: LABEL SELECTION -------- */}
        {step === "labels" && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the Gmail labels you want to monitor.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box
                sx={{
                  maxHeight: 300,
                  overflowY: "auto",
                  pr: 1,
                }}
              >
                {labels.map((label) => (
                  <FormControlLabel
                    key={label.id}
                    control={
                      <Checkbox
                        checked={selected.some(l => l.id === label.id)}
                        onChange={() => toggleLabel(label)}
                      />
                    }
                    label={label.name}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 1,
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}

        {/* -------- STEP: SAVING -------- */}
        {step === "saving" && (
          <Box textAlign="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Saving selected labels...
            </Typography>
          </Box>
        )}
      </DialogContent>

      {/* ================= ACTIONS ================= */}
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={closeModal} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>

        {step === "labels" && (
          <Button
            variant="contained"
            onClick={async () => {
              try {
                await saveLabels();
                // Reload Gmail accounts after successful save
                await loadGmailAccounts();
              } catch (error) {
                // Error is already handled in saveLabels
              }
            }}
            disabled={!selected.length}
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            Save Labels
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default GmailConnectModal;
