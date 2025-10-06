/**
 * Application route constants
 */

export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Protected routes
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
  
  // Settings routes
  SETTINGS: '/app/settings',
  SETTINGS_PROFILE: '/app/settings/profile',
  SETTINGS_WORKSPACE: '/app/settings/workspace',
  SETTINGS_INTEGRATIONS: '/app/settings/integrations',
  SETTINGS_TEAM: '/app/settings/team',

  // Feature routes
  FEATURES: '/app/features',
  FEATURE_DETAIL: '/app/features/:id',

  // Theme routes
  THEMES: '/app/themes',
  THEME_DETAIL: '/app/themes/:id',

  // Clustering routes
  CLUSTERING: '/app/clustering',

  // Slack integration routes
  SLACK_CALLBACK: '/app/slack/callback',
  
  // Catch-all
  NOT_FOUND: '*',
} as const;

// Helper functions for dynamic routes
export const getFeatureDetailRoute = (id: string): string => 
  ROUTES.FEATURE_DETAIL.replace(':id', id);

export const getThemeDetailRoute = (id: string): string => 
  ROUTES.THEME_DETAIL.replace(':id', id);

// Route groups for easier management
export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
] as const;

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.ONBOARDING,
  ROUTES.SETTINGS,
  ROUTES.SETTINGS_PROFILE,
  ROUTES.SETTINGS_WORKSPACE,
  ROUTES.SETTINGS_INTEGRATIONS,
  ROUTES.SETTINGS_TEAM,
  ROUTES.FEATURES,
  ROUTES.FEATURE_DETAIL,
  ROUTES.THEMES,
  ROUTES.THEME_DETAIL,
  ROUTES.CLUSTERING,
  ROUTES.SLACK_CALLBACK,
] as const;

// Route metadata for navigation
export const ROUTE_METADATA = {
  [ROUTES.HOME]: {
    title: 'HeadwayHQ',
    description: 'Product Intelligence Platform',
    showInNav: false,
  },
  [ROUTES.DASHBOARD]: {
    title: 'Dashboard',
    description: 'Feature requests and analytics',
    showInNav: true,
    icon: 'DashboardIcon',
  },
  [ROUTES.FEATURES]: {
    title: 'Features',
    description: 'Manage feature requests',
    showInNav: true,
    icon: 'FeaturesIcon',
  },
  [ROUTES.THEMES]: {
    title: 'Themes',
    description: 'Organize features by theme',
    showInNav: true,
    icon: 'CategoryIcon',
  },
  [ROUTES.CLUSTERING]: {
    title: 'AI Intelligence',
    description: 'AI-powered feature clustering and classification',
    showInNav: true,
    icon: 'PsychologyIcon',
  },
  [ROUTES.SETTINGS]: {
    title: 'Settings',
    description: 'Account and workspace settings',
    showInNav: true,
    icon: 'SettingsIcon',
  },
} as const;