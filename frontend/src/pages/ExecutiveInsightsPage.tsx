/**
 * Executive Insights Page - High-level analytics and visualizations
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  alpha,
  useTheme,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  FeaturedPlayList as FeaturesIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Timeline as TimelineIcon,
  LocalFireDepartment as HotIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
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
}

interface DashboardMetrics {
  total_features: number;
  total_themes: number;
  total_mentions: number;
  features_by_status: {
    new: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  features_by_urgency: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  top_themes: Array<{
    name: string;
    feature_count: number;
  }>;
  recent_activity: {
    features_this_week: number;
    features_last_week: number;
  };
}

const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

export function ExecutiveInsightsPage(): JSX.Element {
  const theme = useTheme();
  const { tokens } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topFeatures, setTopFeatures] = useState<Feature[]>([]);

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
      const themesRes = await fetch(
        `${API_BASE_URL}/api/v1/features/themes?workspace_id=${WORKSPACE_ID}`,
        { headers }
      );
      if (!themesRes.ok) throw new Error('Failed to fetch themes');
      const themesData = await themesRes.json();
      setThemes(themesData);

      // Fetch all features
      const featuresRes = await fetch(
        `${API_BASE_URL}/api/v1/features/features?workspace_id=${WORKSPACE_ID}`,
        { headers }
      );
      if (!featuresRes.ok) throw new Error('Failed to fetch features');
      const featuresData: Feature[] = await featuresRes.json();

      // Calculate metrics
      const statusCounts = {
        new: featuresData.filter(f => f.status === 'new').length,
        in_progress: featuresData.filter(f => f.status === 'in_progress').length,
        completed: featuresData.filter(f => f.status === 'completed').length,
        on_hold: featuresData.filter(f => f.status === 'on_hold').length,
      };

      const urgencyCounts = {
        critical: featuresData.filter(f => f.urgency === 'critical').length,
        high: featuresData.filter(f => f.urgency === 'high').length,
        medium: featuresData.filter(f => f.urgency === 'medium').length,
        low: featuresData.filter(f => f.urgency === 'low').length,
      };

      const totalMentions = featuresData.reduce((sum, f) => sum + f.mention_count, 0);

      // Get top themes by feature count
      const topThemes = themesData
        .sort((a: Theme, b: Theme) => b.feature_count - a.feature_count)
        .slice(0, 5)
        .map((t: Theme) => ({ name: t.name, feature_count: t.feature_count }));

      // Calculate recent activity (this week vs last week)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const featuresThisWeek = featuresData.filter(f =>
        new Date(f.created_at) >= oneWeekAgo
      ).length;

      const featuresLastWeek = featuresData.filter(f =>
        new Date(f.created_at) >= twoWeeksAgo && new Date(f.created_at) < oneWeekAgo
      ).length;

      setMetrics({
        total_features: featuresData.length,
        total_themes: themesData.length,
        total_mentions: totalMentions,
        features_by_status: statusCounts,
        features_by_urgency: urgencyCounts,
        top_themes: topThemes,
        recent_activity: {
          features_this_week: featuresThisWeek,
          features_last_week: featuresLastWeek,
        },
      });

      // Get top 10 most mentioned features
      const topMentioned = [...featuresData]
        .sort((a, b) => b.mention_count - a.mention_count)
        .slice(0, 10);
      setTopFeatures(topMentioned);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return theme.palette.info.main;
      case 'in_progress': return theme.palette.warning.main;
      case 'completed': return theme.palette.success.main;
      case 'on_hold': return theme.palette.grey[500];
      default: return theme.palette.grey[500];
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getTrendIcon = () => {
    if (!metrics) return null;
    const change = metrics.recent_activity.features_this_week - metrics.recent_activity.features_last_week;
    if (change > 0) {
      return <TrendingUpIcon sx={{ color: theme.palette.success.main, fontSize: 40 }} />;
    } else if (change < 0) {
      return <TrendingDownIcon sx={{ color: theme.palette.error.main, fontSize: 40 }} />;
    }
    return <TimelineIcon sx={{ color: theme.palette.grey[500], fontSize: 40 }} />;
  };

  const getTrendPercentage = () => {
    if (!metrics || metrics.recent_activity.features_last_week === 0) return 0;
    const change = ((metrics.recent_activity.features_this_week - metrics.recent_activity.features_last_week) /
                    metrics.recent_activity.features_last_week) * 100;
    return Math.round(change);
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box sx={{ pb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Executive Insights
          </Typography>
          <Typography variant="body1" color="text.secondary">
            High-level product intelligence analytics and trends
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {metrics && (
          <>
            {/* Top KPI Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Total Features */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Total Features
                      </Typography>
                      <FeaturesIcon sx={{ color: theme.palette.primary.main, fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.primary.main, mb: 1 }}>
                      {metrics.total_features}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Across {metrics.total_themes} themes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Mentions */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Customer Mentions
                      </Typography>
                      <PeopleIcon sx={{ color: theme.palette.secondary.main, fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.secondary.main, mb: 1 }}>
                      {metrics.total_mentions}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total feature requests
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* This Week */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        This Week
                      </Typography>
                      {getTrendIcon()}
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.success.main, mb: 1 }}>
                      {metrics.recent_activity.features_this_week}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {getTrendPercentage() > 0 ? '+' : ''}{getTrendPercentage()}% vs last week
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Completed */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.15)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Completed
                      </Typography>
                      <CheckCircleIcon sx={{ color: theme.palette.info.main, fontSize: 32 }} />
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.info.main, mb: 1 }}>
                      {metrics.features_by_status.completed}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round((metrics.features_by_status.completed / metrics.total_features) * 100)}% of total
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Feature Status & Urgency Distribution */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Status Distribution */}
              <Grid item xs={12} md={6}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                      Features by Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Object.entries(metrics.features_by_status).map(([status, count]) => {
                        const percentage = (count / metrics.total_features) * 100;
                        return (
                          <Box key={status}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                                {status.replace('_', ' ')}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {count} ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={percentage}
                              sx={{
                                height: 8,
                                borderRadius: 1,
                                backgroundColor: alpha(getStatusColor(status), 0.2),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getStatusColor(status),
                                  borderRadius: 1,
                                }
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Urgency Distribution */}
              <Grid item xs={12} md={6}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                      Features by Urgency
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Object.entries(metrics.features_by_urgency).map(([urgency, count]) => {
                        const percentage = (count / metrics.total_features) * 100;
                        return (
                          <Box key={urgency}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                                {urgency}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {count} ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={percentage}
                              sx={{
                                height: 8,
                                borderRadius: 1,
                                backgroundColor: alpha(getUrgencyColor(urgency), 0.2),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getUrgencyColor(urgency),
                                  borderRadius: 1,
                                }
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Top Themes */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Top 5 Themes by Feature Count
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      {metrics.top_themes.map((themeItem, idx) => (
                        <Grid item xs={12} sm={6} md={2.4} key={idx}>
                          <Card sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            textAlign: 'center',
                          }}>
                            <CardContent>
                              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main, mb: 1 }}>
                                {themeItem.feature_count}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                {themeItem.name}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Top 10 Most Requested Features */}
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <HotIcon sx={{ color: theme.palette.error.main }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Top 10 Most Requested Features
                      </Typography>
                    </Box>
                    <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Feature</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Mentions</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Urgency</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topFeatures.map((feature, idx) => (
                            <TableRow key={feature.id} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
                                  {idx + 1}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {feature.name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={feature.mention_count}
                                  size="small"
                                  sx={{
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                                    color: theme.palette.secondary.main,
                                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                                    fontWeight: 600,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={feature.urgency}
                                  size="small"
                                  sx={{
                                    background: alpha(getUrgencyColor(feature.urgency), 0.1),
                                    color: getUrgencyColor(feature.urgency),
                                    border: `1px solid ${alpha(getUrgencyColor(feature.urgency), 0.3)}`,
                                    textTransform: 'capitalize',
                                    fontWeight: 500,
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={feature.status.replace('_', ' ')}
                                  size="small"
                                  sx={{
                                    background: alpha(getStatusColor(feature.status), 0.1),
                                    color: getStatusColor(feature.status),
                                    border: `1px solid ${alpha(getStatusColor(feature.status), 0.3)}`,
                                    textTransform: 'capitalize',
                                    fontWeight: 500,
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </AdminLayout>
  );
}
