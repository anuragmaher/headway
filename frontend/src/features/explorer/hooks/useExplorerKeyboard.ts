/**
 * useExplorerKeyboard - Keyboard navigation hook for the explorer
 * Provides vim-style and arrow key navigation between columns and items
 */
import { useEffect, useCallback } from 'react';
import { useExplorerStore } from '../store';

export const useExplorerKeyboard = () => {
  const {
    themes,
    subThemes,
    feedbackItems,
    selectedThemeId,
    selectedSubThemeId,
    selectedFeedbackId,
    activeColumn,
    isSearchOpen,
    isDetailPanelOpen,
    isAddThemeDialogOpen,
    isAddSubThemeDialogOpen,
    isEditThemeDialogOpen,
    isEditSubThemeDialogOpen,
    isMergeDialogOpen,
    isDeleteConfirmOpen,
    selectTheme,
    selectSubTheme,
    selectFeedback,
    expandFeedback,
    setActiveColumn,
    toggleSearch,
    closeDetailPanel,
  } = useExplorerStore();

  // Check if any dialog is open
  const isDialogOpen =
    isAddThemeDialogOpen ||
    isAddSubThemeDialogOpen ||
    isEditThemeDialogOpen ||
    isEditSubThemeDialogOpen ||
    isMergeDialogOpen ||
    isDeleteConfirmOpen;

  // Get current index in active column
  const getCurrentIndex = useCallback(() => {
    switch (activeColumn) {
      case 'themes':
        return themes.findIndex((t) => t.id === selectedThemeId);
      case 'subThemes':
        return subThemes.findIndex((st) => st.id === selectedSubThemeId);
      case 'feedback':
        return feedbackItems.findIndex((f) => f.id === selectedFeedbackId);
      default:
        return -1;
    }
  }, [
    activeColumn,
    themes,
    subThemes,
    feedbackItems,
    selectedThemeId,
    selectedSubThemeId,
    selectedFeedbackId,
  ]);

  // Navigate up in current column
  const navigateUp = useCallback(() => {
    const currentIndex = getCurrentIndex();

    switch (activeColumn) {
      case 'themes':
        if (currentIndex > 0) {
          selectTheme(themes[currentIndex - 1].id);
        } else if (currentIndex === -1 && themes.length > 0) {
          selectTheme(themes[0].id);
        }
        break;
      case 'subThemes':
        if (currentIndex > 0) {
          selectSubTheme(subThemes[currentIndex - 1].id);
        } else if (currentIndex === -1 && subThemes.length > 0) {
          selectSubTheme(subThemes[0].id);
        }
        break;
      case 'feedback':
        if (currentIndex > 0) {
          selectFeedback(feedbackItems[currentIndex - 1].id);
        } else if (currentIndex === -1 && feedbackItems.length > 0) {
          selectFeedback(feedbackItems[0].id);
        }
        break;
    }
  }, [
    activeColumn,
    getCurrentIndex,
    themes,
    subThemes,
    feedbackItems,
    selectTheme,
    selectSubTheme,
    selectFeedback,
  ]);

  // Navigate down in current column
  const navigateDown = useCallback(() => {
    const currentIndex = getCurrentIndex();

    switch (activeColumn) {
      case 'themes':
        if (currentIndex < themes.length - 1) {
          selectTheme(themes[currentIndex + 1].id);
        } else if (currentIndex === -1 && themes.length > 0) {
          selectTheme(themes[0].id);
        }
        break;
      case 'subThemes':
        if (currentIndex < subThemes.length - 1) {
          selectSubTheme(subThemes[currentIndex + 1].id);
        } else if (currentIndex === -1 && subThemes.length > 0) {
          selectSubTheme(subThemes[0].id);
        }
        break;
      case 'feedback':
        if (currentIndex < feedbackItems.length - 1) {
          selectFeedback(feedbackItems[currentIndex + 1].id);
        } else if (currentIndex === -1 && feedbackItems.length > 0) {
          selectFeedback(feedbackItems[0].id);
        }
        break;
    }
  }, [
    activeColumn,
    getCurrentIndex,
    themes,
    subThemes,
    feedbackItems,
    selectTheme,
    selectSubTheme,
    selectFeedback,
  ]);

  // Navigate left (previous column)
  const navigateLeft = useCallback(() => {
    switch (activeColumn) {
      case 'feedback':
        setActiveColumn('subThemes');
        break;
      case 'subThemes':
        setActiveColumn('themes');
        break;
      case 'themes':
      default:
        // Already at leftmost column
        break;
    }
  }, [activeColumn, setActiveColumn]);

  // Navigate right (next column)
  const navigateRight = useCallback(() => {
    switch (activeColumn) {
      case 'themes':
        if (selectedThemeId) {
          setActiveColumn('subThemes');
        }
        break;
      case 'subThemes':
        if (selectedSubThemeId || selectedThemeId) {
          setActiveColumn('feedback');
        }
        break;
      case 'feedback':
      default:
        // Already at rightmost column
        break;
    }
  }, [activeColumn, selectedThemeId, selectedSubThemeId, setActiveColumn]);

  // Handle Enter key - select/expand current item
  const handleEnter = useCallback(() => {
    switch (activeColumn) {
      case 'themes':
        // Theme is already selected on click, move to sub-themes
        if (selectedThemeId) {
          setActiveColumn('subThemes');
        }
        break;
      case 'subThemes':
        // Move to feedback
        if (selectedSubThemeId || selectedThemeId) {
          setActiveColumn('feedback');
        }
        break;
      case 'feedback':
        // Expand feedback detail
        if (selectedFeedbackId) {
          expandFeedback(selectedFeedbackId);
        }
        break;
    }
  }, [
    activeColumn,
    selectedThemeId,
    selectedSubThemeId,
    selectedFeedbackId,
    setActiveColumn,
    expandFeedback,
  ]);

  // Handle Escape key - close detail or deselect
  const handleEscape = useCallback(() => {
    if (isDetailPanelOpen) {
      closeDetailPanel();
    } else if (isSearchOpen) {
      toggleSearch();
    } else {
      // Navigate back
      switch (activeColumn) {
        case 'feedback':
          selectFeedback(null);
          setActiveColumn('subThemes');
          break;
        case 'subThemes':
          selectSubTheme(null);
          setActiveColumn('themes');
          break;
        case 'themes':
          selectTheme(null);
          break;
      }
    }
  }, [
    isDetailPanelOpen,
    isSearchOpen,
    activeColumn,
    closeDetailPanel,
    toggleSearch,
    selectTheme,
    selectSubTheme,
    selectFeedback,
    setActiveColumn,
  ]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if dialog is open or if user is typing in an input
      if (isDialogOpen) return;

      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInput && !isSearchOpen) return;

      // Command/Ctrl + K for search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        toggleSearch();
        return;
      }

      // Handle search mode separately
      if (isSearchOpen && event.key === 'Escape') {
        event.preventDefault();
        toggleSearch();
        return;
      }

      // Don't handle other keys if in search mode
      if (isSearchOpen) return;

      switch (event.key) {
        // Arrow keys
        case 'ArrowUp':
          event.preventDefault();
          navigateUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateDown();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateLeft();
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateRight();
          break;

        // Vim-style keys
        case 'k':
        case 'K':
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            navigateUp();
          }
          break;
        case 'j':
        case 'J':
          event.preventDefault();
          navigateDown();
          break;
        case 'h':
        case 'H':
          event.preventDefault();
          navigateLeft();
          break;
        case 'l':
        case 'L':
          event.preventDefault();
          navigateRight();
          break;

        // Action keys
        case 'Enter':
          event.preventDefault();
          handleEnter();
          break;
        case 'Escape':
          event.preventDefault();
          handleEscape();
          break;

        // Slash to focus search
        case '/':
          if (!isSearchOpen) {
            event.preventDefault();
            toggleSearch();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDialogOpen,
    isSearchOpen,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    handleEnter,
    handleEscape,
    toggleSearch,
  ]);
};

export default useExplorerKeyboard;
