/**
 * Compact Status Insight – Executive-friendly
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
} from '@mui/material';
import { ModernDonutChart } from './ModernDonutChart';
import { HorizontalBarBreakdown } from './HorizontalBarBreakdown';

interface ModernStatusChartProps {
  featuresByStatus: {
    new: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  getStatusColor: (status: string) => string;
}

export function ModernStatusChart({
  featuresByStatus,
  getStatusColor,
}: ModernStatusChartProps): JSX.Element {
  const theme = useTheme();

  const data = Object.entries(featuresByStatus)
    .map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
      color: getStatusColor(status),
    }))
    .filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', mb: 1.5 }}>
            Features by Status
          </Typography>
          <Box
            sx={{
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.palette.text.secondary,
            }}
          >
            No data available
          </Box>
        </CardContent>
      </Card>
    );
  }

  const barItems = data.map((item) => ({
    label: item.name,
    value: item.value,
    percentage: Math.round((item.value / total) * 100),
    color: item.color,
  }));

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
            mb: 1.5,
            display: 'block',
          }}
        >
          Features by Status
        </Typography>

        {/* Content */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Mini Donut (supporting) */}
          <Box sx={{ flexShrink: 0 }}>
            <ModernDonutChart
              segments={barItems.map((b) => ({
                value: b.value,
                color: b.color,
                label: b.label,
              }))}
              centerValue={total}
              centerLabel="Total"
              size={90}
              strokeWidth={12}
            />
          </Box>

          {/* Bars (primary signal) */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <HorizontalBarBreakdown
              items={barItems}
              maxValue={total}
              compact
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
