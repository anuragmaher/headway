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
  isMobileFullScreen?: boolean;
  onNavigateToTheme: (themeId: string) => void;
  onNavigateToSubTheme: (themeId: string, subThemeId: string) => void;
}

const PanelContent = forwardRef<HTMLDivElement, PanelContentProps>(
  ({ mentions, selectedCustomerAsk, isLoading, expandedMentionId, onClose, onToggleMention, onNavigateToCustomerAsk, isMobileFullScreen = false, onNavigateToTheme, onNavigateToSubTheme }, ref) => {
    const theme = useTheme();

    return (
      <Box
        ref={ref}
        sx={{
          width: isMobileFullScreen ? '100%' : '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
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
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
              >
                {selectedCustomerAsk ? selectedCustomerAsk.name : 'Customer Feedback & Mentions'}
              </Typography>
              {selectedCustomerAsk && (
                <Typography variant="body2" color="textSecondary">
                  Customer feedback and mentions
                </Typography>
              )}
            </Box>

            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color: theme.palette.text.secondary,
                ml: 1,
                '&:hover': {
                  color: theme.palette.text.primary,
                  bgcolor: alpha(theme.palette.action.hover, 0.08),
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Subheader with count */}
          {selectedCustomerAsk && (
            <Box
              sx={{
                px: 3,
                py: 1.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="body2" color="textSecondary">
                {mentions.length} mention{mentions.length !== 1 ? 's' : ''} from customers
              </Typography>
            </Box>
          )}

          {/* Mentions List */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
              px: 2,
              py: 2,
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
              <Box>
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
        </Box>
      </Box>
    );
  }
);

PanelContent.displayName = 'PanelContent';

interface MentionsPanelProps {
  isMobileFullScreen?: boolean;
}

export const MentionsPanel: React.FC<MentionsPanelProps> = ({ isMobileFullScreen = false }) => {
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

  if (isMobileFullScreen) {
    // Mobile full-screen mode - no slide animation, always visible
    return (
      <PanelContent
        mentions={mentions}
        selectedCustomerAsk={selectedCustomerAsk}
        isLoading={isLoading}
        expandedMentionId={expandedMentionId}
        onClose={handleClose}
        onToggleMention={handleToggleMention}
        onNavigateToCustomerAsk={handleNavigateToCustomerAsk}
        isMobileFullScreen={isMobileFullScreen}
        onNavigateToTheme={handleNavigateToTheme}
        onNavigateToSubTheme={handleNavigateToSubTheme}
      />
    );
  }

  // Desktop slide-in panel
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
        isMobileFullScreen={isMobileFullScreen}
        onNavigateToTheme={handleNavigateToTheme}
        onNavigateToSubTheme={handleNavigateToSubTheme}
      />
    </Slide>
  );
};

export default MentionsPanel;
