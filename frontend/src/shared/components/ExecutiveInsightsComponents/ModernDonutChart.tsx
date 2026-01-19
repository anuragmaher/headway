/**
 * Modern Donut Chart Component with Center Value Display
 * Inspired by Reviews Dashboard design
 */

import { Box, Typography, useTheme, alpha } from '@mui/material';

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface ModernDonutChartProps {
  segments: DonutSegment[];
  centerValue: string | number;
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}

export function ModernDonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 120,
  strokeWidth = 20,
}: ModernDonutChartProps): JSX.Element {
  const theme = useTheme();
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  
  if (total === 0) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '1.5rem', lineHeight: 1.2 }}>
          {centerValue}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.688rem', display: 'block', mt: 0.25 }}>
          {centerLabel}
        </Typography>
      </Box>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += (percentage / 100) * circumference;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'all 0.3s ease',
              }}
            />
          );
        })}
      </svg>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontSize: '1.5rem',
            lineHeight: 1.2,
          }}
        >
          {centerValue}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.688rem',
            display: 'block',
            mt: 0.25,
          }}
        >
          {centerLabel}
        </Typography>
      </Box>
    </Box>
  );
}
