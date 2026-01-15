/**
 * ThemesLoadingSkeleton - Loading skeleton for ThemesPage
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';

export const ThemesLoadingSkeleton: React.FC = () => {
  const theme = useTheme();

  return (
    <AdminLayout>
      <Box sx={{ 
        height: 'calc(100vh - 64px)', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Top Navigation Bar Skeleton */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          bgcolor: theme.palette.background.paper,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }}>
          <Skeleton variant="rounded" width={180} height={44} sx={{ borderRadius: 2 }} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={100} height={32} sx={{ borderRadius: 1.5 }} />
        </Box>

        {/* Content Area Skeleton */}
        <Box sx={{ flex: 1, overflow: 'hidden', px: 2, py: 2 }}>
          {/* Stats Skeleton */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
            <Skeleton variant="rounded" width={110} height={52} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" width={120} height={52} sx={{ borderRadius: 2 }} />
          </Box>

          {/* Theme Cards Grid Skeleton */}
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                <Card sx={{
                  borderRadius: 2.5,
                  background: theme.palette.background.paper,
                  border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                  minHeight: 140,
                }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 1.5 }} />
                    </Box>
                    <Skeleton variant="text" width="70%" height={22} sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width="100%" height={16} />
                    <Skeleton variant="text" width="50%" height={16} sx={{ mb: 1.5 }} />
                    <Skeleton variant="rounded" width={80} height={22} sx={{ borderRadius: 1 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </AdminLayout>
  );
};

export const FeaturesLoadingSkeleton: React.FC = () => {
  const theme = useTheme();

  return (
    <Box>
      {[1, 2, 3].map((i) => (
        <Box key={i} sx={{ 
          mb: 1.5, 
          p: 2, 
          borderRadius: 2.5, 
          background: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Skeleton variant="text" width="45%" height={22} />
            <Skeleton variant="rounded" width={60} height={22} sx={{ borderRadius: 1 }} />
          </Box>
          <Skeleton variant="text" width="100%" height={16} />
          <Skeleton variant="text" width="70%" height={16} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Skeleton variant="rounded" width={70} height={22} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rounded" width={80} height={22} sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export const MentionsLoadingSkeleton: React.FC = () => {
  const theme = useTheme();

  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <Box key={`mention-shimmer-${index}`} sx={{
          p: 2,
          mb: 1.5,
          borderRadius: 2,
          background: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Skeleton variant="circular" width={32} height={32} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="45%" height={18} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="25%" height={14} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="100%" height={14} />
              <Skeleton variant="text" width="65%" height={14} sx={{ mb: 1 }} />
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Skeleton variant="rounded" width={50} height={20} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width={35} height={20} sx={{ borderRadius: 1 }} />
              </Box>
            </Box>
          </Box>
        </Box>
      ))}
    </>
  );
};
