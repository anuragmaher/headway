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
  Tooltip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { MentionsPanel } from './MentionsPanel';

interface MentionsBottomPanelProps {
  open: boolean;
  onClose: () => void;
  height?: string;
  onHeightChange?: (newHeight: number) => void;
}

export const MentionsBottomPanel: React.FC<MentionsBottomPanelProps> = ({
  open,
  onClose,
  height = '50vh',
  onHeightChange,
}) => {
  const theme = useTheme();
  const [isResizing, setIsResizing] = React.useState(false);
  const [currentHeight, setCurrentHeight] = React.useState<number>(50); // percentage

  // Convert height prop to percentage if needed
  React.useEffect(() => {
    if (typeof height === 'string' && height.endsWith('%')) {
      setCurrentHeight(parseInt(height));
    } else if (typeof height === 'string' && height.endsWith('vh')) {
      setCurrentHeight(parseInt(height));
    }
  }, [height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    if (!isResizing) return;

    // Add cursor style to body during resize
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const windowHeight = window.innerHeight;
      const distanceFromBottom = windowHeight - e.clientY;
      const newHeightPercent = Math.min(Math.max((distanceFromBottom / windowHeight) * 100, 20), 80);
      
      setCurrentHeight(newHeightPercent);
      if (onHeightChange) {
        onHeightChange(newHeightPercent);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Reset cursor styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Cleanup cursor styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onHeightChange]);

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: open ? `${currentHeight}%` : 0,
        transition: isResizing ? 'none' : 'height 0.3s ease-in-out',
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
          boxShadow: isResizing 
            ? '0 -8px 32px rgba(0,0,0,0.12), 0 -4px 12px rgba(0,0,0,0.08)'
            : '0 -4px 20px rgba(0,0,0,0.08), 0 -2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${alpha(isResizing ? theme.palette.primary.main : theme.palette.divider, 0.12)}`,
          borderBottom: 'none',
          bgcolor: theme.palette.background.paper,
          transition: isResizing ? 'none' : 'all 0.2s ease',
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Draggable Resize Handle */}
          <Tooltip title="Drag to resize" placement="top" arrow>
            <Box
            onMouseDown={handleMouseDown}
            sx={{
              height: 12,
              backgroundColor: alpha(theme.palette.text.secondary, isResizing ? 0.15 : 0.05),
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'ns-resize',
              userSelect: 'none',
              transition: isResizing ? 'none' : 'background-color 0.2s ease',
              position: 'relative',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                '& > div': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.6),
                  transform: 'scaleX(1.2)',
                },
              },
              '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
              },
              // Add subtle hover hint
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 2,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 1,
                height: 8,
                backgroundColor: alpha(theme.palette.text.secondary, 0.2),
                borderRadius: 0.5,
              },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 4,
                backgroundColor: alpha(theme.palette.text.secondary, isResizing ? 0.8 : 0.3),
                borderRadius: 2,
                transition: isResizing ? 'none' : 'all 0.2s ease',
                transform: isResizing ? 'scaleX(1.2)' : 'scaleX(1)',
              }}
            />
            </Box>
          </Tooltip>

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