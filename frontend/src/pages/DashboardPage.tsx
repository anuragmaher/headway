/**
 * Insights Dashboard page showing key metrics and analytics
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  alpha,
  useTheme,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  Warning as WarningIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

// Separate interfaces for each metric type
interface SummaryMetrics {
  total_requests: number;
  total_mrr_impact: number;
  deal_blockers: number;
  urgent_items: number;
}

interface ByUrgency {
  urgent: { count: number; mrr: number };
  important: { count: number; mrr: number };
  nice_to_have: { count: number; mrr: number };
  impending_churn: { count: number; mrr: number };
}

interface ProductMetric {
  product: string;
  count: number;
  mrr: number;
}

interface CategoryMetric {
  category: string;
  count: number;
  mrr: number;
}

interface CriticalItem {
  urgency: string;
  customer: string;
  mrr: number;
  feature: string;
  product: string;
}

interface TopMrrItem {
  customer: string;
  mrr: number;
  urgency: string;
  feature: string;
  product: string;
}

export function DashboardPage(): JSX.Element {
  const theme = useTheme();
  const { tokens } = useAuthStore();

  // Separate state for each metric section
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [byUrgency, setByUrgency] = useState<ByUrgency | null>(null);
  const [byProduct, setByProduct] = useState<ProductMetric[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryMetric[]>([]);
  const [criticalAttention, setCriticalAttention] = useState<CriticalItem[]>([]);
  const [topMrr, setTopMrr] = useState<TopMrrItem[]>([]);

  // Separate loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingUrgency, setLoadingUrgency] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCritical, setLoadingCritical] = useState(true);
  const [loadingTopMrr, setLoadingTopMrr] = useState(true);

  const WORKSPACE_ID = '647ab033-6d10-4a35-9ace-0399052ec874';

  const getAuthToken = () => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  };

  useEffect(() => {
    // Fetch all metrics independently
    fetchSummary();
    fetchByUrgency();
    fetchByProduct();
    fetchTopCategories();
    fetchCriticalAttention();
    fetchTopMrr();
  }, []);

  const fetchSummary = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/summary?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchByUrgency = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/by-urgency?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setByUrgency(data);
    } catch (error) {
      console.error('Error fetching urgency:', error);
    } finally {
      setLoadingUrgency(false);
    }
  };

  const fetchByProduct = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/by-product?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setByProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoadingProduct(false);
    }
  };

  const fetchTopCategories = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/top-categories?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setTopCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchCriticalAttention = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/critical-attention?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setCriticalAttention(data);
    } catch (error) {
      console.error('Error fetching critical attention:', error);
    } finally {
      setLoadingCritical(false);
    }
  };

  const fetchTopMrr = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/dashboard-metrics/top-mrr?workspace_id=${WORKSPACE_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setTopMrr(data);
    } catch (error) {
      console.error('Error fetching top MRR:', error);
    } finally {
      setLoadingTopMrr(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'urgent':
      case 'high':
        return theme.palette.error.main;
      case 'important':
      case 'medium':
        return theme.palette.warning.main;
      case 'nice to have':
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Product Insights Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-powered analytics and metrics for customer feedback
          </Typography>
        </Box>

        {/* Top 4 Metric Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)` }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Total Requests
                </Typography>
                {loadingSummary ? (
                  <Skeleton variant="text" width={80} height={48} />
                ) : (
                  <Typography variant="h3" fontWeight={700}>
                    {summary?.total_requests || 0}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Active feature requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)` }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Total MRR Impact
                </Typography>
                {loadingSummary ? (
                  <Skeleton variant="text" width={120} height={48} />
                ) : (
                  <Typography variant="h3" fontWeight={700}>
                    {formatCurrency(summary?.total_mrr_impact || 0)}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  From all requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)` }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Deal Blockers
                </Typography>
                {loadingSummary ? (
                  <Skeleton variant="text" width={60} height={48} />
                ) : (
                  <Typography variant="h3" fontWeight={700}>
                    {summary?.deal_blockers || 0}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Impacting deals
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)` }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Urgent Items
                </Typography>
                {loadingSummary ? (
                  <Skeleton variant="text" width={60} height={48} />
                ) : (
                  <Typography variant="h3" fontWeight={700}>
                    {summary?.urgent_items || 0}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Require immediate action
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Analysis Cards Row */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* By Urgency */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  By Urgency
                </Typography>
                {loadingUrgency ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={40} />
                    ))}
                  </Box>
                ) : byUrgency ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.entries(byUrgency).map(([key, value]) => (
                      <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: getUrgencyColor(key)
                          }} />
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {key.replace('_', ' ')}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={600}>{value.count} requests</Typography>
                          <Typography variant="caption" color="text.secondary">{formatCurrency(value.mrr)} MRR</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          </Grid>

          {/* By Product */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  By Product
                </Typography>
                {loadingProduct ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={60} />
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {byProduct.slice(0, 5).map((item, index) => {
                      const maxCount = Math.max(...byProduct.map(p => p.count));
                      const percentage = (item.count / maxCount) * 100;
                      return (
                        <Box key={index}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">{item.product}</Typography>
                            <Typography variant="body2" fontWeight={600}>{item.count}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={percentage} sx={{ height: 6, borderRadius: 1 }} />
                          <Typography variant="caption" color="text.secondary">{formatCurrency(item.mrr)} MRR</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Top Categories */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Top Feature Categories
                </Typography>
                {loadingCategories ? (
                  <Grid container spacing={2}>
                    {[...Array(6)].map((_, i) => (
                      <Grid item xs={6} key={i}>
                        <Skeleton variant="rectangular" height={60} />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Grid container spacing={2}>
                    {topCategories.slice(0, 6).map((item, index) => (
                      <Grid item xs={6} key={index}>
                        <Box sx={{
                          p: 2,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                        }}>
                          <Typography variant="body2" noWrap>{item.category}</Typography>
                          <Typography variant="h6" fontWeight={600}>{item.count}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatCurrency(item.mrr)} MRR</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Critical Attention Section */}
        {!loadingCritical && criticalAttention.length > 0 && (
          <Card sx={{
            mb: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.main, 0.08)} 100%)`,
            border: `2px solid ${theme.palette.error.main}`,
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <WarningIcon sx={{ color: theme.palette.error.main, fontSize: 28 }} />
                <Typography variant="h6" fontWeight={600}>
                  Critical Attention Required
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {criticalAttention.map((item, index) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Box sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: `1px solid ${theme.palette.error.light}`
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Chip label={item.urgency} size="small" color="error" />
                        <Typography variant="h6" fontWeight={700}>{formatCurrency(item.mrr)}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={600} noWrap>{item.customer}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                        {item.feature}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.product}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Top 10 by MRR Table */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
              Top 10 Requests by MRR Impact
            </Typography>
            {loadingTopMrr ? (
              <Box>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={50} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                      <TableCell><strong>Customer</strong></TableCell>
                      <TableCell><strong>MRR</strong></TableCell>
                      <TableCell><strong>Urgency</strong></TableCell>
                      <TableCell><strong>Feature</strong></TableCell>
                      <TableCell><strong>Product</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topMrr.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{formatCurrency(row.mrr)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.urgency}
                            size="small"
                            sx={{
                              bgcolor: alpha(getUrgencyColor(row.urgency), 0.15),
                              color: getUrgencyColor(row.urgency),
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" noWrap>{row.feature}</Typography>
                        </TableCell>
                        <TableCell>{row.product}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" size="large">
            View All Requests
          </Button>
          <Button variant="outlined" size="large">
            Filter Urgent Only
          </Button>
          <Button variant="outlined" size="large">
            Export to CSV
          </Button>
        </Box>
      </Box>
    </AdminLayout>
  );
}
