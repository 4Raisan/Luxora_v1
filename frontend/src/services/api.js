// Deployments may supply an explicit backend URL via VITE_API_URL.
// In production builds without VITE_API_URL, default to same-origin '/api'.
// In local Vite development, default to 'http://localhost:5000/api'.
export function resolveApiBase(envUrl = import.meta.env?.VITE_API_URL, isProd = import.meta.env?.PROD) {
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const clean = envUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  if (isProd) {
    return '/api';
  }
  return 'http://localhost:5000/api';
}

export const API_BASE = resolveApiBase();

export async function apiRequest(endpoint, method = 'GET', data = null, token = null, options = {}) {
  const isFormData = data instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.headers) Object.assign(headers, options.headers);

  const timeoutMs = options.timeout ?? 30000;
  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const config = {
    method,
    headers,
    signal: options.signal || controller.signal,
  };
  if (data) config.body = isFormData ? data : JSON.stringify(data);

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The server might still be processing. Please check your status before retrying.');
    }
    throw new Error(err.message || 'Network error: could not connect to server.');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();

  if (!response.ok) {
    const message = typeof result === 'object' && result?.error
      ? result.error
      : typeof result === 'string' && result.trim()
        ? result.trim()
        : `API request failed (${response.status})`;

    if (response.status === 401 || (response.status === 403 && /revoked|deactivated|invalid session|token/i.test(message))) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      } catch {}
      if (typeof window !== 'undefined' && window.location && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    throw new Error(message);
  }

  return result;
}
