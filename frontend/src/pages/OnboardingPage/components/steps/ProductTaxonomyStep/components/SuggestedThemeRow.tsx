/**
 * SuggestedThemeRow Component
 * Single AI suggestion row with checkboxes for theme and subthemes
 */

import { useState, useEffect } from 'react';
import { Box, Typography, Checkbox, Collapse } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import type { Theme } from '../../../types';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface SuggestedThemeRowProps {
  theme: Theme;
  onAddTheme: (theme: Theme) => void;
  onRemoveTheme: (themeName: string) => void;
  onAddSubtheme: (themeName: string, subtheme: { name: string; description: string; confidence: number }) => void;
  onRemoveSubtheme: (themeName: string, subthemeName: string) => void;
  isAdded: boolean;
  addedSubthemes?: string[];
}

export function SuggestedThemeRow({
  theme,
  onAddTheme,
  onRemoveTheme,
  onAddSubtheme,
  onRemoveSubtheme,
  isAdded,
  addedSubthemes = [],
}: SuggestedThemeRowProps): JSX.Element {
  const colors = useTaxonomyColors();
  const [isExpanded, setIsExpanded] = useState(false);

  // Track selected subthemes - all selected by default when not added
  const [selectedSubthemes, setSelectedSubthemes] = useState<Set<string>>(
    new Set(theme.sub_themes?.map(st => st.name) || [])
  );

  const subthemeCount = theme.sub_themes?.length || 0;

  // When theme is added, use addedSubthemes from props, otherwise use local state
  const effectiveSelectedSubthemes = isAdded
    ? new Set(addedSubthemes)
    : selectedSubthemes;
  const selectedCount = effectiveSelectedSubthemes.size;

  // Reset selected subthemes when theme changes
  useEffect(() => {
    setSelectedSubthemes(new Set(theme.sub_themes?.map(st => st.name) || []));
  }, [theme]);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleToggleSubtheme = (subtheme: { name: string; description: string; confidence?: number }) => {
    if (isAdded) {
      // Theme is already added - update the actual theme in the store
      if (addedSubthemes.includes(subtheme.name)) {
        onRemoveSubtheme(theme.name, subtheme.name);
      } else {
        onAddSubtheme(theme.name, {
          name: subtheme.name,
          description: subtheme.description || '',
          confidence: subtheme.confidence || 80,
        });
      }
    } else {
      // Theme not added yet - just update local selection
      setSelectedSubthemes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(subtheme.name)) {
          newSet.delete(subtheme.name);
        } else {
          newSet.add(subtheme.name);
        }
        return newSet;
      });
    }
  };

  const handleThemeToggle = () => {
    if (isAdded) {
      // Remove the theme
      onRemoveTheme(theme.name);
    } else {
      // Add the theme with only selected subthemes
      const filteredSubthemes = theme.sub_themes?.filter(
        st => selectedSubthemes.has(st.name)
      ) || [];

      const themeToAdd: Theme = {
        ...theme,
        sub_themes: filteredSubthemes,
      };
      onAddTheme(themeToAdd);
    }
  };

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${colors.border.light}`,
        transition: 'background-color 0.15s ease',
        '&:last-child': {
          borderBottom: 'none',
        },
        '&:hover': {
          bgcolor: 'rgba(124, 58, 237, 0.04)',
        },
      }}
    >
      {/* Main row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2,
        }}
      >
        <Box sx={{ flex: 1, mr: 2 }}>
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
                fontSize: '0.8125rem',
                color: colors.text.secondary,
                lineHeight: 1.4,
                mt: 0.25,
              }}
            >
              {theme.description}
            </Typography>
          )}
          {subthemeCount > 0 && (
            <Box
              onClick={handleToggleExpand}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: colors.purple.main,
                  fontWeight: 500,
                }}
              >
                {selectedCount}/{subthemeCount} {TAXONOMY_TEXT.aiSuggestions.subthemesIncluded}
              </Typography>
              {isExpanded ? (
                <ExpandLessIcon sx={{ fontSize: 16, color: colors.purple.main }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16, color: colors.purple.main }} />
              )}
            </Box>
          )}
        </Box>

        <Checkbox
          checked={isAdded}
          onChange={handleThemeToggle}
          sx={{
            p: 0.5,
            color: colors.text.muted,
            '&.Mui-checked': {
              color: colors.purple.main,
            },
          }}
        />
      </Box>

      {/* Expandable subthemes with checkboxes */}
      {subthemeCount > 0 && (
        <Collapse in={isExpanded}>
          <Box
            sx={{
              px: 2,
              pb: 1.5,
              pt: 0.5,
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(124, 58, 237, 0.08)',
                borderRadius: 1.5,
                p: 1.5,
              }}
            >
              {theme.sub_themes?.map((subtheme, index) => (
                <Box
                  key={`${subtheme.name}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    py: 0.75,
                    borderBottom: index < subthemeCount - 1 ? `1px solid ${colors.border.light}` : 'none',
                  }}
                >
                  <Checkbox
                    checked={effectiveSelectedSubthemes.has(subtheme.name)}
                    onChange={() => handleToggleSubtheme(subtheme)}
                    size="small"
                    sx={{
                      p: 0,
                      mr: 1,
                      mt: 0.25,
                      color: colors.text.muted,
                      '&.Mui-checked': {
                        color: colors.purple.main,
                      },
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      sx={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: effectiveSelectedSubthemes.has(subtheme.name) ? colors.text.primary : colors.text.muted,
                      }}
                    >
                      {subtheme.name}
                    </Typography>
                    {subtheme.description && (
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: colors.text.secondary,
                          mt: 0.25,
                        }}
                      >
                        {subtheme.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
