/**
 * GmailCallbackPage - Handles Gmail OAuth callback
 * This page is opened in a new tab during OAuth flow
 * It notifies the parent window when OAuth completes
 */

import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export function GmailCallbackPage(): JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    // Check URL params to see if Gmail connection was successful
    const params = new URLSearchParams(window.location.search);
    const isGmailConnected = params.get('gmail') === 'connected';
    const isExisting = params.get('existing') === 'true';
    
    // Check if we're coming from onboarding (check in opener window's sessionStorage if possible)
    // Since we can't access opener's sessionStorage directly, we'll use localStorage
    const isFromOnboarding = localStorage.getItem('onboarding-gmail-connect') === 'true';

    if (isGmailConnected) {
      if (isFromOnboarding) {
        // Notify parent/opener window via localStorage (works across tabs)
        localStorage.setItem('gmail-oauth-complete', 'true');
        localStorage.setItem('gmail-oauth-success', 'true');
        
        // Trigger storage event for same-tab listeners
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'gmail-oauth-complete',
          newValue: 'true',
          storageArea: localStorage,
        }));

        // Small delay to ensure message is sent, then close this window
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            // If no opener (opened in same tab), redirect to dashboard
            window.location.href = '/dashboard';
          }
        }, 500);
      } else {
        // Not from onboarding, redirect to settings
        setTimeout(() => {
          window.location.href = '/app/settings/workspace?gmail=connected';
        }, 1000);
      }
    } else {
      // Connection failed or error
      setTimeout(() => {
        window.location.href = '/app/settings/workspace';
      }, 1000);
    }
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: theme.palette.background.default,
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Completing Gmail connection...
      </Typography>
    </Box>
  );
}
