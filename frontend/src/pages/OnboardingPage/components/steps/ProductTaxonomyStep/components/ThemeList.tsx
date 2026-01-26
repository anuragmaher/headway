/**
 * ThemeList Component
 * Container for rendering theme cards
 */

import { Box } from '@mui/material';
import type { Theme, SubTheme } from '../../../types';
import { ThemeCard } from './ThemeCard';

interface ThemeListProps {
  themes: Theme[];
  onAddSubtheme: (themeName: string, subtheme: SubTheme) => void;
  onEditTheme?: (themeName: string) => void;
  onDeleteTheme?: (themeName: string) => void;
}

export function ThemeList({ themes, onAddSubtheme, onEditTheme, onDeleteTheme }: ThemeListProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {themes.map((theme, index) => (
        <ThemeCard
          key={`${theme.name}-${index}`}
          theme={theme}
          onAddSubtheme={onAddSubtheme}
          onEditTheme={onEditTheme}
          onDeleteTheme={onDeleteTheme}
        />
      ))}
    </Box>
  );
}
