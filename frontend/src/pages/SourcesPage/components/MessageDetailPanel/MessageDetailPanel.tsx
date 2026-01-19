/**
 * MessageDetailPanel component - Split-screen message detail view
 *
 * Clean, seamless design with smooth slide-in animation from the right.
 */

import { forwardRef } from 'react';
import { Box, Typography, IconButton, alpha, useTheme, CircularProgress, Alert, Paper, Slide } from '@mui/material';
import {
  Close as CloseIcon,
  AutoAwesome as AIIcon,
  Description as ContentIcon,
  Email as EmailIcon,
  Videocam as GongIcon,
  Headphones as FathomIcon,
  Tag as SlackIcon,
} from '@mui/icons-material';
import { useMessageDetailsStore, MessageDetailTab } from '../../store';
import { AIInsightsTab } from './AIInsightsTab';
import { ContentTab } from './ContentTab';

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

/**
 * Get content tab label based on source
 */
const getContentTabLabel = (source: string): string => {
  switch (source) {
    case 'gmail':
    case 'outlook':
      return 'Email';
    case 'gong':
      return 'Call';
    case 'fathom':
      return 'Meeting';
    case 'slack':
      return 'Message';
    default:
      return 'Content';
  }
};

/**
 * Tab Button Component - Minimal pill-style tabs
 */
interface TabButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function TabButton({ active, icon, label, onClick }: TabButtonProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.75,
        cursor: 'pointer',
        borderRadius: 1,
        bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
        color: active ? theme.palette.primary.main : theme.palette.text.secondary,
        '&:hover': {
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.12)
            : alpha(theme.palette.action.hover, 0.06),
        },
      }}
    >
      {icon}
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Inner Panel Content - forwardRef needed for Slide transition
 */
interface PanelContentProps {
  selectedMessage: ReturnType<typeof useMessageDetailsStore>['selectedMessage'];
  activeTab: MessageDetailTab;
  isLoading: boolean;
  error: string | null;
  sourceColor: string;
  onClose: () => void;
  onTabChange: (tab: MessageDetailTab) => void;
}

const PanelContent = forwardRef<HTMLDivElement, PanelContentProps>(
  ({ selectedMessage, activeTab, isLoading, error, sourceColor, onClose, onTabChange }, ref) => {
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

            {/* Title - Truncated */}
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.primary,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedMessage?.title || 'Message Details'}
            </Typography>

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

          {/* Tab Buttons */}
          {selectedMessage && !isLoading && !error && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
              }}
            >
              <TabButton
                active={activeTab === 'ai-insights'}
                icon={<AIIcon sx={{ fontSize: 14 }} />}
                label="AI Insights"
                onClick={() => onTabChange('ai-insights')}
              />
              <TabButton
                active={activeTab === 'content'}
                icon={<ContentIcon sx={{ fontSize: 14 }} />}
                label={getContentTabLabel(selectedMessage.source)}
                onClick={() => onTabChange('content')}
              />
            </Box>
          )}

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
                {activeTab === 'ai-insights' && <AIInsightsTab message={selectedMessage} />}
                {activeTab === 'content' && <ContentTab message={selectedMessage} />}
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
  const { isOpen, selectedMessage, activeTab, isLoading, error, closePanel, setActiveTab } =
    useMessageDetailsStore();

  const handleTabChange = (tab: MessageDetailTab) => {
    setActiveTab(tab);
  };

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
        activeTab={activeTab}
        isLoading={isLoading}
        error={error}
        sourceColor={sourceColor}
        onClose={handleClose}
        onTabChange={handleTabChange}
      />
    </Slide>
  );
}

export default MessageDetailPanel;
