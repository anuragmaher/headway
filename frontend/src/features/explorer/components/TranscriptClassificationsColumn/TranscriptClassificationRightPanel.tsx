/**
 * TranscriptClassificationRightPanel - Desktop right panel for transcript classification details
 * Slides in from right and occupies available space (vertical split)
 */
import React from 'react';
import {
  Box,
  useTheme,
  alpha,
  Paper,
  Tooltip,
} from '@mui/material';
import { TranscriptClassificationDetailPanel } from './TranscriptClassificationDetailPanel';

interface TranscriptClassificationRightPanelProps {
  open: boolean;
  onClose: () => void;
  width?: string;
  onWidthChange?: (newWidth: number) => void;
}

export const TranscriptClassificationRightPanel: React.FC<TranscriptClassificationRightPanelProps> = ({
  open,
  onClose,
  width = '50%',
  onWidthChange,
}) => {
  const theme = useTheme();
  const [isResizing, setIsResizing] = React.useState(false);
  const [currentWidth, setCurrentWidth] = React.useState<number>(50); // percentage
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Convert width prop to percentage if needed
  React.useEffect(() => {
    if (typeof width === 'string' && width.endsWith('%')) {
      setCurrentWidth(parseInt(width));
    }
  }, [width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    if (!isResizing) return;

    // Add cursor style to body during resize
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const distanceFromRight = containerRect.right - e.clientX;
      const newWidthPercent = Math.min(Math.max((distanceFromRight / containerWidth) * 100, 20), 80);
      setCurrentWidth(newWidthPercent);
      if (onWidthChange) {
        onWidthChange(newWidthPercent);
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
  }, [isResizing, onWidthChange]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: open ? `${currentWidth}%` : 0,
        transition: isResizing ? 'none' : 'width 0.3s ease-in-out',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          width: '100%',
          borderRadius: 0,
          overflow: 'hidden',
          borderLeft: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          transition: isResizing ? 'none' : 'all 0.2s ease',
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'row' }}>
          {/* Draggable Resize Handle - positioned at left */}
          <Tooltip title="Drag to resize" placement="left" arrow>
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                width: 8,
                height: '100%',
                backgroundColor: 'transparent',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'ew-resize',
                userSelect: 'none',
                position: 'relative',
                '&:hover': {
                  '& > div': {
                    backgroundColor: theme.palette.primary.main,
                    transform: 'scaleY(1.3)',
                  },
                },
                '&:active': {
                  '& > div': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
              }}
            >
              <Box
                sx={{
                  height: 48,
                  width: 4,
                  backgroundColor: isResizing 
                    ? theme.palette.primary.main 
                    : alpha(theme.palette.text.secondary, 0.3),
                  borderRadius: 2,
                  transition: isResizing ? 'none' : 'all 0.2s ease',
                  transform: isResizing ? 'scaleY(1.3)' : 'scale(1)',
                }}
              />
            </Box>
          </Tooltip>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TranscriptClassificationDetailPanel onClose={onClose} />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
