/**
 * Types for OnboardingChecklist components
 */

export interface ChecklistStep {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
  wizardStepIndex: number;
}

export interface ChecklistState {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
  isAllComplete: boolean;
}

export interface OnboardingChecklistProps {
  onStepClick: (wizardStepIndex: number) => void;
  onDismiss: () => void;
}

export interface ChecklistItemProps {
  step: ChecklistStep;
  onClick: () => void;
}

/**
 * Step definitions with static content
 * Order: Company Details -> Data Sources -> Themes -> Competitors
 */
export const CHECKLIST_STEPS_CONFIG = [
  {
    id: 1,
    title: 'Add company details',
    description: 'Tell us about your company',
    wizardStepIndex: 0,
  },
  {
    id: 2,
    title: 'Connect data sources',
    description: 'Connect Slack, Gmail, or other sources',
    wizardStepIndex: 1,
  },
  {
    id: 3,
    title: 'Create themes',
    description: 'Organize feedback into themes',
    wizardStepIndex: 2,
  },
  {
    id: 4,
    title: 'Add competitors',
    description: 'Track your competitive landscape',
    wizardStepIndex: 3,
  },
] as const;
