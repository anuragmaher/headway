/**
 * Customer Chat Component
 *
 * Natural language chat interface for querying customer insights
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
  Alert,
  useTheme,
  alpha,
  Button,
  Collapse,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { customersApi, CustomerChatResponse, TemplateOption } from '@/services/customers-api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  method?: string;
  confidence?: number;
  suggestedTemplates?: TemplateOption[];
}

interface CustomerChatProps {
  customerId: string;
  workspaceId: string;
}

const EXAMPLE_QUERIES = [
  "What features do they want?",
  "Show me their urgent requests",
  "What's their ARR?",
  "What are their pain points?",
  "Show recent messages from this customer",
  "How many feature requests do they have?",
];

export function CustomerChat({ customerId, workspaceId }: CustomerChatProps): JSX.Element {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (query?: string) => {
    const messageText = query || inputValue.trim();
    if (!messageText || isLoading) return;

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

    try {
      // Call chat API
      const response: CustomerChatResponse = await customersApi.chat(
        workspaceId,
        customerId,
        messageText
      );

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        timestamp: new Date(),
        method: response.method,
        confidence: response.confidence,
        suggestedTemplates: response.suggested_templates,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);

      // Add error message
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

  const handleTemplateSuggestionClick = (templateId: string, templateName: string) => {
    handleSendMessage(templateName);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const getMethodBadge = (method?: string) => {
    if (!method) return null;

    const badges = {
      template: { label: 'Template', color: 'success' as const },
      sql: { label: 'Custom Query', color: 'info' as const },
      suggestion: { label: 'Suggestion', color: 'warning' as const },
    };

    const badge = badges[method as keyof typeof badges];
    if (!badge) return null;

    return (
      <Chip
        label={badge.label}
        size="small"
        color={badge.color}
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 20 }}
      />
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <BotIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Ask About This Customer
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ask questions in natural language about their requests, pain points, and metrics
        </Typography>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && showExamples && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LightbulbIcon sx={{ mr: 1, color: 'warning.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Try asking:
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
              <Stack spacing={1}>
                {EXAMPLE_QUERIES.map((example, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    size="small"
                    onClick={() => handleExampleClick(example)}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: 'text.secondary',
                      borderColor: alpha(theme.palette.divider, 0.3),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    {example}
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
              gap: 1.5,
              alignItems: 'flex-start',
            }}
          >
            {/* Avatar */}
            <Box
              sx={{
                width: 32,
                height: 32,
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
                <PersonIcon sx={{ fontSize: 18 }} />
              ) : (
                <BotIcon sx={{ fontSize: 18 }} />
              )}
            </Box>

            {/* Message Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {message.type === 'user' ? 'You' : 'AI Assistant'}
                </Typography>
                {message.method && getMethodBadge(message.method)}
                {message.confidence !== undefined && message.confidence < 0.8 && (
                  <Chip
                    label={`${Math.round(message.confidence * 100)}% confident`}
                    size="small"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
              </Box>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor:
                    message.type === 'user'
                      ? alpha(theme.palette.primary.main, 0.05)
                      : alpha(theme.palette.background.paper, 0.8),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.content}
                </Typography>

                {/* Template Suggestions */}
                {message.suggestedTemplates && message.suggestedTemplates.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                      Suggested queries:
                    </Typography>
                    <Stack spacing={1}>
                      {message.suggestedTemplates.map((template) => (
                        <Button
                          key={template.template_id}
                          variant="outlined"
                          size="small"
                          onClick={() => handleTemplateSuggestionClick(template.template_id, template.name)}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            textAlign: 'left',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {template.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {template.description}
                            </Typography>
                          </Box>
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Paper>

              <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: 'secondary.main',
              }}
            >
              <BotIcon sx={{ fontSize: 18 }} />
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask a question about this customer..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            multiline
            maxRows={3}
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
    </Box>
  );
}
