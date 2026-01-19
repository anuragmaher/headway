/**
 * Executive Insights Page - High-level analytics and visualizations
 */

import { useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  CircularProgress,
  Alert,
  Fade,
  Container,
  Divider,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  FeaturedPlayList as FeaturesIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { AdminLayout } from "@/shared/components/layouts";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { useExecutiveInsightsStore } from "../shared/store/executiveInsightsStore";
import { useLayoutStore } from "@/shared/store/layoutStore";
import {
  KPICard,
  ModernStatusChart,
  ModernUrgencyChart,
  ModernThemesChart,
  CustomersByIndustryChart,
  CallsPerDayChart,
  TopEngagedCustomersChart,
  CustomerHealthChart,
  TopFeaturesChart,
  FeatureDetailsTable,
} from "@/shared/components/ExecutiveInsightsComponents";

export function ExecutiveInsightsPage(): JSX.Element {
  const theme = useTheme();
  const { tokens, isAuthenticated } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;
  const { setHeaderContent } = useLayoutStore();

  const {
    metrics,
    topFeatures,
    loading,
    error,
    hydrated,
    fetchingWorkspaceId,
    setHydrated,
    fetchWorkspaceId,
    fetchExecutiveInsights,
    clearError,
  } = useExecutiveInsightsStore();

  /* ---------------- Header ---------------- */

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
        Executive Insights
      </Typography>
    );

    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  /* ---------------- Hydration ---------------- */

  useEffect(() => {
    setHydrated(true);
  }, [setHydrated]);

  useEffect(() => {
    if (hydrated && isAuthenticated && !WORKSPACE_ID && !fetchingWorkspaceId) {
      fetchWorkspaceId();
    }
  }, [
    hydrated,
    isAuthenticated,
    WORKSPACE_ID,
    fetchingWorkspaceId,
    fetchWorkspaceId,
  ]);

  useEffect(() => {
    if (WORKSPACE_ID) {
      fetchExecutiveInsights(WORKSPACE_ID);
    }
  }, [WORKSPACE_ID, fetchExecutiveInsights]);

  /* ---------------- Helpers ---------------- */

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return theme.palette.info.main;
      case "in_progress":
        return theme.palette.warning.main;
      case "completed":
        return theme.palette.success.main;
      case "on_hold":
      default:
        return theme.palette.grey[500];
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return theme.palette.error.main;
      case "high":
        return theme.palette.warning.main;
      case "medium":
        return theme.palette.info.main;
      case "low":
      default:
        return theme.palette.success.main;
    }
  };

  const getTrendIcon = () => {
    if (!metrics) return null;
    const diff =
      metrics.recent_activity.features_this_week -
      metrics.recent_activity.features_last_week;

    if (diff > 0)
      return (
        <TrendingUpIcon
          sx={{ color: theme.palette.success.main, fontSize: 36 }}
        />
      );
    if (diff < 0)
      return (
        <TrendingDownIcon
          sx={{ color: theme.palette.error.main, fontSize: 36 }}
        />
      );
    return (
      <TimelineIcon sx={{ color: theme.palette.grey[500], fontSize: 36 }} />
    );
  };

  const getTrendPercentage = () => {
    if (!metrics || metrics.recent_activity.features_last_week === 0) return 0;
    return Math.round(
      ((metrics.recent_activity.features_this_week -
        metrics.recent_activity.features_last_week) /
        metrics.recent_activity.features_last_week) *
        100
    );
  };

  /* ---------------- Loading / Errors ---------------- */

  if (!hydrated || fetchingWorkspaceId) {
    return (
      <AdminLayout>
        <Box textAlign="center" py={10}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Preparing executive insights…
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  if (!WORKSPACE_ID) {
    return (
      <AdminLayout>
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Alert severity="error" onClose={clearError}>
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
            Loading analytics…
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <AdminLayout>
      <Box sx={{ pb: { xs: 4, md: 6 }, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="xl">
          {/* Page Header */}
          {/* <Box sx={{ mb: 5 }}>
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
              High-level product intelligence to understand demand, urgency, and
              customer impact at a glance.
            </Typography>
          </Box> */}

          {error && (
            <Fade in>
              <Alert severity="error" sx={{ mb: 4 }} onClose={clearError}>
                {error}
              </Alert>
            </Fade>
          )}

          {metrics && (
            <Fade in timeout={600}>
              <Box>
                {/* KPI SUMMARY */}
                <Box
                  sx={{
                    m: 5,
                    p: { xs: 2, md: 3 },
                    borderRadius: 3,
                    background: `linear-gradient(
                      200deg,
                      ${theme.palette.background.paper} 0%,
                      ${theme.palette.background.default} 100%
                    )`,
                  }}
                >
                  <Grid container spacing={{ xs: 2, md: 3 }}>
                    {/* Total Features */}
                    <Grid item xs={12} sm={6} xl={3}>
                      <KPICard
                        title="Total Features"
                        value={metrics.total_features}
                        subtitle={`Across ${metrics.total_themes} themes`}
                        icon={<FeaturesIcon fontSize="small" />}
                        accentColor={theme.palette.primary.main}
                      />
                    </Grid>

                    {/* Customer Mentions */}
                    <Grid item xs={12} sm={6} xl={3}>
                      <KPICard
                        title="Customer Mentions"
                        value={metrics.total_mentions}
                        subtitle="Total feature requests"
                        icon={<PeopleIcon fontSize="small" />}
                        accentColor={theme.palette.secondary.main}
                      />
                    </Grid>

                    {/* This Week */}
                    <Grid item xs={12} sm={6} xl={3}>
                      <KPICard
                        title="This Week"
                        value={metrics.recent_activity.features_this_week}
                        subtitle="New feature requests"
                        icon={getTrendIcon()}
                        accentColor={theme.palette.success.main}
                        trend={{
                          value: getTrendPercentage(),
                          label: "vs last week",
                        }}
                      />
                    </Grid>

                    {/* Completed */}
                    <Grid item xs={12} sm={6} xl={3}>
                      <KPICard
                        title="Completed"
                        value={metrics.features_by_status.completed}
                        subtitle={`${Math.round(
                          (metrics.features_by_status.completed /
                            metrics.total_features) *
                            100
                        )}% of total`}
                        icon={<CheckCircleIcon fontSize="small" />}
                        accentColor={theme.palette.info.main}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* FEATURE OVERVIEW */}
                <SectionHeader
                  title="Feature Overview"
                  subtitle="Status, urgency, and thematic distribution"
                />

                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={6} xl={4}>
                    <ModernStatusChart
                      featuresByStatus={metrics.features_by_status}
                      getStatusColor={getStatusColor}
                    />
                  </Grid>
                  <Grid item xs={12} md={6} xl={4}>
                    <ModernUrgencyChart
                      featuresByUrgency={metrics.features_by_urgency}
                      getUrgencyColor={getUrgencyColor}
                    />
                  </Grid>
                  <Grid item xs={12} md={6} xl={4}>
                    <ModernThemesChart topThemes={metrics.top_themes} />
                  </Grid>
                </Grid>

                {/* CUSTOMER INTELLIGENCE */}
                <SectionHeader
                  title="Customer Intelligence"
                  subtitle="Engagement, activity, and health signals"
                />

                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={6}>
                    <CustomersByIndustryChart
                      customersByIndustry={metrics.customers_by_industry}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <CallsPerDayChart callsPerDay={metrics.calls_per_day} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TopEngagedCustomersChart
                      topEngagedCustomers={metrics.top_engaged_customers}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <CustomerHealthChart
                      customerHealthSummary={metrics.customer_health_summary}
                    />
                  </Grid>
                </Grid>

                {/* DEMAND SIGNALS */}
                <SectionHeader
                  title="Demand Signals"
                  subtitle="Most requested features by volume"
                />

                <TopFeaturesChart topFeatures={topFeatures} />

                <Divider sx={{ my: 6 }} />

                {/* DETAILS */}
                <SectionHeader
                  title="Detailed Feature Breakdown"
                  subtitle="Status, urgency, and demand per feature"
                />

                <FeatureDetailsTable
                  topFeatures={topFeatures}
                  getStatusColor={getStatusColor}
                  getUrgencyColor={getUrgencyColor}
                />
              </Box>
            </Fade>
          )}
        </Container>
      </Box>
    </AdminLayout>
  );
}

/* ---------------- Reusable Section Header ---------------- */

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    </Box>
  );
}
