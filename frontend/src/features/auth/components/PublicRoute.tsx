/**
 * Public route component that redirects authenticated users
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated, useUser } from '../store/auth-store';
import { ROUTES } from '@/lib/constants/routes';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function PublicRoute({ 
  children, 
  redirectTo 
}: PublicRouteProps): JSX.Element {
  const isAuthenticated = useIsAuthenticated();
  const user = useUser();

  // If authenticated, redirect to appropriate page
  if (isAuthenticated && user) {
    // If onboarding not completed, go to onboarding
    if (!user.onboarding_completed) {
      return <Navigate to={ROUTES.ONBOARDING} replace />;
    }
    
    // Otherwise go to specified redirect or dashboard
    const destination = redirectTo || ROUTES.DASHBOARD;
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}