/**
 * Layout Store - Allows pages to customize AdminLayout header and sidebar state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ReactNode } from 'react';

interface LayoutState {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      headerContent: null,
      setHeaderContent: (content) => set({ headerContent: content }),
      sidebarCollapsed: true,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'headway-layout',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
