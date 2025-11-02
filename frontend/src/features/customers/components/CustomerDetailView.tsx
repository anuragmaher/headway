/**
 * Customer Detail View Component
 *
 * Displays consolidated customer information including:
 * - Basic info
 * - Feature requests
 * - Pain points
 * - Summary and highlights
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  alpha,
  useTheme,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Message as MessageIcon,
  ErrorOutline as ErrorOutlineIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { customersApi, CustomerConsolidatedView } from '@/services/customers-api';

interface CustomerDetailViewProps {
  customerId: string;
  workspaceId: string;
}

export function CustomerDetailView({
  customerId,
  workspaceId,
}: CustomerDetailViewProps): JSX.Element {
  const theme = useTheme();
  const [data, setData] = useState<CustomerConsolidatedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !workspaceId) return;

    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await customersApi.getCustomerConsolidatedView(workspaceId, customerId);
        setData(response);
      } catch (err: any) {
        console.error('Error fetching customer data:', err);
        setError(err.message || 'Failed to load customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId, workspaceId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Failed to load customer data'}</Alert>
      </Box>
    );
  }

  const { customer, feature_requests, pain_points, summary, highlights, total_messages } = data;

  const formatCurrency = (value?: number) => {
    if (!value) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'critical':
        return theme.palette.error.main;
      case 'high':
        return theme.palette.warning.main;
      case 'medium':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Header - Customer Info */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {customer.name}
        </Typography>
        {customer.domain && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {customer.domain}
          </Typography>
        )}
        {customer.contact_name && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {customer.contact_name}
            {customer.contact_email && ` • ${customer.contact_email}`}
          </Typography>
        )}
        {!customer.contact_name && customer.domain && (
          <Box sx={{ mb: 2 }} />
        )}

        {/* Metrics Row */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          {customer.arr && (
            <Chip
              label={`${formatCurrency(customer.arr)} ARR`}
              color="success"
              variant="outlined"
            />
          )}
          {customer.mrr && !customer.arr && (
            <Chip
              label={`${formatCurrency(customer.mrr)} MRR`}
              color="success"
              variant="outlined"
            />
          )}
          {customer.industry && (
            <Chip label={customer.industry} variant="outlined" />
          )}
          {customer.deal_stage && (
            <Chip label={customer.deal_stage} color="primary" variant="outlined" />
          )}
        </Stack>

        {/* Use Cases Section */}
        {customer.use_cases && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mt: 2,
              background: alpha(theme.palette.info.main, 0.05),
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'info.main', mb: 1 }}>
              How they use the product
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.6,
                whiteSpace: 'pre-line'
              }}
            >
              {customer.use_cases}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Highlights Section */}
      {highlights && highlights.length > 0 && (
        <Card
          elevation={0}
          sx={{
            mb: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <StarIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Highlights
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {highlights.map((highlight, index) => (
                <Chip
                  key={index}
                  label={highlight}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {summary && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: alpha(theme.palette.background.default, 0.5),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {summary}
          </Typography>
        </Paper>
      )}

      {/* Feature Requests Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CategoryIcon sx={{ mr: 1, color: 'text.primary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Feature Requests
          </Typography>
          <Chip
            label={feature_requests.length}
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>

        {feature_requests.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No feature requests identified
          </Typography>
        ) : (
          <List disablePadding>
            {feature_requests.map((feature) => (
              <Paper
                key={feature.id}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 1.5,
                  background: alpha(theme.palette.background.default, 0.3),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderLeft: `4px solid ${getUrgencyColor(feature.urgency)}`,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {feature.name}
                  </Typography>
                  <Chip
                    label={feature.urgency}
                    size="small"
                    sx={{
                      bgcolor: alpha(getUrgencyColor(feature.urgency), 0.1),
                      color: getUrgencyColor(feature.urgency),
                      fontWeight: 600,
                    }}
                  />
                </Box>
                {feature.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    {feature.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {feature.theme_name && (
                    <Chip label={feature.theme_name} size="small" variant="outlined" />
                  )}
                  <Chip
                    label={`${feature.mention_count} mentions`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={feature.status}
                    size="small"
                    variant="outlined"
                    color={feature.status === 'shipped' ? 'success' : 'default'}
                  />
                </Box>
              </Paper>
            ))}
          </List>
        )}
      </Box>

      {/* Pain Points Section */}
      {pain_points && pain_points.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ErrorOutlineIcon sx={{ mr: 1, color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Pain Points
            </Typography>
            <Chip
              label={pain_points.length}
              size="small"
              sx={{ ml: 1 }}
              color="warning"
            />
          </Box>

          <List disablePadding>
            {pain_points.map((painPoint, index) => (
              <Paper
                key={index}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 1.5,
                  background: alpha(theme.palette.warning.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                  borderLeft: `4px solid ${theme.palette.warning.main}`,
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  "{painPoint}"
                </Typography>
              </Paper>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
