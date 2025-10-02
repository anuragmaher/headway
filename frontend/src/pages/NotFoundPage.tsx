/**
 * 404 Not Found page
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Home as HomeIcon } from '@mui/icons-material';
import { EmptyState } from '@/shared/components';
import { LandingLayout } from '@/shared/components/layouts';
import { ROUTES } from '@/lib/constants/routes';

export function NotFoundPage(): JSX.Element {
  return (
    <LandingLayout>
      <Box sx={{ py: 8 }}>
        <EmptyState
          icon={HomeIcon}
          title="Page Not Found"
          description="The page you're looking for doesn't exist or has been moved."
          fullHeight
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button 
            variant="contained"
            component={RouterLink}
            to={ROUTES.HOME}
            startIcon={<HomeIcon />}
          >
            Go Home
          </Button>
        </Box>
      </Box>
    </LandingLayout>
  );
}