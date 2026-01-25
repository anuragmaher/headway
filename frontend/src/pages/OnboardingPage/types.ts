/**
 * Types for OnboardingPage
 *
 * Data is stored in proper tables:
 * - Company data → companies table
 * - Themes/sub-themes → themes & sub_themes tables
 * - Connected sources → workspace_connectors table
 * - Competitors → competitors table
 * - Progress tracking → onboarding_progress table (only current_step)
 */

// ============================================
// Step Configuration
// ============================================

export interface OnboardingSubStep {
  id: string;
  label: string;
}

export interface OnboardingStep {
  id: number;
  label: string;
  description: string;
  subSteps?: OnboardingSubStep[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    label: 'COMPANY SETUP',
    description: 'Tell us about your company',
  },
  {
    id: 1,
    label: 'PRODUCT TAXONOMY',
    description: 'Generate your product taxonomy',
    subSteps: [
      { id: 'website-url', label: 'Website URL' },
      { id: 'review-themes', label: 'Review themes' },
    ],
  },
  {
    id: 2,
    label: 'DATA SOURCES',
    description: 'Connect your data sources',
  },
  {
    id: 3,
    label: 'COMPETITORS',
    description: 'Add your competitors',
  },
];

// ============================================
// Company Setup (Step 0)
// ============================================

export interface CompanySetupData {
  name: string;
  website: string;
  industry: string;
  teamSize: string;
  role: string;
  domains: string[];
  domainsInput?: string; // Temporary storage for raw input while typing
}

export const INITIAL_COMPANY_DATA: CompanySetupData = {
  name: '',
  website: '',
  industry: '',
  teamSize: '',
  role: '',
  domains: [],
};

export const INDUSTRIES = [
  'SaaS / Software',
  'E-commerce',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Marketing',
  'HR / Recruiting',
  'Developer Tools',
  'Security',
  'Analytics',
  'Other',
];

export const TEAM_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
];

export const ROLES = [
  'Product Manager',
  'Engineering',
  'Design',
  'Customer Success',
  'Sales',
  'Marketing',
  'Founder / Executive',
  'Other',
];

// ============================================
// Product Taxonomy (Step 1)
// ============================================

export interface SubTheme {
  name: string;
  description: string;
  confidence: number;
}

export interface Theme {
  name: string;
  description: string;
  confidence: number;
  sub_themes: SubTheme[];
}

export interface TaxonomyData {
  url: string;
  themes: Theme[];
  selectedThemes: string[];
}

export const INITIAL_TAXONOMY_DATA: TaxonomyData = {
  url: '',
  themes: [],
  selectedThemes: [],
};

export type TaxonomyStatus = 'idle' | 'processing' | 'completed' | 'failed';

export type TaxonomySubStep = 'website-url' | 'review-themes';

// ============================================
// Data Sources (Step 2)
// ============================================

export interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: 'sales' | 'messaging';
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'gong',
    name: 'Gong',
    description: 'Analyze sales call transcripts',
    icon: 'RecordVoiceOver',
    color: '#7C3AED',
    category: 'sales',
  },
  {
    id: 'fathom',
    name: 'Fathom',
    description: 'Extract insights from recorded meetings',
    icon: 'VideoCall',
    color: '#059669',
    category: 'sales',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Scan customer emails',
    icon: 'Email',
    color: '#EA4335',
    category: 'messaging',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Monitor shared channels',
    icon: 'Forum',
    color: '#4A154B',
    category: 'messaging',
  },
];

// ============================================
// Connected Source (from workspace_connectors)
// ============================================

export interface ConnectedSource {
  id: string;
  connector_type: string;
  name: string | null;
  external_id: string | null;
  sync_status: string;
  last_synced_at: string | null;
}

// ============================================
// Competitors (Step 3)
// ============================================

export interface Competitor {
  name: string;
  website?: string;
}

// ============================================
// Wizard State
// ============================================

export interface OnboardingWizardState {
  currentStep: number;
  completedSteps: number[];
  companyData: CompanySetupData;
  taxonomyData: TaxonomyData;
  taxonomyStatus: TaxonomyStatus;
  taxonomyError: string | null;
  taxonomySubStep: TaxonomySubStep;
  connectedSources: ConnectedSource[];
  selectedCompetitors: Competitor[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

export const INITIAL_WIZARD_STATE: OnboardingWizardState = {
  currentStep: 0,
  completedSteps: [],
  companyData: INITIAL_COMPANY_DATA,
  taxonomyData: INITIAL_TAXONOMY_DATA,
  taxonomyStatus: 'idle',
  taxonomyError: null,
  taxonomySubStep: 'website-url',
  connectedSources: [],
  selectedCompetitors: [],
  isSaving: false,
  isLoading: false,
  error: null,
};

// ============================================
// API Types
// ============================================

export interface TaxonomyGenerateResponse {
  themes: Theme[];
}

export interface CompanyDataResponse {
  name: string;
  website: string | null;
  industry: string | null;
  team_size: string | null;
  role: string | null;
  domains: string[] | null;
}

export interface OnboardingProgressResponse {
  id: string;
  workspace_id: string;
  current_step: number;
  created_at: string;
  updated_at: string | null;
}

export interface BulkThemeResponse {
  created_count: number;
  themes: Array<{
    id: string;
    name: string;
    sub_theme_count: number;
  }>;
}
