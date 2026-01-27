/**
 * ProductTaxonomyStep Component
 * Step 1: Theme Taxonomy - manage themes and subthemes
 */

import { useState } from 'react';
import { Box, Fade } from '@mui/material';
import { useOnboardingStore } from '../../../store/onboardingStore';
import { useTaxonomyGeneration } from '../../../hooks/useTaxonomyGeneration';
import type { Theme, SubTheme } from '../../../types';

import { TaxonomyHeader } from './components/TaxonomyHeader';
import { EmptyState } from './components/EmptyState';
import { ThemeList } from './components/ThemeList';
import { SuggestDocsPanel } from './components/SuggestDocsPanel';
import { AISuggestionsPanel } from './components/AISuggestionsPanel';
import { AddThemeForm } from './components/AddThemeForm';

type ViewMode = 'default' | 'add-theme';

export function ProductTaxonomyStep(): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [showSuggestPanel, setShowSuggestPanel] = useState(false);
  const [suggestionUrl, setSuggestionUrl] = useState('');

  // Store state
  const { themes } = useOnboardingStore((state) => state.taxonomyData);
  const addTheme = useOnboardingStore((state) => state.addTheme);
  const removeTheme = useOnboardingStore((state) => state.removeTheme);
  const addSubthemeToTheme = useOnboardingStore((state) => state.addSubthemeToTheme);
  const removeSubthemeFromTheme = useOnboardingStore((state) => state.removeSubthemeFromTheme);
  const updateSubthemeInTheme = useOnboardingStore((state) => state.updateSubthemeInTheme);
  const clearAISuggestions = useOnboardingStore((state) => state.clearAISuggestions);

  // AI suggestions
  const {
    generate,
    isGenerating,
    themes: aiSuggestions,
  } = useTaxonomyGeneration();

  const hasThemes = themes.length > 0;
  const hasAISuggestions = aiSuggestions.length > 0;
  const showAISuggestionsPanel = showSuggestPanel && (isGenerating || hasAISuggestions);

  // Track which AI suggestions have been added
  const addedThemeNames = themes.map((t) => t.name);

  const handleAddTheme = () => {
    setViewMode('add-theme');
    setShowSuggestPanel(false);
  };

  const handleSuggestFromDocs = () => {
    setShowSuggestPanel(true);
    setViewMode('default');
  };

  const handleAnalyzeDocs = (url: string) => {
    setSuggestionUrl(url);
    generate(url);
  };

  const handleCloseSuggestPanel = () => {
    setShowSuggestPanel(false);
    setSuggestionUrl('');
    clearAISuggestions();
  };

  const handleAddThemeFromForm = (name: string, description: string) => {
    const newTheme: Theme = {
      name,
      description,
      confidence: 100,
      sub_themes: [],
    };
    addTheme(newTheme);
    setViewMode('default');
  };

  const handleAddThemeFromSuggestion = (theme: Theme) => {
    addTheme(theme);
  };

  const handleAddSubtheme = (themeName: string, subtheme: SubTheme) => {
    addSubthemeToTheme(themeName, subtheme);
  };

  const handleRemoveSubtheme = (themeName: string, subthemeName: string) => {
    removeSubthemeFromTheme(themeName, subthemeName);
  };

  const handleEditSubtheme = (themeName: string, subthemeName: string, updates: { name: string; description: string }) => {
    updateSubthemeInTheme(themeName, subthemeName, updates);
  };

  const handleDeleteTheme = (themeName: string) => {
    removeTheme(themeName);
  };

  const handleEditTheme = (themeName: string) => {
    // TODO: Implement edit theme functionality
    console.log('Edit theme:', themeName);
  };

  const handleCancelAddTheme = () => {
    setViewMode('default');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <TaxonomyHeader
        onAddTheme={handleAddTheme}
        onSuggestFromDocs={handleSuggestFromDocs}
        isAddDisabled={viewMode === 'add-theme'}
        isSuggestDisabled={showSuggestPanel}
      />

      {/* Suggest Docs Panel (URL Input) */}
      {showSuggestPanel && !showAISuggestionsPanel && (
        <Fade in timeout={200}>
          <Box>
            <SuggestDocsPanel
              onAnalyze={handleAnalyzeDocs}
              onClose={handleCloseSuggestPanel}
              isAnalyzing={isGenerating}
            />
          </Box>
        </Fade>
      )}

      {/* AI Suggestions Panel (Loading + Results) */}
      {showAISuggestionsPanel && (
        <Fade in timeout={200}>
          <Box>
            <AISuggestionsPanel
              url={suggestionUrl}
              isLoading={isGenerating}
              suggestions={aiSuggestions}
              addedThemeNames={addedThemeNames}
              onAddTheme={handleAddThemeFromSuggestion}
              onClose={handleCloseSuggestPanel}
            />
          </Box>
        </Fade>
      )}

      {/* Add Theme Form */}
      {viewMode === 'add-theme' && (
        <Fade in timeout={200}>
          <Box sx={{ mb: 2 }}>
            <AddThemeForm
              onSubmit={handleAddThemeFromForm}
              onCancel={handleCancelAddTheme}
            />
          </Box>
        </Fade>
      )}

      {/* Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Empty State */}
        {!hasThemes && viewMode !== 'add-theme' && (
          <Fade in timeout={200}>
            <Box>
              <EmptyState />
            </Box>
          </Fade>
        )}

        {/* Theme List */}
        {hasThemes && (
          <Fade in timeout={200}>
            <Box>
              <ThemeList
                themes={themes}
                onAddSubtheme={handleAddSubtheme}
                onRemoveSubtheme={handleRemoveSubtheme}
                onEditSubtheme={handleEditSubtheme}
                onEditTheme={handleEditTheme}
                onDeleteTheme={handleDeleteTheme}
              />
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
}

export default ProductTaxonomyStep;
