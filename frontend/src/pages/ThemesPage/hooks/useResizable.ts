import { useState, useEffect, useRef, useCallback } from 'react';
import { ResizableState } from '../types';

export const useResizable = () => {
  const [resizableState, setResizableState] = useState<ResizableState>({
    featuresWidth: 35, // 35%
    mentionsListWidth: 18, // 18%
    isResizingMentions: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback(() => {
    setResizableState(prev => ({ ...prev, isResizingMentions: true }));
  }, []);

  const stopResize = useCallback(() => {
    setResizableState(prev => ({ ...prev, isResizingMentions: false }));
  }, []);

  const setFeaturesWidth = useCallback((width: number) => {
    setResizableState(prev => ({ ...prev, featuresWidth: width }));
  }, []);

  const setMentionsListWidth = useCallback((width: number) => {
    setResizableState(prev => ({ ...prev, mentionsListWidth: width }));
  }, []);

  // Handle resizing of mentions layout panels
  useEffect(() => {
    if (!resizableState.isResizingMentions) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const containerWidth = rect.width;
      const totalPercent = 100;

      // Calculate the position after first panel (features)
      // Features starts at 0, mentions list is after features
      const featuresPixels = (resizableState.featuresWidth / 100) * containerWidth;

      // If we're dragging the first divider (between features and mentions)
      if (e.clientX > rect.left && e.clientX < rect.left + containerWidth) {
        const newFeaturesWidth = (relativeX / containerWidth) * totalPercent;
        const remainingWidth = totalPercent - newFeaturesWidth;

        // Set features width and adjust mentions/details proportionally
        if (newFeaturesWidth >= 20 && newFeaturesWidth <= 60) {
          setFeaturesWidth(newFeaturesWidth);
          // Keep mentions list at roughly 20% of remaining space or adjust proportionally
          const newMentionsWidth = (resizableState.mentionsListWidth / (totalPercent - resizableState.featuresWidth)) * remainingWidth;
          if (newMentionsWidth >= 10 && newMentionsWidth <= remainingWidth - 10) {
            setMentionsListWidth(newMentionsWidth);
          }
        }
      }
    };

    const handleMouseUp = () => {
      stopResize();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizableState.isResizingMentions, resizableState.featuresWidth, resizableState.mentionsListWidth, setFeaturesWidth, setMentionsListWidth, stopResize]);

  return {
    resizableState,
    containerRef,
    startResize,
    stopResize,
    setFeaturesWidth,
    setMentionsListWidth,
  };
};









