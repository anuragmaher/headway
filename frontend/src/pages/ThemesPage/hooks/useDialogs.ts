import { useState, useCallback } from 'react';
import { DialogState } from '../types';

export const useDialogs = () => {
  const [dialogState, setDialogState] = useState<DialogState>({
    dialogOpen: false,
    editModalOpen: false,
    addModalOpen: false,
    deleteConfirmOpen: false,
    deleteMentionConfirmOpen: false,
  });

  const openDialog = useCallback((dialogType: keyof DialogState) => {
    setDialogState(prev => ({ ...prev, [dialogType]: true }));
  }, []);

  const closeDialog = useCallback((dialogType: keyof DialogState) => {
    setDialogState(prev => ({ ...prev, [dialogType]: false }));
  }, []);

  const closeAllDialogs = useCallback(() => {
    setDialogState({
      dialogOpen: false,
      editModalOpen: false,
      addModalOpen: false,
      deleteConfirmOpen: false,
      deleteMentionConfirmOpen: false,
    });
  }, []);

  return {
    dialogState,
    openDialog,
    closeDialog,
    closeAllDialogs,
  };
};









