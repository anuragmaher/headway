/**
 * Landing page for public visitors
 */

import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  Stack,
  Chip,
  Avatar,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { LandingLayout } from '@/shared/components/layouts';
import { ROUTES } from '@/lib/constants/routes';

export function LandingPage(): JSX.Element {
  const theme = useTheme();

  return (
    <LandingLayout>
      {/* Hero Section */}
      <Box 
        sx={{ 
          position: 'relative',
          overflow: 'hidden',
          bgcolor: 'background.default',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 16 },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(ellipse at center top, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
            zIndex: 0
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip 
              label="🚀 Now in Beta - Free for Early Adopters" 
              color="primary" 
              variant="outlined"
              sx={{ mb: 4, fontSize: '0.9rem', py: 1 }}
            />
            
            <Typography 
              variant="h1" 
              component="h1" 
              sx={{ 
                fontWeight: 800,
                fontSize: { xs: '2.5rem', md: '4rem', lg: '4.5rem' },
                lineHeight: 1.1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, #7C3AED)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 3,
                letterSpacing: '-0.02em'
              }}
            >
              Turn Customer Feedback Into
              <br />
              Product Gold
            </Typography>
            
            <Typography 
              variant="h5" 
              color="text.secondary" 
              sx={{ 
                maxWidth: 680, 
                mx: 'auto', 
                mb: 6,
                fontWeight: 400,
                lineHeight: 1.5,
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              AI-powered platform that automatically extracts, categorizes, and prioritizes 
              feature requests from Slack, Gmail, and other communication channels. Make data-driven product decisions 
              in minutes, not hours.
            </Typography>
            
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={2} 
              justifyContent="center"
              sx={{ mb: 6 }}
            >
              <Button 
                variant="contained" 
                size="large"
                component={RouterLink}
                to={ROUTES.REGISTER}
                sx={{ 
                  px: 4, 
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outlined" 
                size="large"
                component={RouterLink}
                to={ROUTES.LOGIN}
                sx={{ 
                  px: 4, 
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                View Demo
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              ✨ No credit card required • Set up in under 2 minutes
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ py: 6, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={6} md={3} textAlign="center">
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                95%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Time Saved on Analysis
              </Typography>
            </Grid>
            <Grid item xs={6} md={3} textAlign="center">
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                10k+
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Features Processed
              </Typography>
            </Grid>
            <Grid item xs={6} md={3} textAlign="center">
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                50+
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Teams Using Daily
              </Typography>
            </Grid>
            <Grid item xs={6} md={3} textAlign="center">
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                4.9★
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Rating
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography 
              variant="h2" 
              fontWeight="bold"
              sx={{ mb: 3, fontSize: { xs: '2rem', md: '3rem' } }}
            >
              Everything You Need to Scale Product Intelligence
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto' }}
            >
              From raw feedback across all channels to actionable product insights in seconds
            </Typography>
          </Box>
          
          <Grid container spacing={4}>
            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    🤖
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    AI-Powered Analysis
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Claude AI automatically extracts feature requests, categorizes them by themes, 
                    and identifies key insights from all your customer communications.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    📊
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Smart Prioritization
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Features are automatically ranked by mention frequency, user impact, 
                    and urgency to help you focus on what matters most.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha('#7C3AED', 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    ⚡
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Real-time Updates
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Connect Slack, Gmail, and other platforms to watch as new feature requests 
                    are automatically processed and categorized in real-time.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha('#10B981', 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    🎯
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Theme Clustering
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Features are automatically grouped into themes like Design, Analytics, 
                    Security, Performance for better organization and planning.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha('#F59E0B', 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    📈
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Impact Tracking
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Track feature status, monitor implementation progress, and measure 
                    the impact of your product decisions over time.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Card 
                elevation={0}
                sx={{ 
                  height: '100%', 
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '16px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    borderColor: theme.palette.primary.main
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box 
                    sx={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: '16px',
                      bgcolor: alpha('#EF4444', 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      fontSize: '2rem'
                    }}
                  >
                    🔗
                  </Box>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Team Collaboration
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Assign features to team members, add comments, and collaborate 
                    seamlessly on product decisions within your organization.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography variant="h2" fontWeight="bold" sx={{ mb: 3 }}>
              Loved by Product Teams
            </Typography>
            <Typography variant="h6" color="text.secondary">
              See what teams are saying about HeadwayHQ
            </Typography>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 4, 
                  borderRadius: '16px',
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%'
                }}
              >
                <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic', lineHeight: 1.7 }}>
                  "HeadwayHQ transformed how we prioritize features. We went from spending 
                  hours reading through scattered feedback to getting organized insights in minutes."
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>SM</Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">Sarah Miller</Typography>
                    <Typography variant="body2" color="text.secondary">Product Manager, TechCorp</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 4, 
                  borderRadius: '16px',
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%'
                }}
              >
                <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic', lineHeight: 1.7 }}>
                  "The AI categorization is incredibly accurate. It picks up on feature 
                  requests we would have missed and groups them perfectly by theme."
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>DK</Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">David Kim</Typography>
                    <Typography variant="body2" color="text.secondary">Head of Product, StartupXYZ</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 4, 
                  borderRadius: '16px',
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%'
                }}
              >
                <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic', lineHeight: 1.7 }}>
                  "Setup was incredibly easy. Connected our communication tools in 2 minutes and 
                  started getting insights immediately. Game changer for our team."
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: '#7C3AED' }}>AC</Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">Alex Chen</Typography>
                    <Typography variant="body2" color="text.secondary">CPO, InnovateNow</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box 
        sx={{ 
          py: { xs: 8, md: 12 }, 
          background: theme.palette.mode === 'dark' 
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.8)}, ${alpha(theme.palette.secondary.main, 0.8)})` 
            : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="4"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            zIndex: 0
          }
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              sx={{ 
                mb: 3, 
                fontSize: { xs: '2rem', md: '3rem' },
                color: 'white'
              }}
            >
              Ready to Transform Your Product Process?
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                mb: 6, 
                opacity: 0.95, 
                fontWeight: 300,
                color: 'white'
              }}
            >
              Join 50+ teams using HeadwayHQ to make smarter, data-driven product decisions.
              Start your free trial today - no credit card required.
            </Typography>
            
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={2} 
              justifyContent="center"
              sx={{ mb: 4 }}
            >
              <Button 
                variant="contained"
                size="large"
                component={RouterLink}
                to={ROUTES.REGISTER}
                sx={{ 
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'white',
                  color: theme.palette.mode === 'dark' ? 'white' : theme.palette.primary.main,
                  px: 4, 
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  border: theme.palette.mode === 'dark' ? '2px solid rgba(255,255,255,0.2)' : 'none',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outlined"
                size="large"
                sx={{ 
                  borderColor: 'white',
                  color: 'white',
                  px: 4, 
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  borderWidth: 2,
                  '&:hover': {
                    borderColor: 'white',
                    borderWidth: 2,
                    bgcolor: alpha('#ffffff', 0.1),
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Schedule Demo
              </Button>
            </Stack>

            <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
              ✨ Free forever plan available • Enterprise ready • SOC2 compliant
            </Typography>
          </Box>
        </Container>
      </Box>
    </LandingLayout>
  );
}