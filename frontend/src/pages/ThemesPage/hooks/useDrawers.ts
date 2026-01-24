import { useState, useCallback } from 'react';
import { DrawerState, DrawerLevel } from '../types';

export const useDrawers = () => {
  const [drawerState, setDrawerState] = useState<DrawerState>({
    drawerOpen: false,
    mentionsDrawerOpen: false,
    mobileThemesDrawerOpen: false,
    drawerLevel: 'mentions',
  });

  const openDrawer = useCallback((drawerType: keyof Omit<DrawerState, 'drawerLevel'>) => {
    setDrawerState(prev => ({ ...prev, [drawerType]: true }));
  }, []);

  const closeDrawer = useCallback((drawerType: keyof Omit<DrawerState, 'drawerLevel'>) => {
    setDrawerState(prev => ({ ...prev, [drawerType]: false }));
  }, []);

  const setDrawerLevel = useCallback((level: DrawerLevel) => {
    setDrawerState(prev => ({ ...prev, drawerLevel: level }));
  }, []);

  const closeAllDrawers = useCallback(() => {
    setDrawerState({
      drawerOpen: false,
      mentionsDrawerOpen: false,
      mobileThemesDrawerOpen: false,
      drawerLevel: 'mentions',
    });
  }, []);

  return {
    drawerState,
    openDrawer,
    closeDrawer,
    setDrawerLevel,
    closeAllDrawers,
  };
};









