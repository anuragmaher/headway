/**
 * Theme-related TypeScript types
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

export interface CustomThemeOptions {
  mode: ThemeMode;
}

export interface ThemeColors {
  primary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
  };
  background: {
    default: string;
    paper: string;
    surface: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  divider: string;
  border: string;
}

/**
 * Theme data types for feature categorization
 */
export interface ThemeData {
  id: string;
  name: string;
  description: string;
  feature_count: number;
  mention_count: number;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  parent_theme_id?: string | null;
  sub_theme_count?: number;
  level?: number;
}

export interface ThemeFormData {
  name: string;
  description: string;
  parent_theme_id?: string | null;
}

export interface ThemeHierarchy extends ThemeData {
  children: ThemeHierarchy[];
  parent?: ThemeHierarchy | null;
}