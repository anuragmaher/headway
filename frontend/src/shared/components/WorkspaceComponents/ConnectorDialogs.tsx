/**
 * Gong and Fathom Connector Dialogs Component
 */

import {
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
} from "@mui/material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { useAuthStore } from "@/features/auth/store/auth-store";

export function GongConnectorDialog(): JSX.Element {
  const theme = useTheme();
  const auth = useAuthStore();

  const {
    gongDialogOpen,
    gongAccessKey,
    gongSecretKey,
    isSavingConnectors,
    connectorError,
    closeGongDialog,
    setGongAccessKey,
    setGongSecretKey,
    saveGongConnector,
  } = useWorkspaceSettingsStore((state) => ({
    gongDialogOpen: state.gongDialogOpen,
    gongAccessKey: state.gongAccessKey,
    gongSecretKey: state.gongSecretKey,
    isSavingConnectors: state.isSavingConnectors,
    connectorError: state.connectorError,
    closeGongDialog: state.closeGongDialog,
    setGongAccessKey: state.setGongAccessKey,
    setGongSecretKey: state.setGongSecretKey,
    saveGongConnector: state.saveGongConnector,
  }));

  const handleSave = () => {
    const workspaceId = auth.tokens?.workspace_id;
    if (workspaceId) {
      saveGongConnector(workspaceId);
    }
  };

  return (
    <Dialog
      open={gongDialogOpen}
      onClose={closeGongDialog}
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
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.3rem", pb: 1 }}>
        🎤 Connect Gong
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your Gong API credentials to connect your account
        </Typography>
        {connectorError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            {connectorError}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Access Key"
          value={gongAccessKey}
          onChange={(e) => setGongAccessKey(e.target.value)}
          placeholder="Enter your Gong access key"
          margin="normal"
          type="password"
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
        />
        <TextField
          fullWidth
          label="Secret Key"
          value={gongSecretKey}
          onChange={(e) => setGongSecretKey(e.target.value)}
          placeholder="Enter your Gong secret key"
          margin="normal"
          type="password"
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={closeGongDialog} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSavingConnectors || !gongAccessKey || !gongSecretKey}
          sx={{
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }}
        >
          {isSavingConnectors ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function FathomConnectorDialog(): JSX.Element {
  const theme = useTheme();
  const auth = useAuthStore();

  const {
    fathomDialogOpen,
    fathomApiToken,
    isSavingConnectors,
    connectorError,
    closeFathomDialog,
    setFathomApiToken,
    saveFathomConnector,
  } = useWorkspaceSettingsStore((state) => ({
    fathomDialogOpen: state.fathomDialogOpen,
    fathomApiToken: state.fathomApiToken,
    isSavingConnectors: state.isSavingConnectors,
    connectorError: state.connectorError,
    closeFathomDialog: state.closeFathomDialog,
    setFathomApiToken: state.setFathomApiToken,
    saveFathomConnector: state.saveFathomConnector,
  }));

  const handleSave = () => {
    const workspaceId = auth.tokens?.workspace_id;
    if (workspaceId) {
      saveFathomConnector(workspaceId);
    }
  };

  return (
    <Dialog
      open={fathomDialogOpen}
      onClose={closeFathomDialog}
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
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.3rem", pb: 1 }}>
        📹 Connect Fathom
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your Fathom API credentials to connect your account
        </Typography>
        {connectorError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            {connectorError}
          </Alert>
        )}
        <TextField
          fullWidth
          label="API Token"
          value={fathomApiToken}
          onChange={(e) => setFathomApiToken(e.target.value)}
          placeholder="Enter your Fathom API token"
          margin="normal"
          type="password"
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={closeFathomDialog} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSavingConnectors || !fathomApiToken}
          sx={{
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
          }}
        >
          {isSavingConnectors ? <CircularProgress size={20} /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
