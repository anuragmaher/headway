/**
 * SuggestDocsPanel Component
 * URL input panel for AI suggestions
 */

import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { TAXONOMY_TEXT } from '../constants';
import { useTaxonomyColors } from '../hooks/useTaxonomyColors';

interface SuggestDocsPanelProps {
  onAnalyze: (url: string) => void;
  onClose: () => void;
  isAnalyzing: boolean;
}

export function SuggestDocsPanel({
  onAnalyze,
  onClose,
  isAnalyzing,
}: SuggestDocsPanelProps): JSX.Element {
  const colors = useTaxonomyColors();
  const [url, setUrl] = useState('');

  const handleAnalyze = () => {
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && url.trim() && !isAnalyzing) {
      handleAnalyze();
    }
  };

  return (
    <Box
      sx={{
        bgcolor: colors.purple.light,
        borderRadius: 2,
        border: `1px solid ${colors.purple.main}`,
        p: 2.5,
        mb: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon
            sx={{
              fontSize: 20,
              color: colors.purple.main,
            }}
          />
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: colors.purple.main,
            }}
          >
            {TAXONOMY_TEXT.suggestPanel.title}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            p: 0.5,
            color: colors.text.secondary,
            '&:hover': {
              color: colors.text.primary,
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Description */}
      <Typography
        sx={{
          fontSize: '0.8125rem',
          color: colors.text.secondary,
          mb: 2,
        }}
      >
        {TAXONOMY_TEXT.suggestPanel.description}
      </Typography>

      {/* URL Input */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={TAXONOMY_TEXT.suggestPanel.placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAnalyzing}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LanguageIcon
                  sx={{ fontSize: 18, color: colors.text.muted }}
                />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: colors.background.card,
              borderRadius: 1.5,
              '&.Mui-focused fieldset': {
                borderColor: colors.purple.main,
              },
            },
            '& .MuiOutlinedInput-input': {
              color: colors.text.primary,
              '&::placeholder': {
                color: colors.text.muted,
                opacity: 1,
              },
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleAnalyze}
          disabled={!url.trim() || isAnalyzing}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            bgcolor: colors.purple.main,
            borderRadius: 1.5,
            px: 2.5,
            whiteSpace: 'nowrap',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: colors.purple.hover,
            },
            '&:disabled': {
              bgcolor: colors.border.default,
            },
          }}
        >
          {TAXONOMY_TEXT.suggestPanel.analyzeButton}
        </Button>
      </Box>
    </Box>
  );
}
