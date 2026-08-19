// API base URL helper
// Resolves the backend base URL and ensures exactly one '/api' prefix
const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '');
export const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : 'http://localhost:5000/api';

/**
 * Normalizes endpoint paths to ensure clean routing without duplicate or missing '/api' prefix
 * e.g. '/auth/register'     -> '/auth/register'
 *      'auth/register'      -> '/auth/register'
 *      '/api/auth/register' -> '/auth/register'
 */
export function formatApiPath(endpoint = '') {
  let path = String(endpoint).trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path === '/api') {
    return '';
  }
  if (path.startsWith('/api/')) {
    return path.slice(4);
  }
  return path;
}

export async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (data) config.body = JSON.stringify(data);

  const url = `${API_BASE}${formatApiPath(endpoint)}`;
  const response = await fetch(url, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'API Request failed');
  }

  return result;
}

