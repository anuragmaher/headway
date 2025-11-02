/**
 * Customers Chat Page
 *
 * Full-page natural language chat interface for querying customer insights
 * across all customers in the workspace.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  useTheme,
  alpha,
  Button,
  Collapse,
  Container,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import { customersApi } from '@/services/customers-api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { API_BASE_URL } from '@/config/api.config';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  method?: string;
  confidence?: number;
}

interface QueryTheme {
  name: string;
  icon: React.ReactNode;
  queries: string[];
  color: string;
}

const QUERY_THEMES: QueryTheme[] = [
  {
    name: 'All Queries',
    icon: <CategoryIcon />,
    color: 'primary',
    queries: [
      "Which customers have the most urgent feature requests?",
      "Show me customers in the Healthcare industry",
      "What are the top pain points across all customers?",
      "Which customers have the most messages?",
      "Show me recent activity from customers",
      "What features are most requested?",
    ],
  },
  {
    name: 'Customer Activity',
    icon: <TrendingUpIcon />,
    color: 'success',
    queries: [
      "Which customers have the most messages?",
      "Show me customers with recent activity",
      "Which customers are in different deal stages?",
      "Show me customers by industry",
      "Which customers have the most feature requests?",
    ],
  },
  {
    name: 'Industry & Segments',
    icon: <BusinessIcon />,
    color: 'info',
    queries: [
      "Show me customers in the Healthcare industry",
      "Which industries have the most customers?",
      "Show me enterprise customers",
      "What's the distribution by company size?",
      "Show me customers by deal stage",
    ],
  },
  {
    name: 'Feature Requests',
    icon: <LightbulbIcon />,
    color: 'warning',
    queries: [
      "Which customers have the most urgent feature requests?",
      "What features are most requested?",
      "Show me recent feature requests",
      "Which themes have the most requests?",
      "Show me feature requests by customer",
    ],
  },
  {
    name: 'Pain Points',
    icon: <BugReportIcon />,
    color: 'error',
    queries: [
      "What are the top pain points across all customers?",
      "Show me critical pain points",
      "Which customers have the most pain points?",
      "What are common blockers?",
      "Show me unresolved issues",
    ],
  },
];

// Markdown renderer component
const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const theme = useTheme();

  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <List key={`list-${elements.length}`} dense sx={{ my: 1 }}>
            {listItems.map((item, idx) => (
              <ListItem key={idx} sx={{ py: 0.5 }}>
                <ListItemText
                  primary={item}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: { color: 'text.primary' }
                  }}
                />
              </ListItem>
            ))}
          </List>
        );
        listItems = [];
      }
    };

    const flushCodeBlock = () => {
      if (codeLines.length > 0) {
        elements.push(
          <Box
            key={`code-${elements.length}`}
            sx={{
              bgcolor: alpha(theme.palette.background.default, 0.5),
              p: 2,
              borderRadius: 1,
              my: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflowX: 'auto',
            }}
          >
            {codeLines.join('\n')}
          </Box>
        );
        codeLines = [];
      }
    };

    lines.forEach((line, idx) => {
      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Handle bullet points
      if (line.trim().match(/^[-•*]\s/)) {
        const text = line.trim().substring(2);
        listItems.push(text);
        return;
      }

      // Flush any pending list
      flushList();

      // Handle headers
      if (line.startsWith('### ')) {
        elements.push(
          <Typography key={idx} variant="h6" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
            {line.substring(4)}
          </Typography>
        );
        return;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <Typography key={idx} variant="h5" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
            {line.substring(3)}
          </Typography>
        );
        return;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <Typography key={idx} variant="h4" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
            {line.substring(2)}
          </Typography>
        );
        return;
      }

      // Handle bold and italic text
      const renderInlineFormatting = (text: string) => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let keyCounter = 0;

        while (remaining.length > 0) {
          // Bold (**text**)
          const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
          if (boldMatch && boldMatch.index !== undefined) {
            if (boldMatch.index > 0) {
              parts.push(remaining.substring(0, boldMatch.index));
            }
            parts.push(
              <strong key={`bold-${keyCounter++}`}>{boldMatch[1]}</strong>
            );
            remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
            continue;
          }

          // Italic (*text*)
          const italicMatch = remaining.match(/\*(.+?)\*/);
          if (italicMatch && italicMatch.index !== undefined) {
            if (italicMatch.index > 0) {
              parts.push(remaining.substring(0, italicMatch.index));
            }
            parts.push(
              <em key={`italic-${keyCounter++}`}>{italicMatch[1]}</em>
            );
            remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
            continue;
          }

          parts.push(remaining);
          break;
        }

        return parts;
      };

      // Regular paragraph
      if (line.trim()) {
        elements.push(
          <Typography key={idx} variant="body1" sx={{ my: 0.5, lineHeight: 1.7 }}>
            {renderInlineFormatting(line)}
          </Typography>
        );
      } else if (elements.length > 0) {
        // Empty line for spacing
        elements.push(<Box key={`space-${idx}`} sx={{ height: 8 }} />);
      }
    });

    // Flush any remaining list or code block
    flushList();
    flushCodeBlock();

    return elements;
  };

  return <Box>{renderContent()}</Box>;
};

export default function CustomersChatPage(): JSX.Element {
  const theme = useTheme();
  const { tokens, isAuthenticated } = useAuthStore();
  const workspaceId = tokens?.workspace_id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<number>(0); // Index of selected theme
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [fetchingWorkspaceId, setFetchingWorkspaceId] = useState(false);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

  const currentTheme = QUERY_THEMES[selectedTheme];

  // Hydration: Check if store is ready
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Recovery: If authenticated but workspace_id is missing, fetch it once
  useEffect(() => {
    if (!hydrated || !isAuthenticated || workspaceId || fetchingWorkspaceId || attemptedFetch) {
      return;
    }

    setAttemptedFetch(true);
    setFetchingWorkspaceId(true);

    fetch(`${API_BASE_URL}/api/v1/workspaces/my-workspace`, {
      headers: {
        'Authorization': `Bearer ${tokens?.access_token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.workspace_id) {
          useAuthStore.setState({
            tokens: { ...tokens!, workspace_id: data.workspace_id }
          });
        }
      })
      .catch(error => {
        console.error('Failed to fetch workspace:', error);
      })
      .finally(() => {
        setFetchingWorkspaceId(false);
      });
  }, [hydrated, isAuthenticated, workspaceId, tokens, fetchingWorkspaceId, attemptedFetch]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (query?: string) => {
    const messageText = query || inputValue.trim();
    if (!messageText || isLoading || !workspaceId) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowExamples(false);

    // Call workspace chat API
    try {
      const response = await customersApi.workspaceChat(workspaceId, messageText);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        timestamp: new Date(),
        method: response.method,
        confidence: response.confidence,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I encountered an error: ${err.message || 'Something went wrong'}. Please try again.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    handleSendMessage(example);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // Show loading if workspace isn't loaded yet
  if (!workspaceId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 100px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      height: { xs: 'auto', md: 'calc(100vh - 100px)' },
      minHeight: { xs: 'calc(100vh - 100px)', md: 'auto' },
      gap: 2,
      p: { xs: 1, sm: 2, md: 3 }
    }}>
      {/* Main Chat Area */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden',
          minHeight: { xs: '70vh', md: 'auto' },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <BotIcon sx={{ mr: { xs: 1, sm: 1.5 }, color: 'primary.main', fontSize: { xs: 24, sm: 32 } }} />
            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              Customer Insights Chat
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '0.875rem', sm: '1rem' }, display: { xs: 'none', sm: 'block' } }}>
            Ask questions about your customers, their requests, pain points, and metrics in natural language
          </Typography>
        </Box>

        {/* Messages Area */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: { xs: 2, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, sm: 3 },
          }}
        >
          {messages.length === 0 && showExamples && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {currentTheme.icon}
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', ml: 1 }}>
                  Try asking ({currentTheme.name}):
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowExamples(!showExamples)}
                  sx={{ ml: 'auto' }}
                >
                  {showExamples ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={showExamples}>
                <Stack spacing={1.5}>
                  {currentTheme.queries.map((example, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="large"
                      onClick={() => handleExampleClick(example)}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: 'text.primary',
                        borderColor: alpha(theme.palette.divider, 0.3),
                        p: 2,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <Typography variant="body1">{example}</Typography>
                    </Button>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}

          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
              }}
            >
              {/* Avatar */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor:
                    message.type === 'user'
                      ? alpha(theme.palette.primary.main, 0.1)
                      : alpha(theme.palette.secondary.main, 0.1),
                  color:
                    message.type === 'user'
                      ? 'primary.main'
                      : 'secondary.main',
                  flexShrink: 0,
                }}
              >
                {message.type === 'user' ? (
                  <PersonIcon sx={{ fontSize: 22 }} />
                ) : (
                  <BotIcon sx={{ fontSize: 22 }} />
                )}
              </Box>

              {/* Message Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {message.type === 'user' ? 'You' : 'AI Assistant'}
                  </Typography>
                  {message.method && (
                    <Chip
                      label={message.method}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  )}
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.5, sm: 2.5 },
                    bgcolor:
                      message.type === 'user'
                        ? alpha(theme.palette.primary.main, 0.05)
                        : alpha(theme.palette.background.paper, 0.8),
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <Box sx={{ color: 'text.primary' }}>
                    <MarkdownText content={message.content} />
                  </Box>
                </Paper>

                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Box>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                  color: 'secondary.main',
                }}
              >
                <BotIcon sx={{ fontSize: 22 }} />
              </Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  bgcolor: alpha(theme.palette.background.paper, 0.8),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Thinking...
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              placeholder="Ask a question about your customers..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              multiline
              maxRows={4}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.default',
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  bgcolor: alpha(theme.palette.primary.main, 0.3),
                  color: 'white',
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Right Panel - Examples & Quick Actions */}
      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', md: 320 },
          flexShrink: 0,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          p: { xs: 2, md: 3 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Theme Selector */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}>
            Query Categories
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {QUERY_THEMES.map((queryTheme, index) => (
              <Chip
                key={index}
                icon={queryTheme.icon as any}
                label={queryTheme.name}
                onClick={() => setSelectedTheme(index)}
                color={selectedTheme === index ? (queryTheme.color as any) : 'default'}
                variant={selectedTheme === index ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        <Divider />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {currentTheme.icon}
            <Typography variant="h6" sx={{ fontWeight: 600, ml: 1 }}>
              {currentTheme.name}
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            {currentTheme.queries.map((example, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                onClick={() => handleExampleClick(example)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  textAlign: 'left',
                  color: 'text.secondary',
                  borderColor: alpha(theme.palette.divider, 0.3),
                  p: 1.5,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Typography variant="body2">{example}</Typography>
              </Button>
            ))}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
            Quick Tips
          </Typography>
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              • Ask about customer activity and messages
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              • Filter by industry or deal stage
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              • Find urgent feature requests
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              • Analyze pain points across customers
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
