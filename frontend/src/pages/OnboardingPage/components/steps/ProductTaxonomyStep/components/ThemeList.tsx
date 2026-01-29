/**
 * ThemeList Component
 * Container for rendering theme cards
 */

import { Box } from '@mui/material';
import type { Theme, SubTheme } from '../../../types';
import { ThemeCard } from './ThemeCard';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface ThemeListProps {
  themes: Theme[];
  onAddSubtheme: (themeName: string, subtheme: SubTheme) => void;
  onRemoveSubtheme?: (themeName: string, subthemeName: string) => void;
  onEditSubtheme?: (themeName: string, subthemeName: string, updates: { name: string; description: string }) => void;
  onEditTheme?: (themeName: string, updates: { name: string; description: string }) => void;
  onDeleteTheme?: (themeName: string) => void;
}

export function ThemeList({
  themes,
  onAddSubtheme,
  onRemoveSubtheme,
  onEditSubtheme,
  onEditTheme,
  onDeleteTheme,
}: ThemeListProps): JSX.Element {
  const colors = useTaxonomyColors();

  return (
    <Box
      sx={{
        bgcolor: colors.purple.light,
        borderRadius: 2,
        border: `1px solid ${colors.purple.main}`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          maxHeight: 300, // Show approximately 3 themes at a time
          overflowY: 'auto',
          p: 2,
          // Hide scrollbar but keep scroll functionality
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          '&::-webkit-scrollbar': {
            display: 'none', // Chrome/Safari/Opera
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {themes.map((theme, index) => (
            <ThemeCard
              key={`${theme.name}-${index}`}
              theme={theme}
              onAddSubtheme={onAddSubtheme}
              onRemoveSubtheme={onRemoveSubtheme}
              onEditSubtheme={onEditSubtheme}
              onEditTheme={onEditTheme}
              onDeleteTheme={onDeleteTheme}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
