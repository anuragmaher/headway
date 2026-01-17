/**
 * PageTransition - Smooth fade and slide animation for page content
 */

import { useEffect, useState, useRef } from 'react';
import { Box, Fade } from '@mui/material';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps): JSX.Element {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'fadeIn' | 'fadeOut'>('fadeIn');
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    // If the path changed, trigger exit animation
    if (location.pathname !== previousPathRef.current) {
      setTransitionStage('fadeOut');
    }
  }, [location.pathname]);

  const handleExited = () => {
    if (transitionStage === 'fadeOut') {
      // After exit animation completes, update the children and trigger enter
      setDisplayChildren(children);
      previousPathRef.current = location.pathname;
      setTransitionStage('fadeIn');
    }
  };

  // If children changed while not transitioning (same path), update immediately
  useEffect(() => {
    if (transitionStage === 'fadeIn' && location.pathname === previousPathRef.current) {
      setDisplayChildren(children);
    }
  }, [children, transitionStage, location.pathname]);

  return (
    <Fade
      in={transitionStage === 'fadeIn'}
      timeout={{ enter: 250, exit: 150 }}
      onExited={handleExited}
      style={{ 
        transformOrigin: 'top center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          '& > *': {
            animation: transitionStage === 'fadeIn' 
              ? 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          },
          '@keyframes slideUp': {
            '0%': {
              opacity: 0,
              transform: 'translateY(8px)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }}
      >
        {displayChildren}
      </Box>
    </Fade>
  );
}
