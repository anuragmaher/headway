/**
 * Protected route component that requires authentication
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '../store/auth-store';
import { ROUTES } from '@/lib/constants/routes';
import { Loading } from '@/shared/components';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({
  children
}: ProtectedRouteProps): JSX.Element {
  const isAuthenticated = useIsAuthenticated();
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

  // Pages are responsible for their own layout (AdminLayout, etc.)
  return <>{children}</>;
}