/**
 * Top Features by Mentions Bar Chart Component
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Feature } from '../../../shared/store/executiveInsightsStore';

interface TopFeaturesChartProps {
  topFeatures: Feature[];
}

export function TopFeaturesChart({ topFeatures }: TopFeaturesChartProps): JSX.Element {
  const theme = useTheme();

  const data = topFeatures.map((f) => ({
    id: f.id,
    fullName: f.name,
    mentions: f.mention_count,
  }));


  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            borderRadius: 1,
            p: 1.5,
            boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
            pointerEvents: 'none',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {data.fullName || data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Mentions: {data.mentions}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Card
      
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
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
          Top 10 Features by Customer Mentions
        </Typography>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.2)} />
            <XAxis
              hide
            />
            <YAxis
              stroke={theme.palette.text.secondary}
              style={{ fontSize: '10px' }}
              label={{ value: 'Mentions', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'transparent' }}
              wrapperStyle={{ pointerEvents: 'none' }}
            />
            <Bar
              dataKey="mentions"
              fill={theme.palette.secondary.main}
              radius={[8, 8, 0, 0]}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={theme.palette.secondary.main}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
