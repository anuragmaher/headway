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
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface ThemeCardProps {
  theme: Theme;
  onAddSubtheme: (themeName: string, subtheme: SubTheme) => void;
  onRemoveSubtheme?: (themeName: string, subthemeName: string) => void;
  onEditSubtheme?: (themeName: string, subthemeName: string, updates: { name: string; description: string }) => void;
  onEditTheme?: (themeName: string) => void;
  onDeleteTheme?: (themeName: string) => void;
}

export function ThemeCard({
  theme,
  onAddSubtheme,
  onRemoveSubtheme,
  onEditSubtheme,
  onEditTheme,
  onDeleteTheme,
}: ThemeCardProps): JSX.Element {
  const colors = useTaxonomyColors();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingSubtheme, setIsAddingSubtheme] = useState(false);
  const [newSubthemeName, setNewSubthemeName] = useState('');
  const [newSubthemeDescription, setNewSubthemeDescription] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredSubtheme, setHoveredSubtheme] = useState<string | null>(null);
  const [editingSubtheme, setEditingSubtheme] = useState<string | null>(null);
  const [editSubthemeName, setEditSubthemeName] = useState('');
  const [editSubthemeDescription, setEditSubthemeDescription] = useState('');

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
      setIsExpanded(true); // Auto-expand to show the added subtheme
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsAddingSubtheme(false);
      setNewSubthemeName('');
      setNewSubthemeDescription('');
    }
  };

  const handleStartEditSubtheme = (subtheme: SubTheme) => {
    setEditingSubtheme(subtheme.name);
    setEditSubthemeName(subtheme.name);
    setEditSubthemeDescription(subtheme.description);
  };

  const handleSaveEditSubtheme = (originalName: string) => {
    if (editSubthemeName.trim() && onEditSubtheme) {
      onEditSubtheme(theme.name, originalName, {
        name: editSubthemeName.trim(),
        description: editSubthemeDescription.trim(),
      });
      setEditingSubtheme(null);
      setEditSubthemeName('');
      setEditSubthemeDescription('');
    }
  };

  const handleCancelEditSubtheme = () => {
    setEditingSubtheme(null);
    setEditSubthemeName('');
    setEditSubthemeDescription('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, originalName: string) => {
    if (e.key === 'Escape') {
      handleCancelEditSubtheme();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEditSubtheme(originalName);
    }
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        bgcolor: colors.background.card,
        borderRadius: 2,
        border: `1px solid ${colors.border.light}`,
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
            bgcolor: colors.background.subtle,
          },
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconButton
          size="small"
          sx={{
            p: 0.5,
            mr: 1,
            color: colors.text.secondary,
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
              color: colors.text.primary,
              lineHeight: 1.4,
            }}
          >
            {theme.name}
          </Typography>
          {theme.description && (
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: colors.text.secondary,
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
                  color: colors.text.muted,
                  '&:hover': {
                    color: colors.text.secondary,
                    bgcolor: colors.background.hover,
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
                  color: colors.text.muted,
                  '&:hover': {
                    color: colors.action.delete,
                    bgcolor: colors.action.deleteHover,
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
        <Box sx={{ borderTop: `1px solid ${colors.border.light}`, py: 1 }}>
          {theme.sub_themes?.map((subtheme) => (
            <Box
              key={subtheme.name}
              onMouseEnter={() => setHoveredSubtheme(subtheme.name)}
              onMouseLeave={() => setHoveredSubtheme(null)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                px: 2,
                py: 1,
                ml: 4,
                borderRadius: 1,
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  bgcolor: colors.background.subtle,
                },
              }}
            >
              {editingSubtheme === subtheme.name ? (
                // Inline edit form
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Subtheme name"
                    value={editSubthemeName}
                    onChange={(e) => setEditSubthemeName(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, subtheme.name)}
                    autoFocus
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: colors.background.input,
                        borderRadius: 1.5,
                        '&.Mui-focused fieldset': {
                          borderColor: colors.purple.main,
                        },
                      },
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                        color: colors.text.primary,
                        '&::placeholder': {
                          color: colors.text.muted,
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Description (optional)"
                    value={editSubthemeDescription}
                    onChange={(e) => setEditSubthemeDescription(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, subtheme.name)}
                    multiline
                    rows={2}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: colors.background.input,
                        borderRadius: 1.5,
                        '&.Mui-focused fieldset': {
                          borderColor: colors.purple.main,
                        },
                      },
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                        color: colors.text.primary,
                        '&::placeholder': {
                          color: colors.text.muted,
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleSaveEditSubtheme(subtheme.name)}
                      disabled={!editSubthemeName.trim()}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 1.5,
                        bgcolor: colors.purple.main,
                        color: '#ffffff',
                        '&:hover': {
                          bgcolor: colors.purple.hover,
                        },
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={handleCancelEditSubtheme}
                      sx={{
                        textTransform: 'none',
                        color: colors.text.secondary,
                        '&:hover': {
                          bgcolor: 'transparent',
                          color: colors.text.primary,
                        },
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                // Normal display
                <>
                  <BulletIcon
                    sx={{
                      fontSize: 8,
                      color: colors.text.muted,
                      mt: 0.75,
                      mr: 1.5,
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        color: colors.text.primary,
                        lineHeight: 1.4,
                      }}
                    >
                      {subtheme.name}
                    </Typography>
                    {subtheme.description && (
                      <Typography
                        sx={{
                          fontSize: '0.8125rem',
                          color: colors.text.secondary,
                          lineHeight: 1.4,
                        }}
                      >
                        {subtheme.description}
                      </Typography>
                    )}
                  </Box>
                  {/* Edit & Delete buttons - shown on hover */}
                  {hoveredSubtheme === subtheme.name && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {onEditSubtheme && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditSubtheme(subtheme);
                          }}
                          sx={{
                            p: 0.5,
                            color: colors.text.muted,
                            '&:hover': {
                              color: colors.text.secondary,
                              bgcolor: colors.background.hover,
                            },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                      {onRemoveSubtheme && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSubtheme(theme.name, subtheme.name);
                          }}
                          sx={{
                            p: 0.5,
                            color: colors.text.muted,
                            '&:hover': {
                              color: colors.action.delete,
                              bgcolor: colors.action.deleteHover,
                            },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Add Subtheme - Always visible */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${colors.border.light}`,
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
                  bgcolor: colors.background.input,
                  borderRadius: 1.5,
                  '&.Mui-focused fieldset': {
                    borderColor: colors.purple.main,
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  color: colors.text.primary,
                  '&::placeholder': {
                    color: colors.text.muted,
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
                  bgcolor: colors.background.input,
                  borderRadius: 1.5,
                  '&.Mui-focused fieldset': {
                    borderColor: colors.purple.main,
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  color: colors.text.primary,
                  '&::placeholder': {
                    color: colors.text.muted,
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
                  bgcolor: colors.purple.main,
                  color: '#ffffff',
                  '&:hover': {
                    bgcolor: colors.purple.hover,
                  },
                }}
              >
                Add
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setIsAddingSubtheme(false);
                  setNewSubthemeName('');
                  setNewSubthemeDescription('');
                }}
                sx={{
                  textTransform: 'none',
                  color: colors.text.secondary,
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: colors.text.primary,
                  },
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
              color: colors.text.muted,
              transition: 'color 0.15s ease',
              '&:hover': {
                color: colors.purple.main,
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
