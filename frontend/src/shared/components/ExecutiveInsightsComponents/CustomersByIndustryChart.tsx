/**
 * Customers by Industry Pie Chart Component
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

interface CustomersByIndustryChartProps {
  customersByIndustry: Array<{
    industry: string;
    count: number;
  }>;
}

export function CustomersByIndustryChart({
  customersByIndustry,
}: CustomersByIndustryChartProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.error.main,
    alpha(theme.palette.primary.main, 0.6),
    alpha(theme.palette.secondary.main, 0.6),
  ];

  const data = customersByIndustry
    .slice(0, 10)
    .map((item, index) => ({
      name: item.industry.length > 15 ? item.industry.substring(0, 15) + '...' : item.industry,
      fullName: item.industry,
      value: item.count,
      color: colors[index % 8],
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
            {data.payload.fullName || data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Customers: {data.value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Percentage: {percent}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          height: '100%',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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
            Top 10 Customers by Industry
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 140,
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
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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
          Top 10 Customers by Industry
        </Typography>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={50}
              paddingAngle={2}
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
              height={24}
              iconType="circle"
              formatter={(value: string, entry: any) => (
                <span style={{ color: theme.palette.text.primary, fontSize: '0.688rem' }}>
                  {entry.payload.fullName || value}: {entry.payload.value}
                </span>
              )}
              wrapperStyle={{
                fontSize: '0.688rem',
                paddingTop: '2px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
