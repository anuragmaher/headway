/**
 * ExternalCallLink component for displaying "Go to call" links
 * Supports Fathom (recording URL) and Gong (call URL construction)
 */

import React from 'react';
import { Button, Tooltip, alpha, useTheme } from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface ExternalCallLinkProps {
  source?: string;
  externalId?: string;
  messageMetadata?: Record<string, any>;
  size?: 'small' | 'medium';
}

/**
 * Constructs the external URL based on source type
 */
const getExternalUrl = (
  source?: string,
  externalId?: string,
  messageMetadata?: Record<string, any>
): string | null => {
  if (!source) return null;

  if (source === 'fathom') {
    // For Fathom, use the recording URL directly from metadata
    if (messageMetadata?.recording_url) {
      return messageMetadata.recording_url;
    }
  }

  if (source === 'gong') {
    // For Gong, construct URL using call ID
    if (externalId) {
      // Gong URL format: https://app.gong.io/call/<call_id>
      return `https://app.gong.io/call/${externalId}`;
    }
  }

  return null;
};

/**
 * Gets the source label for the button tooltip
 */
const getSourceLabel = (source?: string): string => {
  switch (source) {
    case 'fathom':
      return 'View recording';
    case 'gong':
      return 'View Gong call';
    default:
      return 'View source';
  }
};

export const ExternalCallLink: React.FC<ExternalCallLinkProps> = ({
  source,
  externalId,
  messageMetadata,
  size = 'small'
}) => {
  const theme = useTheme();
  const externalUrl = getExternalUrl(source, externalId, messageMetadata);

  // Don't render if we can't determine the URL
  if (!externalUrl) {
    return null;
  }

  return (
    <Tooltip title={getSourceLabel(source)}>
      <Button
        size={size}
        variant="outlined"
        target="_blank"
        rel="noopener noreferrer"
        href={externalUrl}
        onClick={(e) => {
          e.stopPropagation();
        }}
        endIcon={<OpenInNewIcon sx={{ fontSize: size === 'small' ? '0.9rem' : '1.1rem' }} />}
        sx={{
          textTransform: 'none',
          fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          py: size === 'small' ? 0.5 : 1,
          px: size === 'small' ? 1 : 1.5,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
          color: theme.palette.primary.main,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            borderColor: theme.palette.primary.main
          }
        }}
      >
        Go to call
      </Button>
    </Tooltip>
  );
};
