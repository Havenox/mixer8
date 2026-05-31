/**
 * centralize environment configurations for the React SPA.
 * resolves the host/ip dynamically and safely appends the '/api' prefix.
 */

const getApiUrl = (): string => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Remove trailing slashes and conditionally append '/api' prefix safely
  return base.endsWith('/api') ? base : `${base.replace(/\/$/, '')}/api`;
};

export const API_URL = getApiUrl();
export const SERVER_URL = API_URL.replace('/api', '');
