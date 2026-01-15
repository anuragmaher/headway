/**
 * FeatureItem - Individual feature item in the features list
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  ListItem,
  FormControl,
  Select,
  MenuItem,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Feature } from '../types';
import { useThemesPageStore } from '../store';
import {
  getUrgencyColor,
  getStatusColor,
  getConfidenceColor,
  getConfidenceLabel,
  getThemeValidationConfidence,
} from '../utils';

interface FeatureItemProps {
  feature: Feature;
  onShowMessages: (feature: Feature) => void;
}

export const FeatureItem: React.FC<FeatureItemProps> = ({ feature, onShowMessages }) => {
  const theme = useTheme();
  const { flattenedThemes, openEditModal, openDeleteConfirm, updateFeatureTheme } = useThemesPageStore();

  const themeValidationConfidence = getThemeValidationConfidence(feature);

  return (
    <ListItem
      button
      onClick={() => onShowMessages(feature)}
      sx={{
        borderRadius: 2.5,
        mb: 1.5,
        p: 2,
        background: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.2),
          boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.06)}`,
          '& .action-buttons': {
            opacity: 1
          }
        },
      }}
    >
      <Box sx={{ width: '100%' }}>
        {/* Top Row - Feature Name + Confidence + Urgency */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: { xs: 'flex-start', md: 'center' }, 
          justifyContent: 'space-between', 
          mb: 0.75,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, flexWrap: 'wrap' }}>
            <Typography 
              variant="subtitle1" 
              sx={{ fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-word' }}
            >
              {feature.name}
            </Typography>
            {feature.match_confidence !== null && feature.match_confidence !== undefined && (
              <Tooltip title={`Feature match confidence: ${(feature.match_confidence * 100).toFixed(0)}%`}>
                <Chip
                  label={`${(feature.match_confidence * 100).toFixed(0)}%`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: feature.match_confidence >= 0.8 ? '#4caf50' : feature.match_confidence >= 0.6 ? '#ff9800' : '#f44336',
                    color: 'white'
                  }}
                />
              </Tooltip>
            )}
            {themeValidationConfidence !== null && (
              <Tooltip title={`Theme classification confidence: ${getConfidenceLabel(themeValidationConfidence)}`}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getConfidenceColor(themeValidationConfidence),
                    cursor: 'help'
                  }}
                />
              </Tooltip>
            )}
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <Chip
              label={feature.urgency}
              size="small"
              color={getUrgencyColor(feature.urgency)}
              sx={{ minWidth: 'auto', height: 22, fontSize: '0.7rem', fontWeight: 600 }}
            />
            
            <Box
              className="action-buttons"
              sx={{
                display: { xs: 'flex', md: 'flex' },
                gap: 0.5,
                opacity: { xs: 1, md: 0 },
                transition: 'opacity 0.2s ease-in-out',
              }}
            >
              <Tooltip title="Edit feature">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(feature);
                  }}
                  sx={{
                    color: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  <EditIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete feature">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteConfirm(feature);
                  }}
                  sx={{
                    color: theme.palette.error.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.error.main, 0.1)
                    }
                  }}
                >
                  <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5, lineHeight: 1.5, fontSize: '0.85rem' }}
        >
          {feature.description.length > 150
            ? `${feature.description.substring(0, 150)}...`
            : feature.description
          }
        </Typography>

        {/* Status Row */}
        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
          <Chip
            label={feature.status}
            size="small"
            color={getStatusColor(feature.status)}
            variant="outlined"
            sx={{ minWidth: 'auto', height: 22, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
          />
          {feature.mention_count > 0 && (
            <Chip
              label={`${feature.mention_count} mention${feature.mention_count !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              sx={{ minWidth: 'auto', height: 22, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
            />
          )}

          {themeValidationConfidence !== null && (
            <Chip
              label={`${Math.round(themeValidationConfidence * 100)}% confidence`}
              size="small"
              variant="filled"
              sx={{
                minWidth: 'auto',
                height: 22,
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                backgroundColor: getConfidenceColor(themeValidationConfidence),
                color: 'white'
              }}
            />
          )}

          {/* Theme Selector */}
          <FormControl 
            size="small" 
            sx={{ 
              minWidth: { xs: 120, sm: 180 }, 
              ml: { xs: 0, sm: 'auto' },
              width: { xs: '100%', sm: 'auto' },
              mt: { xs: 1, sm: 0 }
            }}
          >
            <Select
              value={feature.theme_id || ''}
              onChange={(e) => {
                e.stopPropagation();
                updateFeatureTheme(feature.id, e.target.value || null);
              }}
              onClick={(e) => e.stopPropagation()}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) {
                  return <em style={{ fontSize: '0.75rem' }}>No Theme</em>;
                }
                const selectedTheme = flattenedThemes.find(t => t.id === selected);
                if (!selectedTheme) {
                  return <em style={{ fontSize: '0.75rem' }}>Unknown Theme</em>;
                }
                if ((selectedTheme.level ?? 0) > 0 && selectedTheme.parent_theme_id) {
                  const parentTheme = flattenedThemes.find(t => t.id === selectedTheme.parent_theme_id);
                  if (parentTheme) {
                    return <Box component="span" sx={{ fontSize: '0.75rem' }}>{parentTheme.name} / {selectedTheme.name}</Box>;
                  }
                }
                return <Box component="span" sx={{ fontSize: '0.75rem' }}>{selectedTheme.name}</Box>;
              }}
              sx={{
                fontSize: '0.75rem',
                height: 28,
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(theme.palette.divider, 0.2),
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                },
                '& .MuiSelect-select': {
                  py: 0.5,
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }
                }
              }}
            >
              <MenuItem value="">
                <em>No Theme</em>
              </MenuItem>
              {flattenedThemes.map((themeItem) => {
                let displayText = themeItem.name;
                if ((themeItem.level ?? 0) > 0 && themeItem.parent_theme_id) {
                  const parentTheme = flattenedThemes.find(t => t.id === themeItem.parent_theme_id);
                  if (parentTheme) {
                    displayText = `${parentTheme.name} / ${themeItem.name}`;
                  }
                }
                return (
                  <MenuItem key={themeItem.id} value={themeItem.id}>
                    {displayText}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>

        {/* Extracted Insights Section */}
        {feature.data_points && feature.data_points.length > 0 && (
          <Box sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
          }}>
            <Typography variant="caption" sx={{
              fontWeight: 600,
              mb: 1,
              display: 'block',
              fontSize: '0.7rem',
              color: theme.palette.info.main,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📊 Extracted Insights
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {feature.data_points.map((dataPointEntry, dpIndex) => (
                <Box key={dpIndex} sx={{
                  p: 1,
                  borderRadius: 1,
                  background: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: theme.palette.text.primary }}>
                      {dataPointEntry.author || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {dataPointEntry.timestamp ? new Date(dataPointEntry.timestamp).toLocaleDateString() : ''}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {dataPointEntry.business_metrics && Object.entries(dataPointEntry.business_metrics).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="filled"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          bgcolor: alpha(theme.palette.success.main, 0.15),
                          color: theme.palette.success.dark,
                          fontWeight: 500,
                        }}
                      />
                    ))}

                    {dataPointEntry.entities && Object.entries(dataPointEntry.entities).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="filled"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          bgcolor: alpha(theme.palette.info.main, 0.15),
                          color: theme.palette.info.dark,
                          fontWeight: 500,
                        }}
                      />
                    ))}

                    {dataPointEntry.structured_metrics && Object.entries(dataPointEntry.structured_metrics).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        variant="filled"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          bgcolor: alpha(theme.palette.primary.main, 0.15),
                          color: theme.palette.primary.dark,
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </ListItem>
  );
};
