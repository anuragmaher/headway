/**
 * CustomerAsksColumn - Third column displaying customer asks for a selected sub-theme
 * When a customer ask is clicked, it opens the MentionsPanel
 */
import React from 'react';
import { Box, Typography, Skeleton, Fade, useTheme } from '@mui/material';
import { CustomerAskCard } from './CustomerAskCard';
import {
  useCustomerAsks,
  useSelectedTheme,
  useSelectedSubTheme,
  useSelectedCustomerAskId,
  useIsLoadingCustomerAsks,
  useExplorerActions,
} from '../../store';

interface CustomerAsksColumnProps {
  isPanelOpen?: boolean;
}

export const CustomerAsksColumn: React.FC<CustomerAsksColumnProps> = ({
  isPanelOpen = false,
}) => {
  const theme = useTheme();
  const customerAsks = useCustomerAsks();
  const selectedTheme = useSelectedTheme();
  const selectedSubTheme = useSelectedSubTheme();
  const selectedCustomerAskId = useSelectedCustomerAskId();
  const isLoading = useIsLoadingCustomerAsks();
  const { selectCustomerAsk, updateCustomerAskStatus } = useExplorerActions();

  const handleCustomerAskSelect = (customerAskId: string) => {
    selectCustomerAsk(customerAskId);
  };

  const handleStatusChange = async (customerAskId: string, status: 'new' | 'under_review' | 'planned' | 'shipped') => {
    try {
      await updateCustomerAskStatus(customerAskId, status);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Common width styling with transition
  const columnSx = {
    width: isPanelOpen ? '50%' : '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
    transition: 'width 0.25s ease-out',
    overflow: 'hidden',
    minWidth: 0,
  };

  // Placeholder when nothing selected
  if (!selectedTheme) {
    return (
      <Box sx={columnSx}>
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Customer Asks
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
            Select a theme and sub-theme to view customer asks
          </Typography>
        </Box>
      </Box>
    );
  }

  // Placeholder when theme selected but no sub-theme
  if (!selectedSubTheme) {
    return (
      <Box sx={columnSx}>
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Customer Asks
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
            Select a sub-theme to view customer asks
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={columnSx}>
      {/* Header - Shows selected sub-theme name */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 0.5,
            }}
          >
            {selectedSubTheme.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Customer asks and feature requests
          </Typography>
        </Box>
      </Box>

      {/* CustomerAsk List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#FAFAFA',
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(0,0,0,0.1)',
            borderRadius: 3,
          },
        }}
      >
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={80}
                sx={{ mb: 1.5, borderRadius: 1.5 }}
              />
            ))}
          </Box>
        ) : customerAsks.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              p: 4,
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
              No customer asks found for this sub-theme
            </Typography>
          </Box>
        ) : (
          <Fade in={true} timeout={200}>
            <Box sx={{ p: 1.5 }}>
              {customerAsks.map((customerAsk) => (
                <CustomerAskCard
                  key={customerAsk.id}
                  customerAsk={customerAsk}
                  isSelected={customerAsk.id === selectedCustomerAskId}
                  onSelect={handleCustomerAskSelect}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
};

export default CustomerAsksColumn;
