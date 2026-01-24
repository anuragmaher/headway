export type SortBy = 'mention_count' | 'last_mentioned' | 'name';
export type SortOrder = 'asc' | 'desc';
export type FilterStatus = 'all' | string;
export type FilterUrgency = 'all' | string;

export type MentionDetailsTab = 'summary' | 'features' | 'bugs' | 'pain-points' | 'highlights';
export type DrawerLevel = 'mentions' | 'details';

export interface FilterState {
  sortBy: SortBy;
  sortOrder: SortOrder;
  filterStatus: FilterStatus;
  filterUrgency: FilterUrgency;
  filterMrrMin: string;
  filterMrrMax: string;
  searchQuery: string;
}

export interface DialogState {
  dialogOpen: boolean;
  editModalOpen: boolean;
  addModalOpen: boolean;
  deleteConfirmOpen: boolean;
  deleteMentionConfirmOpen: boolean;
}

export interface DrawerState {
  drawerOpen: boolean;
  mentionsDrawerOpen: boolean;
  mobileThemesDrawerOpen: boolean;
  drawerLevel: DrawerLevel;
}

export interface ResizableState {
  featuresWidth: number;
  mentionsListWidth: number;
  isResizingMentions: boolean;
}









