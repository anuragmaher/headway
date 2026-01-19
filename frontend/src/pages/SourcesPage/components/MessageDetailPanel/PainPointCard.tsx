/**
 * PainPointCard component - Displays extracted pain point
 * Clean, minimal design with optional severity badge and quote.
 */

import { Box, Typography, alpha, useTheme, Chip } from '@mui/material';
import { ReportProblem as PainIcon, FormatQuote as QuoteIcon } from '@mui/icons-material';

interface PainPointCardProps {
  title?: string;
  description: string;
  severity?: string;
  quote?: string;
}

/**
 * Get severity badge color
 */
const getSeverityColor = (severity: string, theme: ReturnType<typeof useTheme>) => {
  switch (severity?.toLowerCase()) {
    case 'high':
      return theme.palette.error.main;
    case 'medium':
      return theme.palette.warning.main;
    case 'low':
      return theme.palette.info.main;
    default:
      return theme.palette.grey[500];
  }
};

export function PainPointCard({ title, description, severity, quote }: PainPointCardProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <PainIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: theme.palette.error.main,
            flex: 1,
          }}
        >
          Pain Point
        </Typography>
        {severity && (
          <Chip
            label={severity}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              bgcolor: alpha(getSeverityColor(severity, theme), 0.1),
              color: getSeverityColor(severity, theme),
              borderRadius: 0.75,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          p: 1.5,
          bgcolor: alpha(theme.palette.error.main, 0.04),
          borderRadius: 1,
          borderLeft: `2px solid ${alpha(theme.palette.error.main, 0.4)}`,
        }}
      >
        {title && (
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              color: theme.palette.text.primary,
              mb: 0.5,
              lineHeight: 1.4,
            }}
          >
            {title}
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
        {quote && (
          <Box
            sx={{
              mt: 1.5,
              pl: 1.5,
              borderLeft: `2px solid ${alpha(theme.palette.text.disabled, 0.2)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <QuoteIcon sx={{ fontSize: 12, color: theme.palette.text.disabled, mt: 0.25 }} />
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: theme.palette.text.disabled,
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                }}
              >
                "{quote}"
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default PainPointCard;
