/**
 * Way - AI Personal Assistant Page
 * Helps users create themes and sub-themes from messages using AI
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  IconButton,
  Divider,
  alpha,
  useTheme,
  TextField,
  Grid,
  Drawer,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Psychology as AiIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  AutoAwesome as SparkleIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Category as ThemeIcon,
  DataObject as DataIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { API_BASE_URL } from '@/config/api.config';

// TODO: Replace with dynamic workspace ID from auth context
const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

interface ThemeSuggestion {
  name: string;
  description: string;
  parent_theme_name: string | null;
  status?: 'pending' | 'accepted' | 'rejected';
  isEditing?: boolean;
}

interface DataExtractionSuggestion {
  field_name: string;
  field_type: 'customer_name' | 'mrr' | 'urgency' | 'product' | 'custom';
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  description: string;
  example_values: string[];
  status?: 'pending' | 'accepted' | 'rejected';
}

interface AnalyzeResponse {
  theme_suggestions: ThemeSuggestion[];
  data_extraction_suggestions: DataExtractionSuggestion[];
  message_count: number;
}

interface EditableCardProps {
  suggestion: ThemeSuggestion;
  onSave: (updated: ThemeSuggestion) => void;
  onCancel: () => void;
  theme: any;
}

function EditableCard({ suggestion, onSave, onCancel, theme }: EditableCardProps): JSX.Element {
  const [editedName, setEditedName] = useState(suggestion.name);
  const [editedDescription, setEditedDescription] = useState(suggestion.description);

  const handleSave = () => {
    onSave({
      ...suggestion,
      name: editedName,
      description: editedDescription,
    });
  };

  return (
    <Box>
      <TextField
        fullWidth
        label="Theme Name"
        value={editedName}
        onChange={(e) => setEditedName(e.target.value)}
        sx={{ mb: 2 }}
        autoFocus
      />
      <TextField
        fullWidth
        label="Description"
        value={editedDescription}
        onChange={(e) => setEditedDescription(e.target.value)}
        multiline
        rows={3}
        sx={{ mb: 2 }}
      />
      {suggestion.parent_theme_name && (
        <Chip
          label={`Sub-theme of: ${suggestion.parent_theme_name}`}
          size="small"
          variant="outlined"
          sx={{ mb: 2 }}
        />
      )}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}

export function WayPage(): JSX.Element {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ThemeSuggestion[]>([]);
  const [dataExtractionSuggestions, setDataExtractionSuggestions] = useState<DataExtractionSuggestion[]>([]);
  const [messageCount, setMessageCount] = useState<number>(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'themes' | 'dataFields'>('themes');
  const [existingThemes, setExistingThemes] = useState<any[]>([]);
  const [existingDataFields, setExistingDataFields] = useState<any[]>([]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get token from Zustand auth store
      const authData = localStorage.getItem('headway-auth');
      if (!authData) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;

      if (!token) {
        throw new Error('No access token found. Please log in again.');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/way/analyze-messages?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze messages');
      }

      const data: AnalyzeResponse = await response.json();

      // Add status field to each suggestion
      const suggestionsWithStatus = data.theme_suggestions.map(s => ({
        ...s,
        status: 'pending' as const,
      }));

      const dataExtractionWithStatus = (data.data_extraction_suggestions || []).map(s => ({
        ...s,
        status: 'pending' as const,
      }));

      // Append new suggestions to existing ones
      setSuggestions(prev => [...prev, ...suggestionsWithStatus]);
      setDataExtractionSuggestions(prev => [...prev, ...dataExtractionWithStatus]);
      setMessageCount(data.message_count);
      setSuccess(`Analyzed ${data.message_count} messages and found ${data.theme_suggestions.length} theme suggestions and ${dataExtractionWithStatus.length} data extraction suggestions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze messages');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (index: number) => {
    const suggestion = suggestions[index];

    try {
      // Get token from Zustand auth store
      const authData = localStorage.getItem('headway-auth');
      if (!authData) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;

      if (!token) {
        throw new Error('No access token found. Please log in again.');
      }

      // Find parent theme ID if this is a sub-theme
      let parentThemeId: string | null = null;
      if (suggestion.parent_theme_name) {
        // We'll need to implement theme lookup/creation logic here
        // For now, we'll just create the theme
        console.log('Parent theme:', suggestion.parent_theme_name);
      }

      // Create the theme
      const response = await fetch(`${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: suggestion.name,
          description: suggestion.description,
          parent_theme_id: parentThemeId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create theme');
      }

      // Update suggestion status
      const newSuggestions = [...suggestions];
      newSuggestions[index] = { ...suggestion, status: 'accepted' };
      setSuggestions(newSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion');
    }
  };

  const handleReject = (index: number) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...suggestions[index], status: 'rejected' };
    setSuggestions(newSuggestions);
  };

  const handleEdit = (index: number) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...suggestions[index], isEditing: true };
    setSuggestions(newSuggestions);
  };

  const handleSaveEdit = (index: number, updatedSuggestion: ThemeSuggestion) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...updatedSuggestion, isEditing: false };
    setSuggestions(newSuggestions);
  };

  const handleCancelEdit = (index: number) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...suggestions[index], isEditing: false };
    setSuggestions(newSuggestions);
  };

  const handleAcceptDataField = async (index: number) => {
    const dataField = dataExtractionSuggestions[index];

    try {
      // Get token from Zustand auth store
      const authData = localStorage.getItem('headway-auth');
      if (!authData) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;

      if (!token) {
        throw new Error('No access token found. Please log in again.');
      }

      // Create the data extraction field
      const response = await fetch(`${API_BASE_URL}/api/v1/way/data-extraction-fields?workspace_id=${WORKSPACE_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field_name: dataField.field_name,
          field_type: dataField.field_type,
          data_type: dataField.data_type,
          description: dataField.description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create data extraction field');
      }

      // Update suggestion status
      const newDataSuggestions = [...dataExtractionSuggestions];
      newDataSuggestions[index] = { ...dataField, status: 'accepted' };
      setDataExtractionSuggestions(newDataSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept data field');
    }
  };

  const handleRejectDataField = (index: number) => {
    const newDataSuggestions = [...dataExtractionSuggestions];
    newDataSuggestions[index] = { ...dataExtractionSuggestions[index], status: 'rejected' };
    setDataExtractionSuggestions(newDataSuggestions);
  };

  const handleViewThemes = async () => {
    try {
      const authData = localStorage.getItem('headway-auth');
      if (!authData) return;

      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const themes = await response.json();
        setExistingThemes(themes);
        setDrawerType('themes');
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    }
  };

  const handleViewDataFields = async () => {
    try {
      const authData = localStorage.getItem('headway-auth');
      if (!authData) return;

      const parsedAuth = JSON.parse(authData);
      const token = parsedAuth.state?.tokens?.access_token;
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/way/data-extraction-fields?workspace_id=${WORKSPACE_ID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const fields = await response.json();
        setExistingDataFields(fields);
        setDrawerType('dataFields');
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch data fields:', err);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;

  return (
    <AdminLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AiIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Way
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your AI Personal Assistant
              </Typography>
            </Box>
          </Box>

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 1000 }}>
            Way analyzes your customer messages and suggests themes, sub-themes, and data extraction fields
            to help you organize feature requests at scale. Get AI-powered insights to build a better product
            taxonomy and extract valuable structured data from customer feedback.
          </Typography>
        </Box>

        {/* View Existing Data Buttons */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ThemeIcon />}
            onClick={handleViewThemes}
            sx={{ flex: 1 }}
          >
            View Existing Themes
          </Button>
          <Button
            variant="outlined"
            startIcon={<DataIcon />}
            onClick={handleViewDataFields}
            sx={{ flex: 1 }}
          >
            View Data Extraction Fields
          </Button>
        </Box>

        {/* Action Card */}
        <Card
          sx={{
            mb: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SparkleIcon sx={{ color: theme.palette.primary.main }} />
                  Analyze Messages
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Let AI analyze all your messages and suggest themes, sub-themes, and data extraction fields
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                onClick={handleAnalyze}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <AiIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  minWidth: 200,
                }}
              >
                {loading ? 'Analyzing...' : 'Start Analysis'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Stats */}
        {suggestions.length > 0 && (
          <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`${messageCount} messages analyzed`}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={`${suggestions.length} suggestions`}
              color="primary"
              sx={{ fontWeight: 600 }}
            />
            {acceptedCount > 0 && (
              <Chip
                label={`${acceptedCount} accepted`}
                color="success"
                sx={{ fontWeight: 600 }}
              />
            )}
            {rejectedCount > 0 && (
              <Chip
                label={`${rejectedCount} rejected`}
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        )}

        {/* Two Column Layout */}
        {(suggestions.length > 0 || dataExtractionSuggestions.length > 0) && (
          <Grid container spacing={3}>
            {/* Left Column - Theme Suggestions */}
            <Grid item xs={12} md={6}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                Theme Suggestions
              </Typography>
              <Stack spacing={2}>
                {suggestions.map((suggestion, index) => (
              <Card
                key={index}
                sx={{
                  opacity: suggestion.status === 'rejected' ? 0.5 : 1,
                  borderLeft: suggestion.status === 'accepted'
                    ? `4px solid ${theme.palette.success.main}`
                    : suggestion.status === 'rejected'
                    ? `4px solid ${theme.palette.grey[400]}`
                    : `4px solid ${theme.palette.primary.main}`,
                }}
              >
                <CardContent>
                  {suggestion.isEditing ? (
                    <EditableCard
                      suggestion={suggestion}
                      onSave={(updated) => handleSaveEdit(index, updated)}
                      onCancel={() => handleCancelEdit(index)}
                      theme={theme}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6" component="h3">
                            {suggestion.name}
                          </Typography>
                          {suggestion.parent_theme_name && (
                            <Chip
                              label={`Sub-theme of: ${suggestion.parent_theme_name}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {suggestion.status === 'accepted' && (
                            <Chip
                              label="Accepted"
                              size="small"
                              color="success"
                              icon={<AcceptIcon />}
                            />
                          )}
                          {suggestion.status === 'rejected' && (
                            <Chip
                              label="Rejected"
                              size="small"
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {suggestion.description}
                        </Typography>
                      </Box>

                      {suggestion.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            onClick={() => handleEdit(index)}
                            sx={{
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                              },
                            }}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            color="success"
                            onClick={() => handleAccept(index)}
                            sx={{
                              '&:hover': {
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                              },
                            }}
                            title="Accept"
                          >
                            <AcceptIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleReject(index)}
                            sx={{
                              '&:hover': {
                                bgcolor: alpha(theme.palette.grey[500], 0.1),
                              },
                            }}
                            title="Reject"
                          >
                            <RejectIcon />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
                ))}

                {/* Add More Button */}
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={handleAnalyze}
                  disabled={loading}
                  fullWidth
                  sx={{
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    py: 2,
                    '&:hover': {
                      borderStyle: 'dashed',
                      borderWidth: 2,
                    },
                  }}
                >
                  Add More Suggestions
                </Button>
              </Stack>
            </Grid>

            {/* Right Column - Data Extraction Suggestions */}
            <Grid item xs={12} md={6}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                Data Extraction
              </Typography>
              <Stack spacing={2}>
                {dataExtractionSuggestions.map((dataField, index) => (
                  <Card
                    key={index}
                    sx={{
                      opacity: dataField.status === 'rejected' ? 0.5 : 1,
                      borderLeft: dataField.status === 'accepted'
                        ? `4px solid ${theme.palette.success.main}`
                        : dataField.status === 'rejected'
                        ? `4px solid ${theme.palette.grey[400]}`
                        : `4px solid ${theme.palette.secondary.main}`,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="h6" component="h3">
                              {dataField.field_name}
                            </Typography>
                            <Chip
                              label={dataField.field_type}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                            <Chip
                              label={dataField.data_type}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            {dataField.status === 'accepted' && (
                              <Chip
                                label="Accepted"
                                size="small"
                                color="success"
                                icon={<AcceptIcon />}
                              />
                            )}
                            {dataField.status === 'rejected' && (
                              <Chip
                                label="Rejected"
                                size="small"
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {dataField.description}
                          </Typography>
                          {dataField.example_values && dataField.example_values.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Examples:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                {dataField.example_values.slice(0, 3).map((example, i) => (
                                  <Chip
                                    key={i}
                                    label={example}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>

                        {dataField.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              color="success"
                              onClick={() => handleAcceptDataField(index)}
                              sx={{
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.success.main, 0.1),
                                },
                              }}
                              title="Accept"
                            >
                              <AcceptIcon />
                            </IconButton>
                            <IconButton
                              onClick={() => handleRejectDataField(index)}
                              sx={{
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                                },
                              }}
                              title="Reject"
                            >
                              <RejectIcon />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}

                {dataExtractionSuggestions.length === 0 && (
                  <Card sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.secondary.main, 0.05) }}>
                    <Typography variant="body2" color="text.secondary">
                      No data extraction suggestions yet. Click "Start Analysis" to generate suggestions.
                    </Typography>
                  </Card>
                )}
              </Stack>
            </Grid>
          </Grid>
        )}

        {/* Empty State */}
        {!loading && suggestions.length === 0 && dataExtractionSuggestions.length === 0 && (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <AiIcon sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Suggestions Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click "Start Analysis" to let AI analyze your messages and suggest themes and data extraction fields
            </Typography>
          </Card>
        )}
      </Container>

      {/* Drawer for viewing existing themes and data fields */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            p: 3,
            top: 64, // Height of the top navigation bar
            height: 'calc(100% - 64px)',
          },
        }}
      >
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {drawerType === 'themes' ? 'Existing Themes' : 'Data Extraction Fields'}
          </Typography>
          <IconButton onClick={() => setDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {drawerType === 'themes' ? (
          <List>
            {existingThemes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No themes found
              </Typography>
            ) : (
              existingThemes.map((theme: any) => (
                <ListItem
                  key={theme.id}
                  sx={{
                    mb: 1,
                    border: `1px solid ${alpha(theme.palette?.divider || '#000', 0.1)}`,
                    borderRadius: 1,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2">{theme.name}</Typography>
                      {theme.parent_theme_id && (
                        <Chip label="Sub-theme" size="small" variant="outlined" />
                      )}
                    </Box>
                    {theme.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {theme.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={`${theme.feature_count} features`} size="small" />
                      {theme.sub_theme_count > 0 && (
                        <Chip label={`${theme.sub_theme_count} sub-themes`} size="small" />
                      )}
                    </Box>
                  </Box>
                </ListItem>
              ))
            )}
          </List>
        ) : (
          <List>
            {existingDataFields.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No data extraction fields found
              </Typography>
            ) : (
              existingDataFields.map((field: any) => (
                <ListItem
                  key={field.id}
                  sx={{
                    mb: 1,
                    border: `1px solid ${alpha(theme.palette?.divider || '#000', 0.1)}`,
                    borderRadius: 1,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2">{field.field_name}</Typography>
                      <Chip label={field.field_type} size="small" color="secondary" variant="outlined" />
                      <Chip label={field.data_type} size="small" color="primary" variant="outlined" />
                    </Box>
                    {field.description && (
                      <Typography variant="body2" color="text.secondary">
                        {field.description}
                      </Typography>
                    )}
                  </Box>
                </ListItem>
              ))
            )}
          </List>
        )}
      </Drawer>
    </AdminLayout>
  );
}
