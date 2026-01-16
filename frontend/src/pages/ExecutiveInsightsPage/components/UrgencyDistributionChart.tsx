/**
 * Urgency Distribution Pie Chart Component
 */

import { Box, Card, CardContent, Typography, alpha, useTheme, useMediaQuery } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface UrgencyDistributionChartProps {
  featuresByUrgency: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  getUrgencyColor: (urgency: string) => string;
}

export function UrgencyDistributionChart({
  featuresByUrgency,
  getUrgencyColor,
}: UrgencyDistributionChartProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const data = Object.entries(featuresByUrgency)
    .map(([urgency, count]) => ({
      name: urgency.charAt(0).toUpperCase() + urgency.slice(1),
      value: count,
      color: getUrgencyColor(urgency),
    }))
    .filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <Box
          sx={{
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            borderRadius: 1,
            p: 1.5,
            boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Count: {data.value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Percentage: {percent}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (total === 0) {
    return (
      <Card
        sx={{
          background: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          borderRadius: 2,
          height: '100%',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: { xs: 2, sm: 2.5, md: 3 },
              textAlign: 'center',
              fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
              color: theme.palette.text.primary,
              letterSpacing: '-0.01em',
            }}
          >
            Features by Urgency
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: isMobile ? 180 : 200,
              color: theme.palette.text.secondary,
            }}
          >
            <Typography variant="body2" sx={{ fontSize: '0.813rem' }}>No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 2,
        height: '100%',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
        '&:hover': {
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2 } }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            mb: { xs: 1, sm: 1.5, md: 1.5 },
            textAlign: 'center',
            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem' },
            color: theme.palette.text.primary,
            letterSpacing: '-0.01em',
          }}
        >
          Features by Urgency
        </Typography>
        <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 30 : 35}
              outerRadius={isMobile ? 55 : 65}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={({ percent }: { percent: number }) =>
                percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
              }
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={alpha(theme.palette.background.paper, 0.8)}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="circle"
              formatter={(value: string, entry: any) => (
                <span style={{ color: theme.palette.text.primary, fontSize: isMobile ? '0.688rem' : '0.75rem' }}>
                  {value}: {entry.payload.value}
                </span>
              )}
              wrapperStyle={{
                fontSize: isMobile ? '0.688rem' : '0.75rem',
                paddingTop: '4px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
