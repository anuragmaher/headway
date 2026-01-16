/**
 * Top Engaged Customers Bar Chart Component
 */

import { Card, CardContent, Typography, alpha, useTheme, useMediaQuery } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TopEngagedCustomersChartProps {
  topEngagedCustomers: Array<{
    customer_id: string;
    name: string;
    industry: string;
    message_count: number;
  }>;
}

export function TopEngagedCustomersChart({
  topEngagedCustomers,
}: TopEngagedCustomersChartProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
          Top 10 Most Engaged Customers
        </Typography>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={topEngagedCustomers}
            layout="vertical"
            margin={
              isMobile
                ? { top: 5, right: 10, left: 5, bottom: 5 }
                : { top: 5, right: 60, left: 0, bottom: 5 }
            }
          >
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.2)} />
            <XAxis
              type="number"
              stroke={theme.palette.text.secondary}
              style={{ fontSize: isMobile ? '10px' : '12px' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={theme.palette.text.secondary}
              style={{ fontSize: isMobile ? '9px' : '10px' }}
              width={isMobile ? 60 : 70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} messages`,
                props.payload.industry,
              ]}
            />
            <Bar dataKey="message_count" fill={theme.palette.secondary.main} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
