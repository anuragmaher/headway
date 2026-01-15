/**
 * MentionsDrawer - Drawer showing mentions for a feature
 */

import React from 'react';
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  Chip,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  FeaturedPlayList as FeatureIcon,
  BugReport as BugReportIcon,
  SentimentDissatisfied as SadIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { Message } from '../types';
import { useThemesPageStore } from '../store';
import { formatDate } from '../utils';
import { MentionsLoadingSkeleton } from './ThemesLoadingSkeleton';
import { MentionDetails } from './MentionDetails';

export const MentionsDrawer: React.FC = () => {
  const theme = useTheme();
  const {
    mentionsDrawerOpen,
    selectedFeatureForMessages,
    featureMessages,
    loadingMessages,
    selectedMessageId,
    drawerLevel,
    filters,
    setMentionsDrawerOpen,
    setSelectedFeatureForMessages,
    setSelectedMessageId,
    setDrawerLevel,
    openDeleteMentionConfirm,
    fetchFeatureMessages,
  } = useThemesPageStore();

  const handleBackFromMessages = () => {
    setMentionsDrawerOpen(false);
    setSelectedFeatureForMessages(null);
    setDrawerLevel('mentions');
  };

  const handleViewMentionDetails = (message: Message) => {
    setSelectedMessageId(message.id);
    setDrawerLevel('details');
  };

  const handleBackFromMentionDetails = () => {
    setDrawerLevel('mentions');
    setSelectedMessageId(null);
  };

  // Filter messages by search query
  const filteredMessages = featureMessages.filter((message) => {
    if (!filters.searchQuery.trim()) return true;
    const query = filters.searchQuery.toLowerCase();
    const customerName = (message.customer_name || message.sender_name || '').toLowerCase();
    const customerEmail = (message.customer_email || '').toLowerCase();
    return customerName.includes(query) || customerEmail.includes(query);
  });

  return (
    <Drawer
      anchor="right"
      open={mentionsDrawerOpen && !!selectedFeatureForMessages}
      onClose={handleBackFromMessages}
      elevation={0}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: alpha(theme.palette.common.black, 0.2),
            backdropFilter: 'blur(2px)'
          }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '450px', md: '480px' },
          backgroundColor: theme.palette.background.paper,
          boxShadow: `-8px 0 32px ${alpha(theme.palette.common.black, 0.1)}`,
          zIndex: 1200,
          mt: { xs: 7, sm: 8, md: 8 },
          height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)', md: 'calc(100vh - 64px)' },
          borderRadius: '16px 0 0 16px',
        }
      }}
    >
      {drawerLevel === 'mentions' && selectedFeatureForMessages && (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Mentions List Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 2.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`
          }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, fontSize: '1.1rem' }}>
                {selectedFeatureForMessages.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredMessages.length} mention{filteredMessages.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <IconButton
              onClick={handleBackFromMessages}
              size="small"
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main
                }
              }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Mentions List Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            {loadingMessages ? (
              <MentionsLoadingSkeleton />
            ) : featureMessages.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                py: 8,
                textAlign: 'center',
              }}>
                <Box sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.text.secondary, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}>
                  <FeatureIcon sx={{ fontSize: 32, color: alpha(theme.palette.text.secondary, 0.4) }} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  No Mentions Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This feature hasn't been mentioned in any feedback.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filteredMessages.map((message) => (
                  <MentionItem
                    key={message.id}
                    message={message}
                    isSelected={selectedMessageId === message.id}
                    onClick={() => handleViewMentionDetails(message)}
                    onDelete={() => openDeleteMentionConfirm(message)}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Message Details View */}
      {drawerLevel === 'details' && selectedFeatureForMessages && selectedMessageId && (
        <MentionDetails
          message={featureMessages.find(m => m.id === selectedMessageId)!}
          onBack={handleBackFromMentionDetails}
          onClose={handleBackFromMessages}
        />
      )}
    </Drawer>
  );
};

interface MentionItemProps {
  message: Message;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const MentionItem: React.FC<MentionItemProps> = ({ message, isSelected, onClick, onDelete }) => {
  const theme = useTheme();
  
  const insightCounts = {
    features: message.ai_insights?.feature_requests?.length || 0,
    bugs: message.ai_insights?.bug_reports?.length || 0,
    painPoints: message.ai_insights?.pain_points?.length || 0,
  };
  const totalInsights = insightCounts.features + insightCounts.bugs + insightCounts.painPoints;

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5,
        borderRadius: 1.25,
        cursor: 'pointer',
        background: isSelected
          ? alpha(theme.palette.primary.main, 0.12)
          : alpha(theme.palette.background.default, 0.4),
        border: `2px solid ${isSelected
          ? theme.palette.primary.main
          : alpha(theme.palette.divider, 0.25)}`,
        boxShadow: isSelected
          ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}`
          : `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        '&:hover': {
          background: isSelected
            ? alpha(theme.palette.primary.main, 0.12)
            : alpha(theme.palette.background.default, 0.6),
          border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.12)}`,
          '& .delete-button': {
            opacity: 1,
          },
        },
      }}
    >
      {message.title && (
        <Typography variant="caption" sx={{ fontSize: '0.85rem', fontWeight: '600', color: theme.palette.primary.main, display: 'block', mb: 0.75, lineHeight: 1.3 }}>
          {message.title}
        </Typography>
      )}
      <Typography variant="caption" fontWeight="700" sx={{ fontSize: '0.95rem', color: theme.palette.text.primary }} noWrap display="block">
        {message.customer_name || message.sender_name || 'Unknown'}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, mt: 0.5 }} noWrap display="block">
        {message.customer_email || message.sender_name}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, mt: 0.5, opacity: 0.7 }} noWrap display="block">
        {formatDate(message.sent_at)}
      </Typography>
      
      {totalInsights > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          {insightCounts.features > 0 && (
            <Chip
              label={`${insightCounts.features} features`}
              size="small"
              color="info"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: '600',
                borderColor: alpha(theme.palette.info.main, 0.4),
                backgroundColor: alpha(theme.palette.info.main, 0.08),
                color: theme.palette.info.dark,
              }}
            />
          )}
          {insightCounts.bugs > 0 && (
            <Chip
              label={`${insightCounts.bugs} bugs`}
              size="small"
              color="error"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: '600',
                borderColor: alpha(theme.palette.error.main, 0.4),
                backgroundColor: alpha(theme.palette.error.main, 0.08),
                color: theme.palette.error.dark,
              }}
            />
          )}
          {insightCounts.painPoints > 0 && (
            <Chip
              label={`${insightCounts.painPoints} pain points`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: '600',
                borderColor: alpha(theme.palette.warning.main, 0.4),
                backgroundColor: alpha(theme.palette.warning.main, 0.08),
                color: theme.palette.warning.dark,
              }}
            />
          )}
        </Box>
      )}

      {/* Detailed Highlights */}
      {message.ai_insights && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          {/* Feature Requests */}
          {message.ai_insights.feature_requests && message.ai_insights.feature_requests.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <FeatureIcon sx={{ fontSize: 12, color: 'success.main' }} />
                <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.success.main }}>
                  Feature Requests
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {message.ai_insights.feature_requests.slice(0, 2).map((feature, idx) => (
                  <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: '600', color: theme.palette.text.primary }}>
                      • {feature.title}
                    </Typography>
                    {feature.description && (
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, ml: 1, opacity: 0.8 }}>
                        {feature.description.length > 80 ? `${feature.description.substring(0, 80)}...` : feature.description}
                      </Typography>
                    )}
                  </Box>
                ))}
                {message.ai_insights.feature_requests.length > 2 && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.success.main, ml: 1 }}>
                    +{message.ai_insights.feature_requests.length - 2} more features
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Bug Reports */}
          {message.ai_insights.bug_reports && message.ai_insights.bug_reports.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <BugReportIcon sx={{ fontSize: 12, color: 'error.main' }} />
                <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.error.main }}>
                  Issues Reported
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {message.ai_insights.bug_reports.slice(0, 2).map((bug, idx) => (
                  <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: '600', color: theme.palette.text.primary }}>
                      • {bug.title}
                    </Typography>
                    {bug.description && (
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, ml: 1, opacity: 0.8 }}>
                        {bug.description.length > 80 ? `${bug.description.substring(0, 80)}...` : bug.description}
                      </Typography>
                    )}
                  </Box>
                ))}
                {message.ai_insights.bug_reports.length > 2 && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.error.main, ml: 1 }}>
                    +{message.ai_insights.bug_reports.length - 2} more issues
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Pain Points */}
          {message.ai_insights.pain_points && message.ai_insights.pain_points.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <SadIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.warning.main }}>
                  Pain Points
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {message.ai_insights.pain_points.slice(0, 2).map((pain, idx) => (
                  <Typography key={idx} variant="caption" sx={{ fontSize: '0.7rem', color: theme.palette.text.primary }}>
                    • {pain.description.length > 100 ? `${pain.description.substring(0, 100)}...` : pain.description}
                  </Typography>
                ))}
                {message.ai_insights.pain_points.length > 2 && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.warning.main, ml: 1 }}>
                    +{message.ai_insights.pain_points.length - 2} more pain points
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Summary */}
          {message.ai_insights.summary && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" fontWeight="600" sx={{ fontSize: '0.7rem', color: theme.palette.primary.main, mb: 0.5, display: 'block' }}>
                Summary
              </Typography>
              <Typography variant="caption" sx={{ 
                fontSize: '0.65rem', 
                color: theme.palette.text.secondary, 
                fontStyle: 'italic',
                display: 'block',
                lineHeight: 1.3
              }}>
                {message.ai_insights.summary.length > 150 ? `${message.ai_insights.summary.substring(0, 150)}...` : message.ai_insights.summary}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      
      <IconButton
        className="delete-button"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: 0,
          transition: 'opacity 0.2s ease-in-out',
          color: theme.palette.error.main,
          bgcolor: alpha(theme.palette.error.main, 0.08),
          '&:hover': {
            bgcolor: alpha(theme.palette.error.main, 0.15),
          },
        }}
      >
        <DeleteIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};
