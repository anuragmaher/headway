/**
 * Notification Snackbars Component
 */

import { Snackbar, Alert } from "@mui/material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";

export function NotificationSnackbars(): JSX.Element {
  const {
    error,
    connectorError,
    connectorSuccess,
    setError,
    setConnectorError,
    setConnectorSuccess,
  } = useWorkspaceSettingsStore((state) => ({
    error: state.error,
    connectorError: state.connectorError,
    connectorSuccess: state.connectorSuccess,
    setError: state.setError,
    setConnectorError: state.setConnectorError,
    setConnectorSuccess: state.setConnectorSuccess,
  }));

  return (
    <>
      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Snackbar>

      {/* Connector Error Snackbar */}
      <Snackbar
        open={!!connectorError}
        autoHideDuration={6000}
        onClose={() => setConnectorError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setConnectorError(null)} severity="error" sx={{ borderRadius: 2 }}>
          {connectorError}
        </Alert>
      </Snackbar>

      {/* Success Snackbar for Connectors */}
      <Snackbar
        open={connectorSuccess}
        autoHideDuration={4000}
        onClose={() => setConnectorSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setConnectorSuccess(false)}
          severity="success"
          sx={{ borderRadius: 2 }}
        >
          Operation completed successfully!
        </Alert>
      </Snackbar>
    </>
  );
}
