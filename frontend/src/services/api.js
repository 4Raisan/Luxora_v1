// API base URL helper
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (data) config.body = isFormData ? data : JSON.stringify(data);

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(result.error || 'API Request failed');
  }

  return result;
}
