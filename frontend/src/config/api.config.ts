/**
 * API Configuration
 * Centralized API URL configuration using environment variables
 */

// Get API base URL from environment, removing trailing slash
const envApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = envApiUrl
  ? envApiUrl.replace(/\/$/, '') // Remove trailing slash
  : (import.meta.env.PROD ? '' : 'http://localhost:8000');
