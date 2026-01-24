import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Box,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Message as MessageIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { Feature } from '../../types';

interface FeatureCardProps {
  feature: Feature;
  onEdit: (feature: Feature) => void;
  onDelete: (feature: Feature) => void;
  onViewMessages: (feature: Feature, fullPage?: boolean) => void;
  extractDataPointValue: (feature: Feature, key: string) => any;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  onEdit,
  onDelete,
  onViewMessages,
  extractDataPointValue,
}) => {
  const theme = useTheme();

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.text.secondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return theme.palette.success.main;
      case 'in_progress': return theme.palette.info.main;
      case 'planned': return theme.palette.warning.main;
      default: return theme.palette.text.secondary;
    }
  };

  const customerName = extractDataPointValue(feature, 'customer_name');
  const mrr = extractDataPointValue(feature, 'mrr');

  return (
    <Card
      sx={{
        mb: 2,
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.02),
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              {feature.name}
            </Typography>
            
            {feature.description && (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {feature.description}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
            <Tooltip title="Edit Feature">
              <IconButton size="small" onClick={() => onEdit(feature)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="View Messages">
              <IconButton size="small" onClick={() => onViewMessages(feature)}>
                <MessageIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="View Messages (Full Page)">
              <IconButton size="small" onClick={() => onViewMessages(feature, true)}>
                <OpenInNewIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Delete Feature">
              <IconButton size="small" onClick={() => onDelete(feature)} color="error">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip
            label={`${feature.mention_count} mentions`}
            size="small"
            variant="outlined"
            color="primary"
          />
          
          {feature.urgency && (
            <Chip
              label={feature.urgency}
              size="small"
              sx={{
                backgroundColor: alpha(getUrgencyColor(feature.urgency), 0.1),
                color: getUrgencyColor(feature.urgency),
                border: `1px solid ${alpha(getUrgencyColor(feature.urgency), 0.3)}`,
              }}
            />
          )}
          
          {feature.status && (
            <Chip
              label={feature.status.replace('_', ' ')}
              size="small"
              sx={{
                backgroundColor: alpha(getStatusColor(feature.status), 0.1),
                color: getStatusColor(feature.status),
                border: `1px solid ${alpha(getStatusColor(feature.status), 0.3)}`,
              }}
            />
          )}
          
          {customerName && (
            <Chip
              label={customerName}
              size="small"
              variant="outlined"
              color="secondary"
            />
          )}
          
          {mrr && (
            <Chip
              label={`$${mrr} MRR`}
              size="small"
              variant="filled"
              color="success"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            First mentioned: {formatDate(feature.first_mentioned)}
          </Typography>
          
          <Typography variant="caption" color="textSecondary">
            Last mentioned: {formatDate(feature.last_mentioned)}
          </Typography>
        </Box>

        {feature.match_confidence && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Match confidence: {Math.round(feature.match_confidence * 100)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};









