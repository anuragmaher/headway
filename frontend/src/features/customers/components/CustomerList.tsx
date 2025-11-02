/**
 * Customer List Component
 *
 * Displays a searchable list of customers with basic information
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  InputAdornment,
  Chip,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { customersApi } from '@/services/customers-api';

interface Customer {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  arr?: number;
  mrr?: number;
  message_count?: number;
  deal_stage?: string;
  contact_name?: string;
  contact_email?: string;
}

interface CustomerListProps {
  workspaceId: string;
  selectedCustomerId: string | null;
  onCustomerSelect: (customerId: string) => void;
}

export function CustomerList({
  workspaceId,
  selectedCustomerId,
  onCustomerSelect,
}: CustomerListProps): JSX.Element {
  const theme = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const response = await customersApi.listCustomers(workspaceId, {
          page: 1,
          page_size: 100,
          search: searchTerm || undefined,
        });
        setCustomers(response.customers);

        // Auto-select first customer if none is selected and customers exist
        if (!selectedCustomerId && response.customers.length > 0) {
          onCustomerSelect(response.customers[0].id);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [workspaceId, searchTerm, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with Search */}
      <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Customers
          </Typography>
          <Tooltip title="Refresh customer list">
            <IconButton
              onClick={handleRefresh}
              disabled={loading}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoComplete="off"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.background.default, 0.5),
            },
          }}
        />
      </Box>

      {/* Customer List */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !customers || customers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body2">No customers found</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {customers.map((customer) => (
              <ListItemButton
                key={customer.id}
                selected={selectedCustomerId === customer.id}
                onClick={() => onCustomerSelect(customer.id)}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  transition: 'all 0.2s ease-in-out',
                  '&.Mui-selected': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`,
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  },
                }}
              >
                <BusinessIcon
                  sx={{
                    mr: 2,
                    color: selectedCustomerId === customer.id ? 'primary.main' : 'text.secondary',
                  }}
                />
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {customer.name}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {customer.domain && (
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                          {customer.domain}
                        </Typography>
                      )}
                      {customer.contact_name && (
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                          {customer.contact_name}
                          {customer.contact_email && ` • ${customer.contact_email}`}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {customer.arr && (
                          <Chip
                            label={formatCurrency(customer.arr)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: 'success.main',
                            }}
                          />
                        )}
                        {customer.message_count !== undefined && customer.message_count > 0 && (
                          <Chip
                            label={`${customer.message_count} messages`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              color: 'info.main',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
