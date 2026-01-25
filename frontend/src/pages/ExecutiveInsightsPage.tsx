/**
 * Executive Insights Page - Aggregated insights from transcript classifications
 * Shows graphs, visualizations, and analytics across all transcripts
 */

import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  CircularProgress,
  Alert,
  Container,
  Paper,
  alpha,
} from "@mui/material";
import {
  Insights as InsightsIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
} from "@mui/icons-material";
import { AdminLayout } from "@/shared/components/layouts";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { useLayoutStore } from "@/shared/store/layoutStore";
import { themesApi } from "@/services/themes.api";
import {
  KPICard,
  ModernDonutChart,
  HorizontalBarBreakdown,
} from "@/shared/components/ExecutiveInsightsComponents";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TranscriptInsights {
  summary: {
    total_transcripts: number;
    total_feature_mappings: number;
    total_speakers: number;
    avg_feature_mappings_per_transcript: number;
    avg_speakers_per_transcript: number;
  };
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  risk_assessment: {
    deal_risk: Record<string, number>;
    churn_risk: Record<string, number>;
    expansion_signal: Record<string, number>;
  };
  source_type_distribution: Record<string, number>;
  call_types: Record<string, number>;
  top_themes: Array<{ theme_id: string; name: string; count: number }>;
  top_companies: Array<{ name: string; count: number }>;
  health_signals: {
    positive: number;
    negative: number;
  };
  timeline: Array<{ date: string; count: number }>;
}

export function ExecutiveInsightsPage(): JSX.Element {
  const theme = useTheme();
  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;
  const { setHeaderContent } = useLayoutStore();
  
  const [insights, setInsights] = useState<TranscriptInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Header ---------------- */
  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
        Executive Insights
      </Typography>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  /* ---------------- Fetch Insights ---------------- */
  useEffect(() => {
    if (!WORKSPACE_ID) return;

    const fetchInsights = async () => {
      try {
        setLoading(true);
        const data = await themesApi.getTranscriptInsights();
        setInsights(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [WORKSPACE_ID]);

  /* ---------------- Loading / Errors ---------------- */
  if (!WORKSPACE_ID) {
    return (
      <AdminLayout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="error">
            Workspace ID not found. Please log in again.
          </Alert>
        </Container>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <Box textAlign="center" py={10}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Loading insights…
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Container>
      </AdminLayout>
    );
  }

  if (!insights) {
    return (
      <AdminLayout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="info">
            No insights available. Process some transcripts to see analytics.
          </Alert>
        </Container>
      </AdminLayout>
    );
  }

  /* ---------------- Chart Data Preparation ---------------- */
  const sentimentData = [
    { name: 'Positive', value: insights.sentiment_distribution.positive, color: theme.palette.success.main },
    { name: 'Neutral', value: insights.sentiment_distribution.neutral, color: theme.palette.warning.main },
    { name: 'Negative', value: insights.sentiment_distribution.negative, color: theme.palette.error.main },
  ].filter(item => item.value > 0);

  const dealRiskData = Object.entries(insights.risk_assessment.deal_risk)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const churnRiskData = Object.entries(insights.risk_assessment.churn_risk)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const sourceTypeData = Object.entries(insights.source_type_distribution)
    .map(([key, value]) => ({
      name: key.toUpperCase(),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const topThemesData = insights.top_themes.slice(0, 10).map(theme => ({
    name: theme.name,
    value: theme.count,
  }));

  const topCompaniesData = insights.top_companies.slice(0, 10).map(company => ({
    name: company.name,
    value: company.count,
  }));

  // Format timeline data for chart
  const timelineData = insights.timeline.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: item.count,
  }));

  const healthSignalsData = [
    { name: 'Positive', value: insights.health_signals.positive, color: theme.palette.success.main },
    { name: 'Negative', value: insights.health_signals.negative, color: theme.palette.error.main },
  ].filter(item => item.value > 0);

  /* ---------------- UI ---------------- */
  return (
    <AdminLayout>
      <Box sx={{ pb: { xs: 4, md: 6 }, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="xl">
          {/* Page Header */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}
            >
              Executive Insights
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 720 }}
            >
              Aggregated analytics and insights from all transcript classifications
            </Typography>
          </Box>

          {/* KPI Summary */}
          <Box sx={{ mb: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <KPICard
                  title="Total Transcripts"
                  value={insights.summary.total_transcripts}
                  subtitle="Analyzed transcripts"
                  icon={<InsightsIcon fontSize="small" />}
                  accentColor={theme.palette.primary.main}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KPICard
                  title="Feature Mappings"
                  value={insights.summary.total_feature_mappings}
                  subtitle={`Avg ${insights.summary.avg_feature_mappings_per_transcript} per transcript`}
                  icon={<CategoryIcon fontSize="small" />}
                  accentColor={theme.palette.secondary.main}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KPICard
                  title="Total Speakers"
                  value={insights.summary.total_speakers}
                  subtitle={`Avg ${insights.summary.avg_speakers_per_transcript} per transcript`}
                  icon={<PeopleIcon fontSize="small" />}
                  accentColor={theme.palette.info.main}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KPICard
                  title="Health Signals"
                  value={insights.health_signals.positive}
                  subtitle={`${insights.health_signals.negative} negative signals`}
                  icon={<TrendingUpIcon fontSize="small" />}
                  accentColor={theme.palette.success.main}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Sentiment & Risk Assessment */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <InsightsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Sentiment Distribution
                  </Typography>
                </Box>
                {sentimentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No sentiment data available
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <AssessmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Deal Risk Distribution
                  </Typography>
                </Box>
                {dealRiskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dealRiskData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.primary.main} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No deal risk data available
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Risk Assessment Details */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {churnRiskData.length > 0 && (
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Churn Risk Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={churnRiskData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.error.main} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            )}

            {Object.keys(insights.risk_assessment.expansion_signal).length > 0 && (
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Expansion Signals
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={Object.entries(insights.risk_assessment.expansion_signal).map(([key, value]) => ({
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        value,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.success.main} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            )}
          </Grid>

          {/* Top Themes & Companies */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <CategoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Top Themes
                  </Typography>
                </Box>
                {topThemesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topThemesData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.primary.main} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No theme data available
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <BusinessIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Top Companies
                  </Typography>
                </Box>
                {topCompaniesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topCompaniesData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="value" fill={theme.palette.secondary.main} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No company data available
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Timeline & Source Distribution */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={8}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <TimelineIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Transcripts Over Time (Last 30 Days)
                  </Typography>
                </Box>
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        name="Transcripts"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No timeline data available
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Source Type Distribution
                </Typography>
                {sourceTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sourceTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sourceTypeData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={[
                              theme.palette.primary.main,
                              theme.palette.secondary.main,
                              theme.palette.info.main,
                              theme.palette.success.main,
                            ][index % 4]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={5}>
                    No source data available
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Health Signals */}
          {healthSignalsData.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Health Signals Summary
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={healthSignalsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value">
                      {healthSignalsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Box>
          )}
        </Container>
      </Box>
    </AdminLayout>
  );
}
