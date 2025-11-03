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
  useMediaQuery,
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

export function ExecutiveInsightsPage(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { tokens, isAuthenticated } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topFeatures, setTopFeatures] = useState<Feature[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  // Hydration: Check if store is ready
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    if (!hydrated || !isAuthenticated || WORKSPACE_ID || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.workspace_id) {
          useAuthStore.setState({
            tokens: {
              ...tokens,
              workspace_id: data.workspace_id
            }
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch workspace_id:', err);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, WORKSPACE_ID, fetchingWorkspaceId, attemptedFetch, tokens]);

  // Fetch dashboard data when workspace is available
  useEffect(() => {
    if (!WORKSPACE_ID) {
      return;
    }

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

    fetchData();
  }, [WORKSPACE_ID]);

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

  // Show loading state while hydrating or recovering workspace_id
  if (!hydrated || fetchingWorkspaceId) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  // Show error if workspace_id is missing
  if (!WORKSPACE_ID) {
    return (
      <AdminLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Workspace ID not found. Please log in again.
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  // Show loading state while fetching data
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
      <Box sx={{
        pb: { xs: 2, sm: 3, md: 4 },
        px: { xs: 1.5, sm: 3, md: 0 },
        maxWidth: '100%',
        overflowX: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{ mb: { xs: 1.5, sm: 3, md: 4 } }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 0.5,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' }
            }}
          >
            Executive Insights
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.813rem', sm: '1rem' } }}
          >
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
            <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: { xs: 1.5, sm: 3, md: 4 } }}>
              {/* Total Features */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  height: '100%',
                }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, sm: 1.5, md: 2 } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.813rem', md: '0.875rem' }
                        }}
                      >
                        Total Features
                      </Typography>
                      <FeaturesIcon sx={{ color: theme.palette.primary.main, fontSize: { xs: 22, sm: 28, md: 32 } }} />
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        mb: 0.5,
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' }
                      }}
                    >
                      {metrics.total_features}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                    >
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, sm: 1.5, md: 2 } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.813rem', md: '0.875rem' }
                        }}
                      >
                        Customer Mentions
                      </Typography>
                      <PeopleIcon sx={{ color: theme.palette.secondary.main, fontSize: { xs: 22, sm: 28, md: 32 } }} />
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.secondary.main,
                        mb: 0.5,
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' }
                      }}
                    >
                      {metrics.total_mentions}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                    >
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, sm: 1.5, md: 2 } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.813rem', md: '0.875rem' }
                        }}
                      >
                        This Week
                      </Typography>
                      <Box sx={{ '& svg': { fontSize: { xs: '26px !important', sm: '35px !important', md: '40px !important' } } }}>
                        {getTrendIcon()}
                      </Box>
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.success.main,
                        mb: 0.5,
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' }
                      }}
                    >
                      {metrics.recent_activity.features_this_week}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                      >
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, sm: 1.5, md: 2 } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.813rem', md: '0.875rem' }
                        }}
                      >
                        Completed
                      </Typography>
                      <CheckCircleIcon sx={{ color: theme.palette.info.main, fontSize: { xs: 22, sm: 28, md: 32 } }} />
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.info.main,
                        mb: 0.5,
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' }
                      }}
                    >
                      {metrics.features_by_status.completed}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                    >
                      {Math.round((metrics.features_by_status.completed / metrics.total_features) * 100)}% of total
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Three Pie Charts in a Row */}
            <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
              {/* Status Distribution */}
              <Grid item xs={12} md={4}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%',
                }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: { xs: 1.5, sm: 2 },
                        textAlign: 'center',
                        fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                      }}
                    >
                      Features by Status
                    </Typography>
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: { xs: 1.5, sm: 2 },
                        textAlign: 'center',
                        fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                      }}
                    >
                      Features by Urgency
                    </Typography>
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: { xs: 1.5, sm: 2 } }}>
                      <CategoryIcon sx={{ color: theme.palette.primary.main, fontSize: { xs: 20, sm: 22, md: 24 } }} />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                        }}
                      >
                        Top 5 Themes
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
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
            <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
              <Grid item xs={12}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 2.5, md: 3 } }}>
                      <HotIcon sx={{ color: theme.palette.error.main, fontSize: { xs: 20, sm: 22, md: 24 } }} />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                        }}
                      >
                        Top 10 Features by Customer Mentions
                      </Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                      <BarChart
                        data={topFeatures.map(f => ({
                          name: f.name.length > (isMobile ? 20 : 30) ? f.name.substring(0, (isMobile ? 20 : 30)) + '...' : f.name,
                          mentions: f.mention_count,
                        }))}
                        margin={isMobile ? { top: 5, right: 10, left: 10, bottom: 80 } : { top: 5, right: 30, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.2)} />
                        <XAxis
                          dataKey="name"
                          stroke={theme.palette.text.secondary}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                          style={{ fontSize: isMobile ? '10px' : '12px' }}
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
            <Grid container spacing={{ xs: 2, sm: 2, md: 3 }}>
              <Grid item xs={12}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 2.5, md: 3 } }}>
                      <HotIcon sx={{ color: theme.palette.error.main, fontSize: { xs: 20, sm: 22, md: 24 } }} />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                        }}
                      >
                        Feature Details
                      </Typography>
                    </Box>
                    <TableContainer
                      component={Paper}
                      elevation={0}
                      sx={{
                        background: 'transparent',
                        overflowX: 'auto',
                        '&::-webkit-scrollbar': {
                          height: 8,
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.3),
                          borderRadius: 4,
                        },
                      }}
                    >
                      <Table sx={{ width: '100%' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>Feature</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>Theme</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>Mentions</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>Urgency</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, p: { xs: 1, sm: 2 } }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topFeatures.map((feature, idx) => (
                            <TableRow key={feature.id} hover>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    color: theme.palette.text.secondary,
                                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                  }}
                                >
                                  {idx + 1}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 500,
                                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                  }}
                                >
                                  {feature.name}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                {feature.theme ? (
                                  <Chip
                                    label={feature.theme.name}
                                    size="small"
                                    sx={{
                                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                                      color: theme.palette.primary.main,
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                      fontWeight: 500,
                                      height: { xs: 20, sm: 24 },
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
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
                                      height: { xs: 20, sm: 24 },
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                <Chip
                                  label={feature.mention_count}
                                  size="small"
                                  sx={{
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                                    color: theme.palette.secondary.main,
                                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                                    fontWeight: 600,
                                    height: { xs: 20, sm: 24 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                <Chip
                                  label={feature.urgency}
                                  size="small"
                                  sx={{
                                    background: alpha(getUrgencyColor(feature.urgency), 0.1),
                                    color: getUrgencyColor(feature.urgency),
                                    border: `1px solid ${alpha(getUrgencyColor(feature.urgency), 0.3)}`,
                                    textTransform: 'capitalize',
                                    fontWeight: 500,
                                    height: { xs: 20, sm: 24 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                                <Chip
                                  label={feature.status.replace('_', ' ')}
                                  size="small"
                                  sx={{
                                    background: alpha(getStatusColor(feature.status), 0.1),
                                    color: getStatusColor(feature.status),
                                    border: `1px solid ${alpha(getStatusColor(feature.status), 0.3)}`,
                                    textTransform: 'capitalize',
                                    fontWeight: 500,
                                    height: { xs: 20, sm: 24 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
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
