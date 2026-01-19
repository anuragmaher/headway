/**
 * Compact Themes Insight – Executive-friendly
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
} from '@mui/material';
import { Category as CategoryIcon } from '@mui/icons-material';
import { ModernDonutChart } from './ModernDonutChart';

interface ModernThemesChartProps {
  topThemes: Array<{
    name: string;
    feature_count: number;
  }>;
}

export function ModernThemesChart({ topThemes }: ModernThemesChartProps): JSX.Element {
  const theme = useTheme();

  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
  ];

  const data = topThemes
    .slice(0, 5)
    .map((t, index) => ({
      name: t.name,
      value: t.feature_count,
      color: colors[index % 5],
    }))
    .filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
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
            Top 5 Themes
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
            No themes available
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
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <CategoryIcon sx={{ color: theme.palette.primary.main, fontSize: 14 }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: theme.palette.text.secondary,
            }}
          >
            Top 5 Themes
          </Typography>
        </Box>

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
              segments={data.map((item) => ({
                value: item.value,
                color: item.color,
                label: item.name,
              }))}
              centerValue={total}
              centerLabel="Total"
              size={90}
              strokeWidth={12}
            />
          </Box>

          {/* List (primary signal) */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {data.map((item, index) => {
                const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: item.color,
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.name.length > 18 ? item.name.substring(0, 18) + '...' : item.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline' }}>
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {item.value}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.688rem',
                          color: theme.palette.text.secondary,
                          minWidth: 32,
                          textAlign: 'right',
                        }}
                      >
                        {percentage}%
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
