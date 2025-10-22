/**
 * Resizable panel component with drag-to-resize functionality
 */

import React, { ReactNode } from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { useResizablePanel } from '@/shared/hooks/useResizablePanel';

interface ResizablePanelProps {
  children: ReactNode;
  storageKey: string;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onResize?: (width: number) => void;
}

export function ResizablePanel({
  children,
  storageKey,
  minWidth = 200,
  maxWidth = 600,
  defaultWidth = 400,
  onResize,
}: ResizablePanelProps): JSX.Element {
  const theme = useTheme();
  const { width, containerRef, isResizing, handleMouseDown } = useResizablePanel({
    storageKey,
    minWidth,
    maxWidth,
    defaultWidth,
  });

  React.useEffect(() => {
    onResize?.(width);
  }, [width, onResize]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: `${width}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {children}

      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: isResizing ? 'col-resize' : 'col-resize',
          userSelect: 'none',
          backgroundColor: isResizing
            ? theme.palette.primary.main
            : alpha(theme.palette.divider, 0.5),
          transition: isResizing ? 'none' : 'background-color 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            right: -2,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
          },
        }}
      />
    </Box>
  );
}
