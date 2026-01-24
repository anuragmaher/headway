/**
 * MentionsPanel - Slide-in panel showing mentions for a selected customer ask
 * Uses split-screen layout: slides in from right taking 50% width
 */
import React, { forwardRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  Slide,
  useTheme,
  Divider,
  Paper,
  alpha,
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

/**
 * Inner Panel Content - forwardRef needed for Slide transition
 */
interface PanelContentProps {
  mentions: ReturnType<typeof useMentions>;
  selectedCustomerAsk: ReturnType<typeof useSelectedCustomerAsk>;
  isLoading: boolean;
  expandedMentionId: string | null;
  onClose: () => void;
  onToggleMention: (mentionId: string) => void;
  onNavigateToCustomerAsk: (customerAskId: string) => void;
  onNavigateToTheme: (themeId: string) => void;
  onNavigateToSubTheme: (themeId: string, subThemeId: string) => void;
}

const PanelContent = forwardRef<HTMLDivElement, PanelContentProps>(
  ({ mentions, selectedCustomerAsk, isLoading, expandedMentionId, onClose, onToggleMention, onNavigateToCustomerAsk, onNavigateToTheme, onNavigateToSubTheme }, ref) => {
    const theme = useTheme();

    return (
      <Box
        ref={ref}
        sx={{
          width: '50%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pl: 1.5,
          pr: 0,
          py: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            border: 'none',
            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: theme.palette.background.paper,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
              bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
              flexShrink: 0,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedCustomerAsk ? selectedCustomerAsk.name : 'Mentions'}
              </Typography>
            </Box>

            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color: theme.palette.text.disabled,
                p: 0.5,
                '&:hover': {
                  color: theme.palette.text.secondary,
                  bgcolor: alpha(theme.palette.action.hover, 0.04),
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Subheader with count */}
          {selectedCustomerAsk && (
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.disabled',
                }}
              >
                {mentions.length} mention{mentions.length !== 1 ? 's' : ''} from customers
              </Typography>
            </Box>
          )}

          {/* Mentions List */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
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
                      onToggleExpand={onToggleMention}
                      onNavigateToCustomerAsk={onNavigateToCustomerAsk}
                      onNavigateToTheme={onNavigateToTheme}
                      onNavigateToSubTheme={onNavigateToSubTheme}
                    />
                    {index < mentions.length - 1 && (
                      <Divider sx={{ my: 1.5 }} />
                    )}
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }
);

PanelContent.displayName = 'PanelContent';

export const MentionsPanel: React.FC = () => {
  const mentions = useMentions();
  const selectedCustomerAsk = useSelectedCustomerAsk();
  const isLoading = useIsLoadingMentions();
  const isPanelOpen = useIsMentionsPanelOpen();
  const expandedMentionId = useExpandedMentionId();
  const {
    closeMentionsPanel,
    toggleMentionExpand,
    selectCustomerAsk,
    selectTheme,
    selectSubTheme,
  } = useExplorerActions();

  const handleClose = () => {
    closeMentionsPanel();
  };

  const handleToggleMention = (mentionId: string) => {
    toggleMentionExpand(mentionId);
  };

  // Navigate to another CustomerAsk (for multi-linked messages)
  const handleNavigateToCustomerAsk = (customerAskId: string) => {
    // Select the new CustomerAsk - this will trigger fetching its mentions
    selectCustomerAsk(customerAskId);
  };

  // Navigate to a theme - closes mentions panel and shows that theme's subthemes
  const handleNavigateToTheme = (themeId: string) => {
    closeMentionsPanel();
    selectTheme(themeId);
  };

  // Navigate to a subtheme - first select theme, then after subthemes load, select the subtheme
  const handleNavigateToSubTheme = (themeId: string, subThemeId: string) => {
    closeMentionsPanel();
    selectTheme(themeId);
    // Wait for subthemes to be fetched, then select the subtheme
    setTimeout(() => {
      selectSubTheme(subThemeId);
    }, 100);
  };

  return (
    <Slide direction="left" in={isPanelOpen} mountOnEnter unmountOnExit timeout={250}>
      <PanelContent
        mentions={mentions}
        selectedCustomerAsk={selectedCustomerAsk}
        isLoading={isLoading}
        expandedMentionId={expandedMentionId}
        onClose={handleClose}
        onToggleMention={handleToggleMention}
        onNavigateToCustomerAsk={handleNavigateToCustomerAsk}
        onNavigateToTheme={handleNavigateToTheme}
        onNavigateToSubTheme={handleNavigateToSubTheme}
      />
    </Slide>
  );
};

export default MentionsPanel;
