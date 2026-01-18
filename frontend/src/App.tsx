import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { AppRouter } from '@/lib/router/AppRouter';
import { queryClient } from '@/lib/query';

// Google OAuth Client ID - Configure via environment variable
// For local development, get this from Google Cloud Console
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ThemeProvider>
          <AppRouter />
        </ThemeProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

export default App;