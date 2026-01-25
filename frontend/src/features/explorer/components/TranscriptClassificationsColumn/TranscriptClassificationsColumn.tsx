/**
 * TranscriptClassificationsColumn - Third column displaying transcript classifications for a selected sub-theme
 * Replaces CustomerAsksColumn to show AI-extracted transcript data
 */
import React, { useEffect } from 'react';
import { Box, Typography, Skeleton, Fade, useTheme } from '@mui/material';
import { TranscriptClassificationCard } from './TranscriptClassificationCard';
import {
  useTranscriptClassifications,
  useSelectedTheme,
  useSelectedSubTheme,
  useSelectedTranscriptClassificationId,
  useIsLoadingTranscriptClassifications,
  useExplorerActions,
} from '../../store';

interface TranscriptClassificationsColumnProps {
  isPanelOpen?: boolean;
}

export const TranscriptClassificationsColumn: React.FC<TranscriptClassificationsColumnProps> = ({
  isPanelOpen = false,
}) => {
  const theme = useTheme();
  const transcriptClassifications = useTranscriptClassifications();
  const selectedTheme = useSelectedTheme();
  const selectedSubTheme = useSelectedSubTheme();
  const selectedTranscriptClassificationId = useSelectedTranscriptClassificationId();
  const isLoading = useIsLoadingTranscriptClassifications();
  const { fetchTranscriptClassifications, selectTranscriptClassification } = useExplorerActions();

  // Fetch transcript classifications when sub-theme changes
  useEffect(() => {
    if (selectedSubTheme?.id) {
      fetchTranscriptClassifications(selectedSubTheme.id, selectedTheme?.id);
    }
  }, [selectedSubTheme?.id, selectedTheme?.id, fetchTranscriptClassifications]);

  const handleClassificationSelect = (classificationId: string) => {
    selectTranscriptClassification(classificationId);
  };

  // Common width styling with transition
  const columnSx = {
    width: isPanelOpen ? '50%' : '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
    transition: 'width 0.25s ease-out',
    overflow: 'hidden',
    minWidth: 0,
  };

  // Placeholder when nothing selected
  if (!selectedTheme) {
    return (
      <Box sx={columnSx}>
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Transcript Classifications
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
            Select a theme and sub-theme to view transcript classifications
          </Typography>
        </Box>
      </Box>
    );
  }

  // Placeholder when theme selected but no sub-theme
  if (!selectedSubTheme) {
    return (
      <Box sx={columnSx}>
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Transcript Classifications
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
            Select a sub-theme to view transcript classifications
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={columnSx}>
      {/* Header - Shows selected sub-theme name */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.5,
            }}
          >
            {selectedSubTheme.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            Transcript classifications and feature requests
          </Typography>
        </Box>
      </Box>

      {/* Content area with scroll */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(0,0,0,0.1)',
            borderRadius: 3,
          },
        }}
      >
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={120}
                sx={{ mb: 1.5, borderRadius: 1.5 }}
              />
            ))}
          </Box>
        ) : transcriptClassifications.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              p: 4,
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
              No transcript classifications found for this sub-theme
            </Typography>
          </Box>
        ) : (
          <Fade in={true} timeout={200}>
            <Box sx={{ p: 1.5 }}>
              {transcriptClassifications.map((classification) => (
                <TranscriptClassificationCard
                  key={classification.id}
                  classification={classification}
                  isSelected={classification.id === selectedTranscriptClassificationId}
                  onSelect={handleClassificationSelect}
                />
              ))}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
};

export default TranscriptClassificationsColumn;
