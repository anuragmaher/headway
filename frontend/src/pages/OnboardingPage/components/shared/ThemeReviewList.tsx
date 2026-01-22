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

  return (
    <Box
      sx={{
        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
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
          bgcolor: selected ? '#f0f9ff' : 'transparent',
          '&:hover': {
            bgcolor: selected ? '#e0f2fe' : '#f8fafc',
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
            color: '#d1d5db',
            '&.Mui-checked': {
              color: '#3b82f6',
            },
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: selected ? '#1d4ed8' : '#1e293b',
              lineHeight: 1.4,
            }}
          >
            {theme.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: '#64748b',
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
              bgcolor: expanded ? '#e2e8f0' : '#f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: '#e2e8f0',
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: '#64748b',
              }}
            >
              {theme.sub_themes.length}
            </Typography>
            {expanded ? (
              <ArrowUpIcon sx={{ fontSize: 16, color: '#64748b' }} />
            ) : (
              <ArrowDownIcon sx={{ fontSize: 16, color: '#64748b' }} />
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
            bgcolor: '#f8fafc',
            borderRadius: 1.5,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {theme.sub_themes?.map((sub, idx) => (
            <Box
              key={idx}
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: idx < theme.sub_themes.length - 1 ? '1px solid #e2e8f0' : 'none',
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
                  bgcolor: '#94a3b8',
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#334155',
                    lineHeight: 1.4,
                  }}
                >
                  {sub.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    color: '#64748b',
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
        bgcolor: 'white',
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
          bgcolor: '#fafbfc',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CategoryIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#1e293b',
                lineHeight: 1.2,
              }}
            >
              Product Themes
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: '#64748b',
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
              bgcolor: '#f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: '#e2e8f0',
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: '#475569',
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
                color: '#64748b',
                bgcolor: '#f1f5f9',
                '&:hover': {
                  bgcolor: '#e2e8f0',
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
          bgcolor: '#fafbfc',
          borderTop: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6875rem',
            color: '#94a3b8',
            textAlign: 'center',
          }}
        >
          Click the number badge to expand features
        </Typography>
      </Box>
    </Box>
  );
}
