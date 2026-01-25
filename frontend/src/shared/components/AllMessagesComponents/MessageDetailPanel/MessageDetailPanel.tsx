/**
 * MessageDetailPanel component - Split-screen message detail view
 *
 * Features two switchable tabs: AI Insights and Transcript/Content
 * Clean, seamless design with smooth slide-in animation from the right.
 */

import { forwardRef, useState } from 'react';
import { Box, Typography, IconButton, alpha, useTheme, CircularProgress, Alert, Paper, Slide, Tabs, Tab } from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Videocam as GongIcon,
  Headphones as FathomIcon,
  Tag as SlackIcon,
  AutoAwesome as InsightsIcon,
  Description as TranscriptIcon,
} from '@mui/icons-material';
import { useMessageDetailsStore } from '@/shared/store/AllMessagesStore';
import { ContentTab, AIInsightsTab } from './ContentTab';

/**
 * Get source icon based on source type
 */
const getSourceIcon = (source: string, size: number = 16) => {
  const sx = { fontSize: size };
  switch (source) {
    case 'gmail':
    case 'outlook':
      return <EmailIcon sx={sx} />;
    case 'gong':
      return <GongIcon sx={sx} />;
    case 'fathom':
      return <FathomIcon sx={sx} />;
    case 'slack':
      return <SlackIcon sx={sx} />;
    default:
      return <EmailIcon sx={sx} />;
  }
};

/**
 * Get source color
 */
const getSourceColor = (source: string, theme: ReturnType<typeof useTheme>) => {
  switch (source) {
    case 'gmail':
      return theme.palette.error.main;
    case 'outlook':
      return theme.palette.info.main;
    case 'gong':
      return theme.palette.secondary.main;
    case 'fathom':
      return theme.palette.success.main;
    case 'slack':
      return '#E01E5A';
    default:
      return theme.palette.primary.main;
  }
};

/** Tab type for the detail panel */
type DetailTab = 'insights' | 'transcript';

/**
 * Inner Panel Content - forwardRef needed for Slide transition
 */
interface PanelContentProps {
  selectedMessage: ReturnType<typeof useMessageDetailsStore>['selectedMessage'];
  isLoading: boolean;
  error: string | null;
  sourceColor: string;
  onClose: () => void;
}

const PanelContent = forwardRef<HTMLDivElement, PanelContentProps>(
  ({ selectedMessage, isLoading, error, sourceColor, onClose }, ref) => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState<DetailTab>('insights');

    const handleTabChange = (_: React.SyntheticEvent, newValue: DetailTab) => {
      setActiveTab(newValue);
    };

    // Get tab label based on source type
    const getTranscriptLabel = () => {
      if (!selectedMessage) return 'Content';
      switch (selectedMessage.source) {
        case 'gong':
        case 'fathom':
          return 'Transcript';
        case 'slack':
          return 'Message';
        default:
          return 'Content';
      }
    };

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
          pr: 2.5,
          py: 1.5,
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
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: theme.palette.background.paper,
            overflow: 'hidden',
          }}
        >
          {/* Compact Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            }}
          >
            {/* Source Icon */}
            {selectedMessage && (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(sourceColor, 0.1),
                  color: sourceColor,
                  flexShrink: 0,
                }}
              >
                {getSourceIcon(selectedMessage.source, 14)}
              </Box>
            )}

            {/* Title and Subtitle */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: theme.palette.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedMessage?.title || 'Message Details'}
              </Typography>
              {selectedMessage && (
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: theme.palette.text.secondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedMessage.sender} {selectedMessage.timestamp && `• ${new Date(selectedMessage.timestamp).toLocaleDateString()}`}
                </Typography>
              )}
            </Box>

            {/* Close Button */}
            <IconButton
              onClick={onClose}
              size="small"
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

          {/* Tabs */}
          <Box
            sx={{
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            }}
          >
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                minHeight: 40,
                px: 1,
                '& .MuiTabs-indicator': {
                  height: 2,
                  borderRadius: '2px 2px 0 0',
                },
              }}
            >
              <Tab
                value="insights"
                icon={<InsightsIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label="Key Insights"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  minHeight: 40,
                  py: 0.5,
                  px: 1.5,
                  minWidth: 'auto',
                  gap: 0.5,
                }}
              />
              <Tab
                value="transcript"
                icon={<TranscriptIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={getTranscriptLabel()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  minHeight: 40,
                  py: 0.5,
                  px: 1.5,
                  minWidth: 'auto',
                  gap: 0.5,
                }}
              />
            </Tabs>
          </Box>

          {/* Content */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {/* Loading State */}
            {isLoading && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  py: 6,
                }}
              >
                <CircularProgress size={24} thickness={4} />
                <Typography variant="caption" color="text.secondary">
                  Loading...
                </Typography>
              </Box>
            )}

            {/* Error State */}
            {error && (
              <Box sx={{ p: 2 }}>
                <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                  {error}
                </Alert>
              </Box>
            )}

            {/* Tab Content */}
            {selectedMessage && !isLoading && !error && (
              <Box sx={{ p: 2 }}>
                {activeTab === 'insights' ? (
                  <AIInsightsTab />
                ) : (
                  <ContentTab message={selectedMessage} />
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }
);

PanelContent.displayName = 'PanelContent';

export function MessageDetailPanel(): JSX.Element | null {
  const theme = useTheme();
  const { isOpen, selectedMessage, isLoading, error, closePanel } =
    useMessageDetailsStore();

  const handleClose = () => {
    closePanel();
  };

  const sourceColor = selectedMessage
    ? getSourceColor(selectedMessage.source, theme)
    : theme.palette.primary.main;

  return (
    <Slide direction="left" in={isOpen} mountOnEnter unmountOnExit timeout={250}>
      <PanelContent
        selectedMessage={selectedMessage}
        isLoading={isLoading}
        error={error}
        sourceColor={sourceColor}
        onClose={handleClose}
      />
    </Slide>
  );
}

export default MessageDetailPanel;
