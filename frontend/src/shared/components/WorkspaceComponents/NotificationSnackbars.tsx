/**
 * Notification Snackbars Component
 */

import { Snackbar, Alert } from "@mui/material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";

export function NotificationSnackbars(): JSX.Element {
  const {
    error,
    connectorSuccess,
    setError,
    setConnectorSuccess,
  } = useWorkspaceSettingsStore((state) => ({
    error: state.error,
    connectorSuccess: state.connectorSuccess,
    setError: state.setError,
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
          Connectors saved successfully!
        </Alert>
      </Snackbar>
    </>
  );
}
