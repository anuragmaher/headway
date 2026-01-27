/**
 * ConfidenceScore Component
 * Color-coded confidence percentage (Green >= 80%, Orange < 80%)
 * Supports light and dark mode
 */

import { Box } from '@mui/material';
import { useOnboardingColors } from '../../hooks/useOnboardingColors';

interface ConfidenceScoreProps {
  score: number;
  size?: 'small' | 'medium';
}

export function ConfidenceScore({
  score,
  size = 'medium',
}: ConfidenceScoreProps): JSX.Element {
  const colors = useOnboardingColors();
  const isHigh = score >= 80;

  const bgColor = isHigh ? colors.success.light : colors.warning.light;
  const textColor = isHigh ? colors.success.dark : colors.warning.main;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: size === 'small' ? 0.75 : 1,
        py: 0.25,
        borderRadius: 0.75,
        bgcolor: bgColor,
        color: textColor,
        fontSize: size === 'small' ? '0.65rem' : '0.7rem',
        fontWeight: 600,
        lineHeight: 1,
        minWidth: size === 'small' ? 32 : 36,
      }}
    >
      {Math.round(score)}%
    </Box>
  );
}
