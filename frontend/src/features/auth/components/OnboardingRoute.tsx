/**
 * OnboardingRoute - Auth wrapper for onboarding page
 * Requires authentication but only accessible if onboarding is NOT completed.
 * Redirects to dashboard if user has already completed onboarding.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useUser } from '../store/auth-store';
import { ROUTES } from '@/lib/constants/routes';
import { Loading } from '@/shared/components';

interface OnboardingRouteProps {
  children: React.ReactNode;
}

export function OnboardingRoute({ children }: OnboardingRouteProps): JSX.Element {
  const isAuthenticated = useIsAuthenticated();
  const user = useUser();
  const location = useLocation();

  // Show loading while auth state is being determined
  if (isAuthenticated === undefined) {
    return <Loading fullScreen message="Loading..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Redirect to dashboard if onboarding is already completed
  if (user?.onboarding_completed) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Render onboarding page for authenticated users who haven't completed onboarding
  return <>{children}</>;
}
