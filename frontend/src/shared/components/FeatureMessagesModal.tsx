import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MessageIcon from '@mui/icons-material/Message';
import PersonIcon from '@mui/icons-material/Person';
import TagIcon from '@mui/icons-material/Tag';

interface Message {
  id: string;
  content: string;
  sent_at: string;
  sender_name: string | null;
  channel_name: string | null;
}

interface FeatureMessagesModalProps {
  open: boolean;
  onClose: () => void;
  featureId: string;
  featureName: string;
  workspaceId: string;
}

const FeatureMessagesModal: React.FC<FeatureMessagesModalProps> = ({
  open,
  onClose,
  featureId,
  featureName,
  workspaceId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = () => {
    try {
      const authData = localStorage.getItem('headway-auth');
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        return parsedAuth.state?.tokens?.access_token;
      }
    } catch (error) {
      console.warn('Failed to parse auth data');
    }
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchMessages = async () => {
    if (!featureId || !open) return;

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/features/features/${featureId}/messages?workspace_id=${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [featureId, open, workspaceId]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <MessageIcon color="primary" />
            <Typography variant="h6">
              Messages for "{featureName}"
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading messages...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {messages.length} message{messages.length !== 1 ? 's' : ''} related to this feature
            </Typography>

            {messages.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No messages found for this feature
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                {messages.map((message) => (
                  <Card
                    key={message.id}
                    variant="outlined"
                    sx={{ mb: 2, '&:last-child': { mb: 0 } }}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          {message.sender_name && (
                            <Chip
                              icon={<PersonIcon />}
                              label={message.sender_name}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {message.channel_name && (
                            <Chip
                              icon={<TagIcon />}
                              label={message.channel_name}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(message.sent_at)}
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeatureMessagesModal;