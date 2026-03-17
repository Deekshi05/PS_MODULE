const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';

export function getAccessToken() {
  return localStorage.getItem('access_token') || '';
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function apiFetch(path, { actingRole, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (actingRole) headers['X-Acting-Role'] = actingRole;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || JSON.stringify(data) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/ps/api/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'Login failed');
  setTokens(data);
  return data;
}

export async function getMe() {
  return apiFetch('/ps/api/me/', { method: 'GET' });
}

