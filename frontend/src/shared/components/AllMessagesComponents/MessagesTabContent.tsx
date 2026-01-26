/**
 * MessagesTabContent - Content area for the Messages tab
 */

import { Box, Typography, CircularProgress, Pagination, Paper, alpha, useTheme, useMediaQuery } from '@mui/material';
import { MessageList } from './MessageList';
import { MessageDetailPanel } from './MessageDetailPanel';
import { Message } from '@/shared/types/AllMessagesTypes';

interface MessagesTabContentProps {
  messages: Message[];
  loading: boolean;
  fetching: boolean;
  totalPages: number;
  currentPage: number;
  onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
  onMessageClick: (messageId: string) => void;
  isDetailOpen: boolean;
}

export function MessagesTabContent({
  messages,
  loading,
  fetching,
  totalPages,
  currentPage,
  onPageChange,
  onMessageClick,
  isDetailOpen,
}: MessagesTabContentProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        bgcolor: theme.palette.background.default,
        position: 'relative',
      }}
    >
      {/* Left Panel - Message List */}
      <Box
        sx={{
          width: isMobile || !isDetailOpen ? '100%' : '50%',
          overflow: 'hidden',
          minWidth: 0,
          pl: { xs: 1.5, sm: 2.5 },
          pr: isMobile || !isDetailOpen ? { xs: 1.5, sm: 2.5 } : 0,
          py: 1.5,
          transition: 'width 0.25s ease-out, padding-right 0.25s ease-out',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: theme.palette.background.paper,
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading && messages.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading messages...
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                position: 'relative',
                flex: 1,
                overflow: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {/* Fetching indicator */}
              {fetching && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    bgcolor: 'primary.main',
                    opacity: 0.6,
                    zIndex: 1,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.3 },
                      '50%': { opacity: 0.7 },
                    },
                  }}
                />
              )}
              <MessageList messages={messages} onMessageClick={onMessageClick} />
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 1.5,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
              }}
            >
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={onPageChange}
                size="small"
                color="primary"
              />
            </Box>
          )}
        </Paper>
      </Box>

      {/* Right Panel - Message Detail */}
      <MessageDetailPanel />
    </Box>
  );
}

export default MessagesTabContent;
