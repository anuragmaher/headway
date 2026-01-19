/**
 * Main application router with protected routes
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { PublicRoute } from '@/features/auth/components/PublicRoute';
import { ROUTES } from '@/lib/constants/routes';

// Page imports
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ThemesPage } from '@/pages/Themes';
import { WorkspaceSettingsPage } from '@/pages/WorkspaceSettingsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import CustomersChatPage from '@/pages/CustomersChatPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ExecutiveInsightsPage } from '@/pages/ExecutiveInsightsPage';
import { SourcesPage } from '@/pages/AllMessages';
import { GmailCallbackPage } from '@/pages/GmailCallbackPage';

export function AppRouter(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path={ROUTES.HOME} 
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } 
        />
        
        <Route 
          path={ROUTES.LOGIN} 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        
        <Route 
          path={ROUTES.REGISTER} 
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } 
        />

        {/* Protected routes */}
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <ExecutiveInsightsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.SOURCES}
          element={
            <ProtectedRoute>
              <SourcesPage />
            </ProtectedRoute>
          }
        />

        {/* Settings routes - will be implemented later */}
        <Route
          path={ROUTES.SETTINGS}
          element={
            <ProtectedRoute>
              <Navigate to={ROUTES.SETTINGS_WORKSPACE} replace />
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes for future implementation */}
        <Route
          path={ROUTES.SETTINGS_PROFILE}
          element={
            <ProtectedRoute>
              <div>Settings Profile - To be implemented</div>
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.SETTINGS_WORKSPACE}
          element={
            <ProtectedRoute>
              <WorkspaceSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.SETTINGS_INTEGRATIONS}
          element={
            <ProtectedRoute>
              <div>Settings Integrations - To be implemented</div>
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.THEMES}
          element={
            <ProtectedRoute>
              <ThemesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.CUSTOMERS}
          element={
            <ProtectedRoute>
              <CustomersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.CUSTOMERS_CHAT}
          element={
            <ProtectedRoute>
              <CustomersChatPage />
            </ProtectedRoute>
          }
        />

        {/* Gmail OAuth Callback */}
        <Route
          path="/gmail/callback"
          element={
            <ProtectedRoute>
              <GmailCallbackPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route */}
        <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}