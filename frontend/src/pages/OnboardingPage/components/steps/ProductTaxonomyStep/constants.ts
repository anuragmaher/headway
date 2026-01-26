/**
 * Constants for ProductTaxonomyStep
 */

export const TAXONOMY_COLORS = {
  purple: {
    main: '#7C3AED',
    light: '#EDE9FE',
    border: 'rgba(124, 58, 237, 0.3)',
    hover: '#6D28D9',
  },
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    muted: '#94a3b8',
  },
  border: {
    light: '#e2e8f0',
    default: '#cbd5e1',
  },
  background: {
    card: '#ffffff',
    subtle: '#f8fafc',
    hover: '#f1f5f9',
  },
};

export const TAXONOMY_TEXT = {
  header: {
    title: 'Theme Taxonomy',
    subtitle: 'Organize customer conversations into themes and subthemes',
  },
  buttons: {
    addTheme: 'Add Theme',
    suggestFromDocs: 'Suggest from Help Docs',
  },
  emptyState: {
    title: 'No themes yet',
    description: 'Add themes manually or generate from your help docs',
  },
  suggestPanel: {
    title: 'Generate themes from Help Docs',
    description: "Enter your help center or documentation URL and we'll analyze it to suggest relevant themes.",
    placeholder: 'https://help.yourcompany.com',
    analyzeButton: 'Analyze Docs',
    supportText: 'We support Zendesk, Intercom, Freshdesk, Notion, GitBook, and most public help centers',
  },
  aiSuggestions: {
    title: 'AI Suggestions',
    loadingText: 'Analyzing your help docs...',
    addButton: 'Add',
    addedButton: 'Added',
    subthemesIncluded: 'subthemes included',
  },
  addThemeForm: {
    namePlaceholder: 'Theme name',
    descriptionPlaceholder: 'Description (optional)',
    generateButton: 'Generate description with AI',
    addButton: 'Add Theme',
    cancelButton: 'Cancel',
  },
  themeCard: {
    addSubtheme: 'Add subtheme',
  },
};
