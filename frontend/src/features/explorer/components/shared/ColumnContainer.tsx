/**
 * ColumnContainer - Shared wrapper component for explorer columns
 * Provides consistent styling and structure for the three-column layout
 */
import React from 'react';
import { Box, Typography, Skeleton, SxProps, Theme } from '@mui/material';

interface ColumnContainerProps {
  title?: string;
  subtitle?: string;
  width: number | string;
  minWidth?: number;
  maxWidth?: number;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const ColumnContainer: React.FC<ColumnContainerProps> = ({
  title,
  subtitle,
  width,
  minWidth = 180,
  maxWidth,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No items',
  headerAction,
  children,
  sx,
}) => {
  return (
    <Box
      sx={{
        width,
        minWidth,
        maxWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        ...sx,
      }}
    >
      {/* Header */}
      {(title || headerAction) && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 52,
            flexShrink: 0,
          }}
        >
          <Box>
            {title && (
              <Typography
                variant="overline"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  color: 'text.secondary',
                  lineHeight: 1.5,
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.disabled',
                  mt: 0.25,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {headerAction}
        </Box>
      )}

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'action.hover',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            bgcolor: 'action.selected',
          },
        }}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <EmptyState message={emptyMessage} />
        ) : (
          children
        )}
      </Box>
    </Box>
  );
};

const LoadingSkeleton: React.FC = () => (
  <Box sx={{ p: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Box key={i} sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={72} sx={{ borderRadius: 1.5 }} />
      </Box>
    ))}
  </Box>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      p: 3,
    }}
  >
    <Typography
      variant="body2"
      sx={{
        color: 'text.disabled',
        textAlign: 'center',
      }}
    >
      {message}
    </Typography>
  </Box>
);

export default ColumnContainer;
