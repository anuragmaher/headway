/**
 * ThemeReviewList Component
 * Premium checklist design with expandable dropdowns
 * Hidden scrollbar with scroll functionality
 */

import { Box, Typography, Checkbox, Collapse, IconButton } from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import type { Theme } from '../../types';
import { useOnboardingColors } from '../../hooks/useOnboardingColors';

interface ThemeReviewListProps {
  themes: Theme[];
  selectedThemes: string[];
  onToggleTheme: (themeName: string) => void;
  onRegenerate?: () => void;
}

interface ThemeRowProps {
  theme: Theme;
  selected: boolean;
  onToggle: () => void;
  isLast: boolean;
}

function ThemeRow({ theme, selected, onToggle, isLast }: ThemeRowProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasSubThemes = theme.sub_themes && theme.sub_themes.length > 0;
  const colors = useOnboardingColors();

  return (
    <Box
      sx={{
        borderBottom: isLast ? 'none' : `1px solid ${colors.background.hover}`,
      }}
    >
      {/* Main row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1.5,
          px: 2,
          gap: 1.5,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          bgcolor: selected ? colors.background.selected : 'transparent',
          '&:hover': {
            bgcolor: selected ? colors.background.selectedHover : colors.background.subtle,
          },
        }}
        onClick={onToggle}
      >
        <Checkbox
          checked={selected}
          size="small"
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          sx={{
            p: 0,
            color: colors.border.default,
            '&.Mui-checked': {
              color: colors.primary.main,
            },
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: selected ? colors.chip.selected.text : colors.text.primary,
              lineHeight: 1.4,
            }}
          >
            {theme.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: colors.text.secondary,
              lineHeight: 1.3,
              mt: 0.25,
            }}
          >
            {theme.description}
          </Typography>
        </Box>

        {hasSubThemes && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: expanded ? colors.border.default : colors.background.hover,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: colors.border.default,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: colors.text.secondary,
              }}
            >
              {theme.sub_themes.length}
            </Typography>
            {expanded ? (
              <ArrowUpIcon sx={{ fontSize: 16, color: colors.text.secondary }} />
            ) : (
              <ArrowDownIcon sx={{ fontSize: 16, color: colors.text.secondary }} />
            )}
          </Box>
        )}
      </Box>

      {/* Expandable sub-themes */}
      <Collapse in={expanded}>
        <Box
          sx={{
            mx: 2,
            mb: 1.5,
            ml: 5.5,
            bgcolor: colors.background.subtle,
            borderRadius: 1.5,
            border: `1px solid ${colors.border.input}`,
            overflow: 'hidden',
          }}
        >
          {theme.sub_themes?.map((sub, idx) => (
            <Box
              key={idx}
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: idx < theme.sub_themes.length - 1 ? `1px solid ${colors.border.input}` : 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: colors.text.muted,
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: colors.text.primary,
                    lineHeight: 1.4,
                  }}
                >
                  {sub.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    color: colors.text.secondary,
                    lineHeight: 1.4,
                  }}
                >
                  {sub.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export function ThemeReviewList({
  themes,
  selectedThemes,
  onToggleTheme,
  onRegenerate,
}: ThemeReviewListProps): JSX.Element {
  const colors = useOnboardingColors();
  const themeNames = themes.map((t) => t.name);
  const validSelectedThemes = selectedThemes.filter((name) => themeNames.includes(name));
  const selectedCount = validSelectedThemes.length;
  const totalCount = themes.length;

  const handleToggleAll = () => {
    const allSelected = selectedCount === totalCount && totalCount > 0;
    if (allSelected) {
      themes.forEach((t) => {
        if (validSelectedThemes.includes(t.name)) {
          onToggleTheme(t.name);
        }
      });
    } else {
      themes.forEach((t) => {
        if (!validSelectedThemes.includes(t.name)) {
          onToggleTheme(t.name);
        }
      });
    }
  };

  return (
    <Box
      sx={{
        bgcolor: colors.background.paper,
        borderRadius: 2.5,
        border: `1px solid ${colors.border.input}`,
        boxShadow: colors.shadow.card,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 260px)',
        minHeight: 350,
        width: '100%',
        maxWidth: 520,
      }}
    >
      {/* Header - Fixed */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          bgcolor: colors.background.subtle,
          borderBottom: `1px solid ${colors.border.input}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: colors.primary.lighter,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CategoryIcon sx={{ fontSize: 16, color: colors.primary.main }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: colors.text.primary,
                lineHeight: 1.2,
              }}
            >
              Product Themes
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: colors.text.secondary,
                lineHeight: 1.2,
              }}
            >
              {selectedCount} of {totalCount} selected
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            onClick={handleToggleAll}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: colors.background.hover,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: colors.border.default,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: colors.text.secondary,
              }}
            >
              {selectedCount === totalCount && totalCount > 0 ? 'Clear all' : 'Select all'}
            </Typography>
          </Box>
          {onRegenerate && (
            <IconButton
              size="small"
              onClick={onRegenerate}
              sx={{
                p: 0.75,
                color: colors.text.secondary,
                bgcolor: colors.background.hover,
                '&:hover': {
                  bgcolor: colors.border.default,
                },
              }}
              title="Regenerate themes"
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Theme list - Scrollable with hidden scrollbar */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          // Hide scrollbar but keep scroll functionality
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          '&::-webkit-scrollbar': {
            display: 'none', // Chrome/Safari/Opera
          },
        }}
      >
        {themes.map((theme, index) => (
          <ThemeRow
            key={index}
            theme={theme}
            selected={validSelectedThemes.includes(theme.name)}
            onToggle={() => onToggleTheme(theme.name)}
            isLast={index === themes.length - 1}
          />
        ))}
      </Box>

      {/* Footer hint - Fixed */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: colors.background.subtle,
          borderTop: `1px solid ${colors.border.input}`,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6875rem',
            color: colors.text.muted,
            textAlign: 'center',
          }}
        >
          Click the number badge to expand features
        </Typography>
      </Box>
    </Box>
  );
}
