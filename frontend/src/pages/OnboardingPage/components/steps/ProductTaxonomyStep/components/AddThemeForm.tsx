/**
 * AddThemeForm Component
 * Form for manually adding a new theme
 */

import { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { TAXONOMY_COLORS, TAXONOMY_TEXT } from '../constants';

interface AddThemeFormProps {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
  onGenerateDescription?: (name: string) => Promise<string>;
  isSubmitting?: boolean;
}

export function AddThemeForm({
  onSubmit,
  onCancel,
  onGenerateDescription,
  isSubmitting = false,
}: AddThemeFormProps): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim(), description.trim());
    }
  };

  const handleGenerateDescription = async () => {
    if (name.trim() && onGenerateDescription) {
      setIsGenerating(true);
      try {
        const generatedDescription = await onGenerateDescription(name.trim());
        setDescription(generatedDescription);
      } catch (error) {
        console.error('Failed to generate description:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Box
      sx={{
        bgcolor: TAXONOMY_COLORS.background.card,
        borderRadius: 2,
        border: `1px solid ${TAXONOMY_COLORS.border.light}`,
        p: 2.5,
      }}
    >
      {/* Name Input */}
      <TextField
        fullWidth
        placeholder={TAXONOMY_TEXT.addThemeForm.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        disabled={isSubmitting}
        InputProps={{
          sx: {
            color: '#1e293b',
          },
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: '#ffffff',
            '&.Mui-focused fieldset': {
              borderColor: TAXONOMY_COLORS.purple.main,
              borderWidth: 2,
            },
          },
          '& .MuiOutlinedInput-input': {
            fontWeight: 500,
            fontSize: '0.9375rem',
            color: '#1e293b !important',
            '&::placeholder': {
              color: '#94a3b8',
              opacity: 1,
            },
          },
        }}
      />

      {/* Description Input */}
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder={TAXONOMY_TEXT.addThemeForm.descriptionPlaceholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isSubmitting || isGenerating}
        InputProps={{
          sx: {
            color: '#1e293b',
          },
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: '#ffffff',
            '&.Mui-focused fieldset': {
              borderColor: TAXONOMY_COLORS.purple.main,
            },
          },
          '& .MuiOutlinedInput-input': {
            fontSize: '0.875rem',
            color: '#1e293b !important',
            '&::placeholder': {
              color: '#94a3b8',
              opacity: 1,
            },
          },
        }}
      />

      {/* Generate Description Button */}
      {onGenerateDescription && (
        <Button
          variant="text"
          startIcon={
            isGenerating ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
            )
          }
          onClick={handleGenerateDescription}
          disabled={!name.trim() || isGenerating || isSubmitting}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8125rem',
            color: TAXONOMY_COLORS.purple.main,
            mb: 2,
            p: 0,
            '&:hover': {
              bgcolor: 'transparent',
              textDecoration: 'underline',
            },
            '&:disabled': {
              color: TAXONOMY_COLORS.text.muted,
            },
          }}
        >
          {TAXONOMY_TEXT.addThemeForm.generateButton}
        </Button>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            bgcolor: TAXONOMY_COLORS.purple.main,
            borderRadius: 1.5,
            px: 2.5,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: TAXONOMY_COLORS.purple.hover,
            },
            '&:disabled': {
              bgcolor: TAXONOMY_COLORS.border.default,
            },
          }}
        >
          {isSubmitting ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            TAXONOMY_TEXT.addThemeForm.addButton
          )}
        </Button>
        <Typography
          onClick={onCancel}
          sx={{
            fontSize: '0.875rem',
            color: TAXONOMY_COLORS.text.secondary,
            cursor: 'pointer',
            '&:hover': {
              color: TAXONOMY_COLORS.text.primary,
              textDecoration: 'underline',
            },
          }}
        >
          {TAXONOMY_TEXT.addThemeForm.cancelButton}
        </Typography>
      </Box>
    </Box>
  );
}
