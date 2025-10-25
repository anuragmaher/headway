import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FeatureMessagesModal from '../shared/components/FeatureMessagesModal';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

interface Theme {
  id: string;
  name: string;
  description: string;
  feature_count: number;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  urgency: string;
  status: string;
  mention_count: number;
  theme_id: string | null;
  first_mentioned: string;
  last_mentioned: string;
  created_at: string;
  updated_at: string | null;
  ai_metadata?: {
    extraction_source?: string;
    transcript_theme_relevance?: {
      is_relevant: boolean;
      confidence: number;
      matched_themes: string[];
      reasoning: string;
    };
    theme_validation?: {
      suggested_theme: string;
      assigned_theme: string;
      confidence: number;
      is_valid: boolean;
      reasoning: string;
    };
    feature_matching?: {
      is_unique: boolean;
      confidence: number;
      reasoning: string;
    };
    matches?: Array<{
      matched_title: string;
      matched_description: string;
      confidence: number;
      reasoning: string;
      matched_at: string;
    }>;
  };
}

const FeaturesPage: React.FC = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [messagesModalFeature, setMessagesModalFeature] = useState<{ id: string; name: string } | null>(null);
  const [featureMessages, setFeatureMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  if (!WORKSPACE_ID) {
    return (
      <AdminLayout>
        <Box>
          <Alert severity="error">
            Workspace ID not found. Please log in again.
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch themes
      const themesResponse = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
        { headers }
      );

      if (!themesResponse.ok) {
        throw new Error(`Failed to fetch themes: ${themesResponse.status}`);
      }

      const themesData = await themesResponse.json();
      setThemes(themesData);

      // Fetch features
      const featuresResponse = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}`,
        { headers }
      );

      if (!featuresResponse.ok) {
        throw new Error(`Failed to fetch features: ${featuresResponse.status}`);
      }

      const featuresData = await featuresResponse.json();
      setFeatures(featuresData);

      // Auto-select first feature (keeping theme as "all" by default)
      if (featuresData.length > 0) {
        setSelectedFeatureId(featuresData[0].id);
        fetchFeatureMessages(featuresData[0].id);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getFilteredFeatures = () => {
    if (!selectedThemeId) return features;
    return features.filter(feature => feature.theme_id === selectedThemeId);
  };

  const getSelectedFeature = () => {
    return features.find(f => f.id === selectedFeatureId);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#4caf50'; // Green
    if (confidence >= 0.5) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  const getThemeValidationConfidence = (feature: Feature) => {
    return feature.ai_metadata?.theme_validation?.confidence ?? null;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleCloseMessagesModal = () => {
    setMessagesModalOpen(false);
    setMessagesModalFeature(null);
  };

  const handleThemeChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setSelectedThemeId(value === 'all' ? null : value);
    setSelectedFeatureId(null); // Reset selected feature when changing theme
    setFeatureMessages([]); // Clear messages when changing theme
  };

  const fetchFeatureMessages = async (featureId: string) => {
    try {
      setLoadingMessages(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${WORKSPACE_ID}`,
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

      const messages = await response.json();
      setFeatureMessages(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setFeatureMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleFeatureSelect = (featureId: string) => {
    setSelectedFeatureId(featureId);
    fetchFeatureMessages(featureId);
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading features...
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={fetchData}>
            Retry
          </Button>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Product Features Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          AI-generated feature requests from your Slack workspace
        </Typography>

        {/* Theme Filter */}
        <Box sx={{ mt: 3, mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Theme</InputLabel>
            <Select
              value={selectedThemeId || 'all'}
              label="Filter by Theme"
              onChange={handleThemeChange}
            >
              <MenuItem value="all">All Themes ({features.length})</MenuItem>
              {themes.map((theme) => (
                <MenuItem key={theme.id} value={theme.id}>
                  {theme.name} ({theme.feature_count})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>
          {/* Column 1: Feature List */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Features ({getFilteredFeatures().length})
            </Typography>
            <Paper elevation={1} sx={{ maxHeight: 600, overflow: 'auto' }}>
              <List>
                {getFilteredFeatures().map((feature) => {
                  const themeValidationConfidence = getThemeValidationConfidence(feature);
                  return (
                    <ListItem
                      key={feature.id}
                      button
                      selected={selectedFeatureId === feature.id}
                      onClick={() => handleFeatureSelect(feature.id)}
                      divider
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <span>{feature.name}</span>
                            {themeValidationConfidence !== null && (
                              <Tooltip title={`Theme classification confidence: ${getConfidenceLabel(themeValidationConfidence)}`}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: getConfidenceColor(themeValidationConfidence),
                                    cursor: 'help'
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {feature.description.substring(0, 80)}...
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                label={feature.urgency}
                                size="small"
                                color={getUrgencyColor(feature.urgency) as any}
                              />
                              <Chip
                                label={`${feature.mention_count} mentions`}
                                size="small"
                                variant="outlined"
                              />
                              {themeValidationConfidence !== null && (
                                <Chip
                                  label={`${Math.round(themeValidationConfidence * 100)}% confidence`}
                                  size="small"
                                  variant="filled"
                                  sx={{ backgroundColor: getConfidenceColor(themeValidationConfidence), color: 'white' }}
                                />
                              )}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grid>

          {/* Column 2: Feature Details */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Feature Details
            </Typography>
            {getSelectedFeature() ? (
              <Paper elevation={1} sx={{ p: 3, maxHeight: 600, overflow: 'auto' }}>
                <Typography variant="h5" gutterBottom>
                  {getSelectedFeature()?.name}
                </Typography>

                <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={getSelectedFeature()?.urgency}
                    color={getUrgencyColor(getSelectedFeature()?.urgency || '') as any}
                  />
                  <Chip
                    label={getSelectedFeature()?.status}
                    color={getStatusColor(getSelectedFeature()?.status || '') as any}
                  />
                  <Chip
                    label={`${getSelectedFeature()?.mention_count} mentions`}
                    variant="outlined"
                  />
                </Box>

                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" paragraph>
                  {getSelectedFeature()?.description}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Timeline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  First mentioned: {formatDate(getSelectedFeature()?.first_mentioned || '')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last mentioned: {formatDate(getSelectedFeature()?.last_mentioned || '')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {formatDate(getSelectedFeature()?.created_at || '')}
                </Typography>

                {/* AI Classification Details */}
                {getSelectedFeature()?.ai_metadata && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      AI Classification Details
                    </Typography>

                    {/* Theme Validation */}
                    {getSelectedFeature()?.ai_metadata?.theme_validation && (
                      <Accordion defaultExpanded sx={{ mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="subtitle2">Theme Validation</Typography>
                            <Chip
                              label={`${Math.round(getSelectedFeature()?.ai_metadata?.theme_validation?.confidence! * 100)}% confidence`}
                              size="small"
                              sx={{
                                backgroundColor: getConfidenceColor(getSelectedFeature()?.ai_metadata?.theme_validation?.confidence || 0),
                                color: 'white'
                              }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ backgroundColor: 'action.hover' }}>
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              <strong>Suggested Theme:</strong> {getSelectedFeature()?.ai_metadata?.theme_validation?.suggested_theme}
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              <strong>Assigned Theme:</strong> {getSelectedFeature()?.ai_metadata?.theme_validation?.assigned_theme}
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              <strong>Valid:</strong> {getSelectedFeature()?.ai_metadata?.theme_validation?.is_valid ? '✓ Yes' : '✗ No'}
                            </Typography>
                            <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                              <strong>Reasoning:</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1, backgroundColor: 'background.paper', borderRadius: 1 }}>
                              {getSelectedFeature()?.ai_metadata?.theme_validation?.reasoning}
                            </Typography>
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Feature Matching */}
                    {getSelectedFeature()?.ai_metadata?.feature_matching && (
                      <Accordion sx={{ mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="subtitle2">Feature Matching</Typography>
                            <Chip
                              label={`${Math.round(getSelectedFeature()?.ai_metadata?.feature_matching?.confidence! * 100)}% confidence`}
                              size="small"
                              sx={{
                                backgroundColor: getConfidenceColor(getSelectedFeature()?.ai_metadata?.feature_matching?.confidence || 0),
                                color: 'white'
                              }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ backgroundColor: 'action.hover' }}>
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              <strong>Is Unique:</strong> {getSelectedFeature()?.ai_metadata?.feature_matching?.is_unique ? '✓ Yes' : '✗ No (Duplicate)'}
                            </Typography>
                            <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                              <strong>Reasoning:</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1, backgroundColor: 'background.paper', borderRadius: 1 }}>
                              {getSelectedFeature()?.ai_metadata?.feature_matching?.reasoning}
                            </Typography>
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Transcript Theme Relevance */}
                    {getSelectedFeature()?.ai_metadata?.transcript_theme_relevance && (
                      <Accordion sx={{ mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="subtitle2">Transcript Theme Relevance</Typography>
                            <Chip
                              label={`${Math.round(getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.confidence! * 100)}% confidence`}
                              size="small"
                              sx={{
                                backgroundColor: getConfidenceColor(getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.confidence || 0),
                                color: 'white'
                              }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ backgroundColor: 'action.hover' }}>
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              <strong>Is Relevant:</strong> {getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.is_relevant ? '✓ Yes' : '✗ No'}
                            </Typography>
                            {getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.matched_themes && getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.matched_themes!.length > 0 && (
                              <Typography variant="body2" gutterBottom>
                                <strong>Matched Themes:</strong> {getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.matched_themes!.join(', ')}
                              </Typography>
                            )}
                            <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                              <strong>Reasoning:</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1, backgroundColor: 'background.paper', borderRadius: 1 }}>
                              {getSelectedFeature()?.ai_metadata?.transcript_theme_relevance?.reasoning}
                            </Typography>
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Matched Features */}
                    {getSelectedFeature()?.ai_metadata?.matches && getSelectedFeature()?.ai_metadata?.matches!.length > 0 && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Matched to Existing Features ({getSelectedFeature()?.ai_metadata?.matches!.length})</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ backgroundColor: 'action.hover' }}>
                          <Box>
                            {getSelectedFeature()?.ai_metadata?.matches!.map((match, index) => (
                              <Box key={index} sx={{ mb: 2, pb: 2, borderBottom: index < getSelectedFeature()?.ai_metadata?.matches!.length! - 1 ? '1px solid #e0e0e0' : 'none' }}>
                                <Typography variant="body2" gutterBottom>
                                  <strong>{match.matched_title}</strong>
                                </Typography>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                  Confidence: {Math.round(match.confidence * 100)}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1 }}>
                                  {match.matched_description}
                                </Typography>
                                <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                                  <strong>Reasoning:</strong> {match.reasoning}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </>
                )}
              </Paper>
            ) : (
              <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Select a feature to view details
                </Typography>
              </Paper>
            )}
          </Grid>

          {/* Column 3: Messages/Mentions */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Messages & Mentions
            </Typography>
            {selectedFeatureId ? (
              <Paper elevation={1} sx={{ maxHeight: 600, overflow: 'auto' }}>
                {loadingMessages ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress size={24} />
                  </Box>
                ) : featureMessages.length > 0 ? (
                  <List>
                    {featureMessages.map((message, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                              {message.content}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {message.sender_name} • {message.channel_name}
                              </Typography>
                              <br />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(message.sent_at)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box p={3} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No messages found for this feature
                    </Typography>
                  </Box>
                )}
              </Paper>
            ) : (
              <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  Select a feature to view messages
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>

        {/* Messages Modal */}
        {messagesModalFeature && (
          <FeatureMessagesModal
            open={messagesModalOpen}
            onClose={handleCloseMessagesModal}
            featureId={messagesModalFeature.id}
            featureName={messagesModalFeature.name}
            workspaceId={WORKSPACE_ID}
          />
        )}
      </Box>
    </AdminLayout>
  );
};

export default FeaturesPage;