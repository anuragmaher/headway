/**
 * MentionsBottomPanel - Desktop bottom panel for mentions view
 * Slides up from bottom and occupies available space
 */
import React from 'react';
import {
  Box,
  useTheme,
  alpha,
  Paper,
  Tooltip,
} from '@mui/material';
import { MentionsPanel } from './MentionsPanel';

interface MentionsBottomPanelProps {
  open: boolean;
  onClose: () => void;
  height?: string;
  onHeightChange?: (newHeight: number) => void;
  orientation?: 'vertical' | 'horizontal';
}

export const MentionsBottomPanel: React.FC<MentionsBottomPanelProps> = ({
  open,
  onClose,
  height = '50vh',
  onHeightChange,
  orientation = 'vertical',
}) => {
  const theme = useTheme();
  const [isResizing, setIsResizing] = React.useState(false);
  const [currentHeight, setCurrentHeight] = React.useState<number>(50); // percentage
  const containerRef = React.useRef<HTMLDivElement>(null);

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
    const cursor = orientation === 'vertical' ? 'ns-resize' : 'ew-resize';
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      if (!containerRef.current) return;
      
      if (orientation === 'vertical') {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerHeight = containerRect.height;
        const distanceFromBottom = containerRect.bottom - e.clientY;
        const newHeightPercent = Math.min(Math.max((distanceFromBottom / containerHeight) * 100, 20), 80);
        setCurrentHeight(newHeightPercent);
        if (onHeightChange) {
          onHeightChange(newHeightPercent);
        }
      } else {
        // Horizontal orientation - resize based on width
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const distanceFromRight = containerRect.right - e.clientX;
        const newWidthPercent = Math.min(Math.max((distanceFromRight / containerWidth) * 100, 20), 80);
        setCurrentHeight(newWidthPercent);
        if (onHeightChange) {
          onHeightChange(newWidthPercent);
        }
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
  }, [isResizing, onHeightChange, orientation]);

  const isHorizontal = orientation === 'horizontal';

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        [isHorizontal ? 'right' : 'bottom']: 0,
        [isHorizontal ? 'top' : 'left']: 0,
        [isHorizontal ? 'bottom' : 'right']: 0,
        [isHorizontal ? 'width' : 'height']: open ? `${currentHeight}%` : 0,
        [isHorizontal ? 'height' : 'width']: '100%',
        transition: isResizing ? 'none' : `${isHorizontal ? 'width' : 'height'} 0.3s ease-in-out`,
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
          borderTop: isHorizontal ? 'none' : `1px solid ${theme.palette.divider}`,
          borderLeft: isHorizontal ? `1px solid ${theme.palette.divider}` : 'none',
          bgcolor: theme.palette.background.paper,
          transition: isResizing ? 'none' : 'all 0.2s ease',
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: isHorizontal ? 'row' : 'column' }}>
          {/* Draggable Resize Handle - positioned at left for horizontal, top for vertical */}
          {isHorizontal && (
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
          )}
          
          {!isHorizontal && (
            <Tooltip title="Drag to resize" placement="top" arrow>
              <Box
                onMouseDown={handleMouseDown}
                sx={{
                  height: 8,
                  width: '100%',
                  backgroundColor: 'transparent',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'ns-resize',
                  userSelect: 'none',
                  position: 'relative',
                  '&:hover': {
                    '& > div': {
                      backgroundColor: theme.palette.primary.main,
                      transform: 'scaleX(1.3)',
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
                    width: 48,
                    height: 4,
                    backgroundColor: isResizing 
                      ? theme.palette.primary.main 
                      : alpha(theme.palette.text.secondary, 0.3),
                    borderRadius: 2,
                    transition: isResizing ? 'none' : 'all 0.2s ease',
                    transform: isResizing ? 'scaleX(1.3)' : 'scale(1)',
                  }}
                />
              </Box>
            </Tooltip>
          )}

          {/* Content - MentionsPanel has its own header */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <MentionsPanel isMobileFullScreen />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};