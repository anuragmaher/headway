/**
 * ThemeCard Component
 * Expandable card showing theme with subthemes
 */

import { useState } from 'react';
import { Box, Typography, Collapse, IconButton, TextField, Button } from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Add as AddIcon,
  FiberManualRecord as BulletIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import type { Theme, SubTheme } from '../../../types';
import { TAXONOMY_COLORS, TAXONOMY_TEXT } from '../constants';

interface ThemeCardProps {
  theme: Theme;
  onAddSubtheme: (themeName: string, subtheme: SubTheme) => void;
  onEditTheme?: (themeName: string) => void;
  onDeleteTheme?: (themeName: string) => void;
}

export function ThemeCard({ theme, onAddSubtheme, onEditTheme, onDeleteTheme }: ThemeCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingSubtheme, setIsAddingSubtheme] = useState(false);
  const [newSubthemeName, setNewSubthemeName] = useState('');
  const [newSubthemeDescription, setNewSubthemeDescription] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const hasSubThemes = theme.sub_themes && theme.sub_themes.length > 0;

  const handleAddSubtheme = () => {
    if (newSubthemeName.trim()) {
      onAddSubtheme(theme.name, {
        name: newSubthemeName.trim(),
        description: newSubthemeDescription.trim(),
        confidence: 80,
      });
      setNewSubthemeName('');
      setNewSubthemeDescription('');
      setIsAddingSubtheme(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsAddingSubtheme(false);
      setNewSubthemeName('');
      setNewSubthemeDescription('');
    }
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        bgcolor: TAXONOMY_COLORS.background.card,
        borderRadius: 2,
        border: `1px solid ${TAXONOMY_COLORS.border.light}`,
        overflow: 'hidden',
      }}
    >
      {/* Theme Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          p: 2,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: TAXONOMY_COLORS.background.subtle,
          },
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconButton
          size="small"
          sx={{
            p: 0.5,
            mr: 1,
            color: TAXONOMY_COLORS.text.secondary,
          }}
        >
          {isExpanded ? (
            <ArrowUpIcon sx={{ fontSize: 20 }} />
          ) : (
            <ArrowDownIcon sx={{ fontSize: 20 }} />
          )}
        </IconButton>

        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: '#1e293b',
              lineHeight: 1.4,
            }}
          >
            {theme.name}
          </Typography>
          {theme.description && (
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: '#64748b',
                lineHeight: 1.5,
                mt: 0.25,
              }}
            >
              {theme.description}
            </Typography>
          )}
        </Box>

        {/* Edit & Delete Icons - shown on hover */}
        {isHovered && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              ml: 1,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {onEditTheme && (
              <IconButton
                size="small"
                onClick={() => onEditTheme(theme.name)}
                sx={{
                  p: 0.5,
                  color: '#94a3b8',
                  '&:hover': {
                    color: '#64748b',
                    bgcolor: '#f1f5f9',
                  },
                }}
              >
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            {onDeleteTheme && (
              <IconButton
                size="small"
                onClick={() => onDeleteTheme(theme.name)}
                sx={{
                  p: 0.5,
                  color: '#94a3b8',
                  '&:hover': {
                    color: '#ef4444',
                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {/* Subthemes - Collapsible */}
      <Collapse in={isExpanded && hasSubThemes}>
        <Box sx={{ borderTop: `1px solid ${TAXONOMY_COLORS.border.light}`, py: 1 }}>
          {theme.sub_themes?.map((subtheme, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                px: 2,
                py: 1,
                ml: 4,
              }}
            >
              <BulletIcon
                sx={{
                  fontSize: 8,
                  color: '#94a3b8',
                  mt: 0.75,
                  mr: 1.5,
                }}
              />
              <Box>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    lineHeight: 1.4,
                  }}
                >
                  {subtheme.name}
                </Typography>
                {subtheme.description && (
                  <Typography
                    sx={{
                      fontSize: '0.8125rem',
                      color: '#64748b',
                      lineHeight: 1.4,
                    }}
                  >
                    {subtheme.description}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Add Subtheme - Always visible */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${TAXONOMY_COLORS.border.light}`,
        }}
      >
        {isAddingSubtheme ? (
          <Box sx={{ ml: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Subtheme name"
              value={newSubthemeName}
              onChange={(e) => setNewSubthemeName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  borderRadius: 1.5,
                  '&.Mui-focused fieldset': {
                    borderColor: TAXONOMY_COLORS.purple.main,
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  '&::placeholder': {
                    color: '#94a3b8',
                    opacity: 1,
                  },
                },
              }}
            />
            <TextField
              fullWidth
              size="small"
              placeholder="Description (optional)"
              value={newSubthemeDescription}
              onChange={(e) => setNewSubthemeDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              multiline
              rows={2}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#ffffff',
                  borderRadius: 1.5,
                  '&.Mui-focused fieldset': {
                    borderColor: TAXONOMY_COLORS.purple.main,
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  '&::placeholder': {
                    color: '#94a3b8',
                    opacity: 1,
                  },
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleAddSubtheme}
                disabled={!newSubthemeName.trim()}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.5,
                  bgcolor: TAXONOMY_COLORS.purple.main,
                  color: '#ffffff',
                  '&:hover': {
                    bgcolor: TAXONOMY_COLORS.purple.hover,
                  },
                }}
              >
                Add
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setIsAddingSubtheme(false);
                  setNewSubthemeName('');
                  setNewSubthemeDescription('');
                }}
                sx={{
                  textTransform: 'none',
                  color: '#64748b',
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingSubtheme(true);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              ml: 4,
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'color 0.15s ease',
              '&:hover': {
                color: TAXONOMY_COLORS.purple.main,
              },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: '0.875rem' }}>
              {TAXONOMY_TEXT.themeCard.addSubtheme}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
