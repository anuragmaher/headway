import React from 'react';
import {
  Box,
  useTheme,
  alpha,
} from '@mui/material';
import { ResizableState } from '../../types';

interface ResizablePanelsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  resizableState: ResizableState;
  onStartResize: () => void;
  children: {
    left: React.ReactNode;
    middle: React.ReactNode;
    right: React.ReactNode;
  };
}

export const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  containerRef,
  resizableState,
  onStartResize,
  children,
}) => {
  const theme = useTheme();
  const { featuresWidth, mentionsListWidth } = resizableState;
  
  // Calculate remaining width for details panel
  const detailsWidth = 100 - featuresWidth - mentionsListWidth;

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        height: 'calc(100vh - 200px)',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Features Panel */}
      <Box
        sx={{
          width: `${featuresWidth}%`,
          overflow: 'hidden',
          borderRight: `1px solid ${theme.palette.divider}`,
        }}
      >
        {children.left}
      </Box>

      {/* Resize Handle 1 */}
      <Box
        sx={{
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: theme.palette.divider,
          position: 'relative',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.5),
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px',
            height: '20px',
            backgroundColor: theme.palette.text.secondary,
            borderRadius: '1px',
          },
        }}
        onMouseDown={onStartResize}
      />

      {/* Mentions List Panel */}
      <Box
        sx={{
          width: `${mentionsListWidth}%`,
          overflow: 'hidden',
          borderRight: `1px solid ${theme.palette.divider}`,
        }}
      >
        {children.middle}
      </Box>

      {/* Details Panel */}
      <Box
        sx={{
          width: `${detailsWidth}%`,
          overflow: 'hidden',
        }}
      >
        {children.right}
      </Box>
    </Box>
  );
};









