// API base URL — configurable via VITE_API_URL in frontend/.env
// Falls back to the relative '/api' path so the Vite dev proxy and the
// Docker production image (Express serves both) work without extra config.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (data) config.body = JSON.stringify(data);

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'API Request failed');
  }

  return result;
}
