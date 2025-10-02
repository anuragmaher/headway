/**
 * Onboarding page for new users
 */

import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';

export function OnboardingPage(): JSX.Element {
  return (
    <AdminLayout>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom align="center">
          Welcome to HeadwayHQ!
        </Typography>
        
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Let's get you set up
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The onboarding wizard will be implemented here with steps for:
            </Typography>
            <Box component="ul" sx={{ mt: 2 }}>
              <li>Welcome and product introduction</li>
              <li>Theme preference selection</li>
              <li>Connect Slack workspace</li>
              <li>Select channels to monitor</li>
              <li>Initial sync process</li>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </AdminLayout>
  );
}