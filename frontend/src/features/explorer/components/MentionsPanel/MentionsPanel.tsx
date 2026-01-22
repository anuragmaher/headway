/**
 * MentionsPanel - Slide-in panel showing mentions for a selected customer ask
 * Slides in from the right, covering 1/3 of the CustomerAsksColumn
 */
import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  Slide,
  useTheme,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { MentionCard } from './MentionCard';
import {
  useMentions,
  useSelectedCustomerAsk,
  useIsLoadingMentions,
  useIsMentionsPanelOpen,
  useExpandedMentionId,
  useExplorerActions,
} from '../../store';

interface MentionsPanelProps {
  width?: number;
}

export const MentionsPanel: React.FC<MentionsPanelProps> = ({
  width = 420,
}) => {
  const theme = useTheme();
  const mentions = useMentions();
  const selectedCustomerAsk = useSelectedCustomerAsk();
  const isLoading = useIsLoadingMentions();
  const isPanelOpen = useIsMentionsPanelOpen();
  const expandedMentionId = useExpandedMentionId();
  const { closeMentionsPanel, toggleMentionExpand } = useExplorerActions();

  const handleClose = () => {
    closeMentionsPanel();
  };

  const handleToggleMention = (mentionId: string) => {
    toggleMentionExpand(mentionId);
  };

  return (
    <Slide direction="left" in={isPanelOpen} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width,
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: theme.palette.mode === 'dark'
            ? '-4px 0 20px rgba(0, 0, 0, 0.4)'
            : '-4px 0 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.5px',
                color: 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              Mentions
            </Typography>
            {selectedCustomerAsk && (
              <>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    mt: 0.5,
                    lineHeight: 1.4,
                  }}
                >
                  {selectedCustomerAsk.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.disabled',
                    mt: 0.25,
                  }}
                >
                  {mentions.length} mention{mentions.length !== 1 ? 's' : ''} from customers
                </Typography>
              </>
            )}
          </Box>

          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ mt: -0.5, mr: -0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mentions List */}
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
              {[1, 2, 3].map((i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Skeleton variant="rounded" height={24} sx={{ mb: 1 }} />
                  <Skeleton variant="rounded" height={60} />
                </Box>
              ))}
            </Box>
          ) : mentions.length === 0 ? (
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
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  color: 'text.disabled',
                  textAlign: 'center',
                }}
              >
                No mentions found for this customer ask
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 1.5 }}>
              {mentions.map((mention, index) => (
                <React.Fragment key={mention.id}>
                  <MentionCard
                    mention={mention}
                    isExpanded={mention.id === expandedMentionId}
                    onToggleExpand={handleToggleMention}
                  />
                  {index < mentions.length - 1 && (
                    <Divider sx={{ my: 1.5 }} />
                  )}
                </React.Fragment>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Slide>
  );
};

export default MentionsPanel;
