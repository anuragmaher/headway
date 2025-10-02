/**
 * Protected route component that requires authentication
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useUser } from '../store/auth-store';
import { ROUTES } from '@/lib/constants/routes';
import { Loading } from '@/shared/components';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireOnboarding = false 
}: ProtectedRouteProps): JSX.Element {
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

  // Check onboarding requirement
  if (requireOnboarding && user && !user.onboarding_completed) {
    // Allow access to onboarding route itself
    if (location.pathname !== ROUTES.ONBOARDING) {
      return <Navigate to={ROUTES.ONBOARDING} replace />;
    }
  }

  // If onboarding is completed but user is on onboarding page, redirect to dashboard
  if (user?.onboarding_completed && location.pathname === ROUTES.ONBOARDING) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}