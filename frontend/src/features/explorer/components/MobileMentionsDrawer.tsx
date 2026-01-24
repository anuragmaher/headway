/**
 * MobileMentionsDrawer - Bottom sheet drawer for mobile mentions view
 */
import React from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { MentionsPanel } from './MentionsPanel';
import { useExplorerStore } from '../store';

interface MobileMentionsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const MobileMentionsDrawer: React.FC<MobileMentionsDrawerProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const { selectedFeedbackId, selectedCustomerAskId, selectCustomerAsk, closeMentionsPanel } = useExplorerStore();

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={() => closeMentionsPanel()}
      sx={{
        '& .MuiDrawer-paper': {
          height: '90vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => closeMentionsPanel()} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Mentions
            </Typography>
          </Box>
          
          <IconButton onClick={() => closeMentionsPanel()}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {(selectedFeedbackId || selectedCustomerAskId) && (
            <MentionsPanel isMobileFullScreen />
          )}
        </Box>
      </Box>
    </Drawer>
  );
};