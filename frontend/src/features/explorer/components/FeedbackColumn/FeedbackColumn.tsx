/**
 * FeedbackColumn - Right column displaying messages/mentions
 * Shows the actual customer feedback linked to features
 */
import React from 'react';
import { Box, Typography, Skeleton, Fade, useTheme } from '@mui/material';
import { FeedbackCard } from './FeedbackCard';
import {
  useFeedbackItems,
  useSelectedTheme,
  useSelectedSubTheme,
  useSelectedFeedbackId,
  useIsLoadingFeedback,
  useExplorerActions,
} from '../../store';

interface FeedbackColumnProps {
  minWidth?: number;
}

export const FeedbackColumn: React.FC<FeedbackColumnProps> = ({
  minWidth = 400,
}) => {
  const theme = useTheme();
  const feedbackItems = useFeedbackItems();
  const selectedTheme = useSelectedTheme();
  const selectedSubTheme = useSelectedSubTheme();
  const selectedFeedbackId = useSelectedFeedbackId();
  const isLoading = useIsLoadingFeedback();
  const { selectFeedback, expandFeedback } = useExplorerActions();

  const handleFeedbackSelect = (feedbackId: string) => {
    selectFeedback(feedbackId);
  };

  const handleFeedbackExpand = (feedbackId: string) => {
    expandFeedback(feedbackId);
  };

  // Placeholder when nothing selected
  if (!selectedTheme) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: 'text.disabled',
              textTransform: 'uppercase',
            }}
          >
            Messages
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
            Select a theme and feature to view messages
          </Typography>
        </Box>
      </Box>
    );
  }

  // Placeholder when theme selected but no feature
  if (!selectedSubTheme) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: 'text.disabled',
              textTransform: 'uppercase',
            }}
          >
            Messages
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
            Select a feature to view its messages
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: 'text.secondary',
            textTransform: 'uppercase',
          }}
        >
          Messages
        </Typography>
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'text.primary',
            mt: 0.5,
          }}
        >
          {selectedSubTheme.name}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.disabled',
            mt: 0.25,
          }}
        >
          {feedbackItems.length} message{feedbackItems.length !== 1 ? 's' : ''} from customers
        </Typography>
      </Box>

      {/* Message List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
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
                height={100}
                sx={{ mb: 1.5, borderRadius: 1.5 }}
              />
            ))}
          </Box>
        ) : feedbackItems.length === 0 ? (
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
              No messages found for this feature
            </Typography>
          </Box>
        ) : (
          <Fade in={true} timeout={200}>
            <Box sx={{ p: 1.5 }}>
              {feedbackItems.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  isSelected={feedback.id === selectedFeedbackId}
                  onSelect={handleFeedbackSelect}
                  onExpand={handleFeedbackExpand}
                />
              ))}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
};

export default FeedbackColumn;
