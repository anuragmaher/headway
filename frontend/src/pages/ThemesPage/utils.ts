/**
 * Utility functions for ThemesPage
 */

import { Feature } from './types';

export const getUrgencyColor = (urgency: string): 'error' | 'warning' | 'success' | 'default' => {
  switch (urgency.toLowerCase()) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'success';
    default: return 'default';
  }
};

export const getStatusColor = (status: string): 'info' | 'warning' | 'success' | 'default' => {
  switch (status.toLowerCase()) {
    case 'new': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    default: return 'default';
  }
};

export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#4caf50'; // Green
  if (confidence >= 0.5) return '#ff9800'; // Orange
  return '#f44336'; // Red
};

export const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
};

export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
};

export const getThemeValidationConfidence = (feature: Feature): number | null => {
  return feature.ai_metadata?.theme_validation?.confidence ?? null;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};
