/**
 * Shared types for Onboarding Wizard components
 */

import { type CompanyDetails } from '@/services/company';

export interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

export interface OnboardingStatus {
  companyDetails: boolean;
  dataSources: boolean;
  themes: boolean;
}

export interface StepProps {
  onNext: () => void;
  onBack?: () => void;
  loading?: boolean;
  error?: string | null;
  setError?: (error: string | null) => void;
}

export interface CompanyDetailsStepProps extends StepProps {
  companyData: CompanyDetails;
  setCompanyData: React.Dispatch<React.SetStateAction<CompanyDetails>>;
  workspaceId: string;
}

export interface DataSourceOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  connected: boolean;
}

export interface DataSourcesStepProps extends StepProps {
  dataSources: DataSourceOption[];
  setDataSources: React.Dispatch<React.SetStateAction<DataSourceOption[]>>;
}

export interface SelectedTheme {
  name: string;
  description: string;
}

export interface CreateThemeStepProps extends StepProps {
  selectedThemes: SelectedTheme[];
  setSelectedThemes: React.Dispatch<React.SetStateAction<SelectedTheme[]>>;
  workspaceId: string;
}

export interface Competitor {
  name: string;
  website?: string;
}

export interface CompetitorsStepProps extends StepProps {
  selectedCompetitors: Competitor[];
  setSelectedCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
  workspaceId: string;
  accessToken: string;
}

export const STEPS = ['Company Details', 'Data Sources', 'Themes', 'Competitors'];
export const COMPANY_SIZES = ['Startup', 'Small', 'Medium', 'Enterprise'];
