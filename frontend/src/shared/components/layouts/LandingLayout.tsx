/**
 * Layout for public pages (landing, login, register)
 */


import { Box, Container, AppBar, Toolbar, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { ROUTES, EXTERNAL_LINKS } from '@/lib/constants/routes';

interface LandingLayoutProps {
  children: React.ReactNode;
  showAuth?: boolean;
}

export function LandingLayout({ 
  children, 
  showAuth = true 
}: LandingLayoutProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to={ROUTES.HOME}
            sx={{
              flexGrow: 1,
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 700
            }}
          >
            HeadwayHQ
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThemeToggle />

            {showAuth && (
              <>
                <Button
                  component={RouterLink}
                  to={ROUTES.LOGIN}
                  color="inherit"
                  sx={{ ml: 1 }}
                >
                  Sign In
                </Button>
                <Button
                  href={EXTERNAL_LINKS.EARLY_ACCESS}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  sx={{ ml: 1 }}
                >
                  Early Access
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </Box>

      {/* Footer */}
      <Box 
        component="footer" 
        sx={{ 
          py: 3, 
          px: 2, 
          mt: 'auto',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Container maxWidth="lg">
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <Typography variant="body2" color="text.secondary">
              © 2023 HeadwayHQ. Built with Claude Code.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography 
                variant="body2" 
                color="text.secondary"
                component="a"
                href="#"
                sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Privacy
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                component="a"
                href="#"
                sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Terms
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                component="a"
                href="#"
                sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Support
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}