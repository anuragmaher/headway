/**
 * Compact Horizontal Bar Breakdown
 * Executive dashboard friendly
 */

import { Box, Typography, useTheme, alpha } from '@mui/material';

interface BarItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface HorizontalBarBreakdownProps {
  items: BarItem[];
  maxValue?: number;
  compact?: boolean;
}

export function HorizontalBarBreakdown({
  items,
  maxValue,
  compact = false,
}: HorizontalBarBreakdownProps): JSX.Element {
  const theme = useTheme();
  const max = maxValue || Math.max(...items.map((item) => item.value), 0);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.75 : 1.25,
      }}
    >
      {items.map((item) => (
        <Box key={item.label}>
          {/* Label Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: compact ? 0.25 : 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: compact ? '0.75rem' : '0.813rem',
                fontWeight: 500,
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline' }}>
              <Typography
                sx={{
                  fontSize: compact ? '0.75rem' : '0.813rem',
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
                {item.percentage}%
              </Typography>
            </Box>
          </Box>

          {/* Bar */}
          <Box
            sx={{
              height: compact ? 4 : 6,
              width: '100%',
              backgroundColor: alpha(theme.palette.divider, 0.25),
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
                borderRadius: 1,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
