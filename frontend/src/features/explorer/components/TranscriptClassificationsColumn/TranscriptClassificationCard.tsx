/**
 * TranscriptClassificationCard - Card component for displaying a transcript classification
 * Shows source info, extracted data summary, and processing status
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  useTheme,
} from '@mui/material';
import {
  VideoCall as VideoIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import type { TranscriptClassificationItem } from '../../store/slices/transcriptClassificationSlice';

interface TranscriptClassificationCardProps {
  classification: TranscriptClassificationItem;
  isSelected: boolean;
  onSelect: (classificationId: string) => void;
}

export const TranscriptClassificationCard: React.FC<TranscriptClassificationCardProps> = ({
  classification,
  isSelected,
  onSelect,
}) => {
  const theme = useTheme();

  // Format relative time
  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  // Get status color and icon
  const getStatusInfo = () => {
    switch (classification.processingStatus) {
      case 'completed':
        return { color: '#4caf50', icon: SuccessIcon, label: 'Completed' };
      case 'failed':
        return { color: '#f44336', icon: ErrorIcon, label: 'Failed' };
      case 'processing':
        return { color: '#ff9800', icon: PendingIcon, label: 'Processing' };
      default:
        return { color: '#9e9e9e', icon: PendingIcon, label: 'Pending' };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Extract summary and mappings from extracted_data
  const getSummaryAndMappings = () => {
    const data = classification.extractedData;
    
    // Check for mappings array (primary structure)
    const mappings = data?.mappings;
    if (Array.isArray(mappings) && mappings.length > 0) {
      // Return first mapping's interpreted_need or verbatim_quote as summary
      const firstMapping = mappings[0];
      return {
        summary: firstMapping.interpreted_need || firstMapping.verbatim_quote || firstMapping.reasoning || 'Transcript Classification',
        mappingsCount: mappings.length,
        mappings: mappings,
      };
    }
    
    // Fallback to other structures
    if (data?.classification?.summary) {
      return {
        summary: data.classification.summary,
        mappingsCount: 0,
        mappings: [],
      };
    }
    if (data?.insights?.key_points?.[0]) {
      return {
        summary: data.insights.key_points[0],
        mappingsCount: 0,
        mappings: [],
      };
    }
    if (data?.features?.[0]?.name) {
      return {
        summary: data.features[0].name,
        mappingsCount: 0,
        mappings: [],
      };
    }
    
    return {
      summary: classification.sourceTitle || 'Transcript Classification',
      mappingsCount: 0,
      mappings: [],
    };
  };

  const { summary, mappingsCount, mappings } = getSummaryAndMappings();

  return (
    <Box
      onClick={() => onSelect(classification.id)}
      sx={{
        p: 1.5,
        mb: 1,
        borderRadius: 1.5,
        cursor: 'pointer',
        bgcolor: isSelected
          ? theme.palette.mode === 'dark'
            ? 'rgba(25, 118, 210, 0.16)'
            : 'rgba(25, 118, 210, 0.08)'
          : 'background.paper',
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          bgcolor: isSelected
            ? theme.palette.mode === 'dark'
              ? 'rgba(25, 118, 210, 0.20)'
              : 'rgba(25, 118, 210, 0.12)'
            : theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: isSelected ? 'primary.main' : 'action.hover',
        },
      }}
    >
      {/* Header with source title */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <VideoIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.5 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {classification.sourceTitle || `${classification.sourceType} - ${classification.sourceId.slice(0, 8)}`}
          </Typography>
        </Box>
      </Box>

      {/* Summary/Description */}
      {summary && (
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            mt: 0.5,
            mb: 1,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary}
        </Typography>
      )}

      {/* Status and metadata row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 1.5,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {/* Left side: Status chip and source type */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<StatusIcon sx={{ fontSize: 14 }} />}
            label={statusInfo.label}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 600,
              bgcolor: `${statusInfo.color}15`,
              color: statusInfo.color,
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />

          <Chip
            label={classification.sourceType.toUpperCase()}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 500,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: 'text.secondary',
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />
        </Box>

        {/* Right side: Date */}
        <Typography
          sx={{
            fontSize: '0.6875rem',
            color: 'text.disabled',
          }}
        >
          {formatRelativeTime(classification.transcriptDate)}
        </Typography>
      </Box>

      {/* Mappings count and confidence score */}
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        {mappingsCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
              Mappings:
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary' }}>
              {mappingsCount}
            </Typography>
          </Box>
        )}
        {classification.confidenceScore && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
              Confidence:
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary' }}>
              {classification.confidenceScore}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TranscriptClassificationCard;
