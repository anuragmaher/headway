/**
 * Authentication-related TypeScript types
 */

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_id: string;
  company_name: string;
  job_title?: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at?: string;
  last_login_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  theme_preference?: 'light' | 'dark';
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  demoLogin: () => Promise<void>;
  setUser: (user: User) => void;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
}