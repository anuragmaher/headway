/**
 * Main dashboard page for authenticated users
 */

import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import { AdminLayout } from '@/shared/components/layouts';

export function DashboardPage(): JSX.Element {
  return (
    <AdminLayout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome to your HeadwayHQ dashboard. The 3-column dashboard layout 
          will be implemented here with themes, features, and details.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Themes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Left column - Theme categories will be displayed here
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Features
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Middle column - Feature requests will be displayed here
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Right column - Feature details will be displayed here
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
}