/**
 * MentionsBottomPanel - Desktop bottom panel for mentions view
 * Slides up from bottom and occupies available space
 */
import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Paper,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { MentionsPanel } from './MentionsPanel';

interface MentionsBottomPanelProps {
  open: boolean;
  onClose: () => void;
  height?: string;
}

export const MentionsBottomPanel: React.FC<MentionsBottomPanelProps> = ({
  open,
  onClose,
  height = '50vh',
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: open ? height : 0,
        transition: 'height 0.3s ease-in-out',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <Paper
        sx={{
          height: '100%',
          width: '100%',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08), 0 -2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          borderBottom: 'none',
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Resize Handle */}
          <Box
            sx={{
              height: 2,
              backgroundColor: alpha(theme.palette.text.secondary, 0.1),
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'row-resize',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 1,
                backgroundColor: alpha(theme.palette.text.secondary, 0.4),
                borderRadius: 0.5,
              }}
            />
          </Box>

          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              borderRadius: '8px 8px 0 0',
              minHeight: 48,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              Customer Feedback & Mentions
            </Typography>
            
            <IconButton 
              onClick={onClose}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: alpha(theme.palette.action.hover, 0.08),
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <MentionsPanel isMobileFullScreen />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};