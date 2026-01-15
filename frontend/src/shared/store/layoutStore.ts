/**
 * Layout Store - Allows pages to customize AdminLayout header
 */

import { create } from 'zustand';
import { ReactNode } from 'react';

interface LayoutState {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  headerContent: null,
  setHeaderContent: (content) => set({ headerContent: content }),
}));
