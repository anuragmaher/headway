/**
 * Compact KPI Tile – Space-efficient executive metric
 */

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ReactNode;
  accentColor: string;
  trend?: {
    value: number;
    label?: string;
  };
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  accentColor,
  trend,
}: KPICardProps): JSX.Element {
  const theme = useTheme();

  const trendColor =
    trend && trend.value > 0
      ? theme.palette.success.main
      : trend && trend.value < 0
      ? theme.palette.error.main
      : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        height: '100%',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: alpha(accentColor, 0.04),
          borderColor: alpha(accentColor, 0.3),
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(accentColor, 0.12),
          color: accentColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      {/* Content */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>

          {trend && (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: trendColor,
              }}
            >
              {trend.value > 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </Typography>
          )}
        </Box>

        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
