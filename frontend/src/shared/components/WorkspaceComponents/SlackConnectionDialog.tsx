/**
 * Slack Connection Dialog Component
 */

import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  IconButton,
  CircularProgress,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Close as CloseIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Group as GroupIcon,
} from "@mui/icons-material";
import { useWorkspaceSettingsStore } from "../../store/WorkspaceStore/workspaceSettingsStore";
import { SlackIcon } from "../../utils/WorkspaceUtils";

export function SlackConnectionDialog(): JSX.Element {
  const theme = useTheme();

  const {
    slackDialogOpen,
    slackTokens,
    connectionStep,
    isLoadingChannels,
    isConnecting,
    error,
    teamInfo,
    channelSearch,
    selectedChannels,
    closeSlackDialog,
    setSlackUserToken,
    setChannelSearch,
    toggleChannel,
    validateTokensAndGetChannels,
    connectSlackWorkspace,
    getFilteredChannels,
  } = useWorkspaceSettingsStore((state) => ({
    slackDialogOpen: state.slackDialogOpen,
    slackTokens: state.slackTokens,
    connectionStep: state.connectionStep,
    isLoadingChannels: state.isLoadingChannels,
    isConnecting: state.isConnecting,
    error: state.error,
    teamInfo: state.teamInfo,
    channelSearch: state.channelSearch,
    selectedChannels: state.selectedChannels,
    closeSlackDialog: state.closeSlackDialog,
    setSlackUserToken: state.setSlackUserToken,
    setChannelSearch: state.setChannelSearch,
    toggleChannel: state.toggleChannel,
    validateTokensAndGetChannels: state.validateTokensAndGetChannels,
    connectSlackWorkspace: state.connectSlackWorkspace,
    getFilteredChannels: state.getFilteredChannels,
  }));

  const filteredChannels = getFilteredChannels();
  const availableChannels = useWorkspaceSettingsStore((state) => state.availableChannels);

  return (
    <Dialog
      open={slackDialogOpen}
      onClose={closeSlackDialog}
      maxWidth="lg"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.background.paper,
            0.95
          )} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
          backdropFilter: "blur(10px)",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
            <SlackIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Connect Slack Workspace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {connectionStep === "tokens"
                ? "Enter your Slack tokens"
                : `Select channels from ${teamInfo?.team_name || "your workspace"}`}
            </Typography>
          </Box>
          <IconButton onClick={closeSlackDialog} sx={{ ml: "auto" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {connectionStep === "tokens" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              To connect your Slack workspace, you'll need your user token. This token allows
              HeadwayHQ to read messages from your selected channels.
            </Typography>

            <TextField
              label="User Token (xoxp-...)"
              value={slackTokens.userToken}
              onChange={(e) => setSlackUserToken(e.target.value)}
              fullWidth
              placeholder="xoxp-your-user-token"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Box>
        )}

        {connectionStep === "channels" && (
          <Box>
            {isLoadingChannels ? (
              <Box
                sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4 }}
              >
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Loading channels from {teamInfo?.team_name}...
                </Typography>
              </Box>
            ) : (
              <>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Select up to 5 channels to monitor for feature requests and customer feedback.
                  </Typography>

                  <TextField
                    placeholder="Search channels..."
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.8),
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>🔍</Box>
                      ),
                    }}
                  />

                  <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {filteredChannels.length === 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          py: 4,
                          color: "text.secondary",
                        }}
                      >
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          No channels found
                        </Typography>
                        <Typography variant="caption">
                          Try adjusting your search terms
                        </Typography>
                      </Box>
                    ) : (
                      <List>
                        {filteredChannels.map((channel) => (
                          <ListItem
                            key={channel.id}
                            sx={{
                              borderRadius: 2,
                              mb: 1,
                              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                              background: selectedChannels.includes(channel.id)
                                ? alpha(theme.palette.primary.main, 0.1)
                                : "transparent",
                            }}
                          >
                            <ListItemIcon>
                              <Checkbox
                                checked={selectedChannels.includes(channel.id)}
                                onChange={() => toggleChannel(channel.id)}
                                disabled={
                                  !selectedChannels.includes(channel.id) &&
                                  selectedChannels.length >= 5
                                }
                              />
                            </ListItemIcon>
                            <ListItemIcon>
                              {channel.is_private ? <LockIcon /> : <PublicIcon />}
                            </ListItemIcon>
                            <ListItemText
                              primary={`#${channel.name}`}
                              secondary={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                  <GroupIcon sx={{ fontSize: 14 }} />
                                  <Typography variant="caption">
                                    {channel.member_count || 0} members
                                  </Typography>
                                  {channel.purpose && (
                                    <Typography variant="caption" sx={{ ml: 1 }}>
                                      • {channel.purpose}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>

                  <Box
                    sx={{
                      mt: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Selected: {selectedChannels.length}/5 channels
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Showing {filteredChannels.length} of {availableChannels.length} channels
                    </Typography>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={closeSlackDialog} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>

        {connectionStep === "tokens" ? (
          <Button
            variant="contained"
            onClick={validateTokensAndGetChannels}
            disabled={!slackTokens.userToken || isLoadingChannels}
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          >
            {isLoadingChannels ? <CircularProgress size={20} /> : "Next"}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={connectSlackWorkspace}
            disabled={selectedChannels.length === 0 || isConnecting}
            sx={{
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
            }}
          >
            {isConnecting ? <CircularProgress size={20} /> : "Connect"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
