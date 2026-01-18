/**
 * FeatureRequestCard component - Displays extracted feature request
 * Clean, minimal design with optional urgency badge and quote.
 */

import { Box, Typography, alpha, useTheme, Chip } from '@mui/material';
import { Lightbulb as FeatureIcon, FormatQuote as QuoteIcon } from '@mui/icons-material';

interface FeatureRequestCardProps {
  title: string;
  description: string;
  urgency?: string;
  quote?: string;
}

/**
 * Get urgency badge color
 */
const getUrgencyColor = (urgency: string, theme: ReturnType<typeof useTheme>) => {
  switch (urgency?.toLowerCase()) {
    case 'critical':
      return theme.palette.error.main;
    case 'high':
      return theme.palette.warning.main;
    case 'medium':
      return theme.palette.info.main;
    case 'low':
      return theme.palette.success.main;
    default:
      return theme.palette.grey[500];
  }
};

export function FeatureRequestCard({ title, description, urgency, quote }: FeatureRequestCardProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <FeatureIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: theme.palette.warning.main,
            flex: 1,
          }}
        >
          Feature Request
        </Typography>
        {urgency && (
          <Chip
            label={urgency}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              bgcolor: alpha(getUrgencyColor(urgency, theme), 0.1),
              color: getUrgencyColor(urgency, theme),
              borderRadius: 0.75,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          p: 1.5,
          bgcolor: alpha(theme.palette.warning.main, 0.04),
          borderRadius: 1,
          borderLeft: `2px solid ${alpha(theme.palette.warning.main, 0.4)}`,
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

export default FeatureRequestCard;
