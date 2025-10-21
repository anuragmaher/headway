/**
 * Executive Insights Page - High-level analytics and visualizations
 */

import { useState, useEffect } from 'react';
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
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
  theme?: {
    id: string;
    name: string;
    description: string;
  } | null;
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

      // Fetch all executive insights data from optimized endpoint
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/executive-insights?workspace_id=${WORKSPACE_ID}`,
        { headers }
      );
      if (!response.ok) throw new Error('Failed to fetch executive insights');
      const data = await response.json();

      // Set metrics and top features directly from API response
      setMetrics(data.metrics);
      setTopFeatures(data.top_features);

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

            {/* Three Pie Charts in a Row */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Status Distribution */}
              <Grid item xs={12} md={4}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
                      Features by Status
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={Object.entries(metrics.features_by_status).map(([status, count]) => ({
                            name: status.replace('_', ' '),
                            value: count,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value, percent }: { name: string; value: number; percent: number }) =>
                            `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {Object.keys(metrics.features_by_status).map((status, index) => (
                            <Cell key={`cell-${index}`} fill={getStatusColor(status)} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Urgency Distribution */}
              <Grid item xs={12} md={4}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
                      Features by Urgency
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={Object.entries(metrics.features_by_urgency).map(([urgency, count]) => ({
                            name: urgency,
                            value: count,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value, percent }: { name: string; value: number; percent: number }) =>
                            `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {Object.keys(metrics.features_by_urgency).map((urgency, index) => (
                            <Cell key={`cell-${index}`} fill={getUrgencyColor(urgency)} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Themes Distribution */}
              <Grid item xs={12} md={4}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                      <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Top 5 Themes
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={metrics.top_themes.map(t => ({
                            name: t.name,
                            value: t.feature_count,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }: { name: string; value: number }) =>
                            `${name}: ${value}`
                          }
                        >
                          {metrics.top_themes.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                theme.palette.primary.main,
                                theme.palette.secondary.main,
                                theme.palette.success.main,
                                theme.palette.warning.main,
                                theme.palette.info.main,
                              ][index % 5]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Top 10 Features by Mentions - Bar Chart */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
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
                        Top 10 Features by Customer Mentions
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={topFeatures.map(f => ({
                          name: f.name.length > 30 ? f.name.substring(0, 30) + '...' : f.name,
                          mentions: f.mention_count,
                        }))}
                        margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.2)} />
                        <XAxis
                          dataKey="name"
                          stroke={theme.palette.text.secondary}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          stroke={theme.palette.text.secondary}
                          label={{ value: 'Mentions', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="mentions" fill={theme.palette.secondary.main} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Top 10 Most Requested Features - Table */}
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
                        Feature Details
                      </Typography>
                    </Box>
                    <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Feature</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Theme</TableCell>
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
                                {feature.theme ? (
                                  <Chip
                                    label={feature.theme.name}
                                    size="small"
                                    sx={{
                                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                                      color: theme.palette.primary.main,
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                      fontWeight: 500,
                                    }}
                                  />
                                ) : (
                                  <Chip
                                    label="No Theme"
                                    size="small"
                                    sx={{
                                      background: alpha(theme.palette.text.secondary, 0.1),
                                      color: theme.palette.text.secondary,
                                      border: `1px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
                                      fontWeight: 500,
                                    }}
                                  />
                                )}
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
