/**
 * Loading component with theme support
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

export function Loading({ 
  message = 'Loading...', 
  size = 40,
  fullScreen = false 
}: LoadingProps): JSX.Element {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        ...(fullScreen && {
          minHeight: '100vh',
          bgcolor: 'background.default',
        }),
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  return content;
}

/**
 * Loading skeleton for better UX
 */
import { Skeleton } from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  count?: number;
}

export function LoadingSkeleton({
  variant = 'text',
  width = '100%',
  height,
  count = 1,
}: LoadingSkeletonProps): JSX.Element {
  const skeletons = Array.from({ length: count }, (_, index) => (
    <Skeleton
      key={index}
      variant={variant}
      width={width}
      height={height}
      sx={{ mb: count > 1 ? 1 : 0 }}
    />
  ));

  return <>{skeletons}</>;
}