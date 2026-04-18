import axios from 'axios';

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

function authHeaders(actingRole) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (actingRole) headers['X-Acting-Role'] = actingRole;
  return headers;
}

function throwAxiosError(err) {
  const detail = err?.response?.data?.detail;
  const message = detail || err?.message || `HTTP ${err?.response?.status ?? 'ERR'}`;
  throw new Error(message);
}

const client = axios.create({
  baseURL: API_BASE,
});

// Reads
export async function readIndents({ actingRole }) {
  try {
    const res = await client.get('/ps/api/indents/', { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function readDecisions({ actingRole }) {
  try {
    const res = await client.get('/ps/api/indents/decisions/', { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function readStockBreakdown({ actingRole, indentId }) {
  try {
    const res = await client.get(`/ps/api/indents/${indentId}/stock-breakdown/`, {
      headers: authHeaders(actingRole),
    });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function readProcurementReady({ actingRole }) {
  try {
    const res = await client.get('/ps/api/indents/procurement-ready/', { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

// Writes
export async function writeCreateIndent({ actingRole, payload }) {
  try {
    const res = await client.post('/ps/api/indents/', payload, { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function writeHodAction({ actingRole, indentId, payload }) {
  try {
    const res = await client.post(`/ps/api/indents/${indentId}/hod-action/`, payload, {
      headers: authHeaders(actingRole),
    });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function writeCheckStock({ actingRole, indentId }) {
  try {
    const res = await client.post(`/ps/api/indents/${indentId}/check-stock/`, {}, { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function writeCreateStockEntry({ actingRole, indentId, payload }) {
  try {
    const res = await client.post(`/ps/api/indents/${indentId}/create-stock-entry/`, payload, {
      headers: authHeaders(actingRole),
    });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function readPSAdminCategories({ actingRole }) {
  try {
    const res = await client.get('/ps/api/indents/ps-admin-categories/', { headers: authHeaders(actingRole) });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function writePSAdminAction({ actingRole, indentId, payload }) {
  try {
    const res = await client.post(`/ps/api/indents/${indentId}/ps-admin-action/`, payload, {
      headers: authHeaders(actingRole),
    });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

export async function writeConfirmDelivery({ actingRole, indentId }) {
  try {
    const res = await client.post(`/ps/api/indents/${indentId}/confirm-delivery/`, {}, {
      headers: authHeaders(actingRole),
    });
    return res.data;
  } catch (err) {
    throwAxiosError(err);
  }
}

const departmentApi = axios.create({
  baseURL: `${API_BASE}/ps/api`,
  headers: { 'Content-Type': 'application/json' },
});

export function getActingRole() {
  if (typeof window !== 'undefined' && window.user?.role) {
    return window.user.role;
  }
  return localStorage.getItem('acting_role') || '';
}

export function getUserRole() {
  const role = getActingRole();
  if (typeof role === 'string' && role.startsWith('depadmin_')) {
    return role;
  }
  return localStorage.getItem('user_role') || '';
}

export function getDepartmentFromRole(role) {
  return typeof role === 'string' && role.startsWith('depadmin_') ? role.replace('depadmin_', 'dep_') : '';
}

departmentApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  const actingRole = getActingRole();
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (actingRole) {
    config.headers['X-Acting-Role'] = actingRole;
  }
  return config;
});

export async function fetchMe() {
  const { data } = await departmentApi.get('/me/');
  return data;
}

export async function fetchStockList() {
  const { data } = await departmentApi.get('/stock/');
  return data;
}

export async function fetchAvailableStockList() {
  const { data } = await departmentApi.get('/stock/available/');
  return data;
}

export async function fetchRequestList() {
  const { data } = await departmentApi.get('/requests/');
  return data;
}

export async function createTransferRequest(stockId, requestedFrom, requestedQuantity) {
  try {
    const { data } = await departmentApi.post('/request/', {
      stock_id: stockId,
      requested_from: requestedFrom,
      requested_quantity: requestedQuantity,
    });
    return data;
  } catch (error) {
    const responseData = error?.response?.data;
    let message = error?.message || 'Request failed.';
    if (responseData) {
      if (typeof responseData === 'string') {
        message = responseData;
      } else if (responseData.detail) {
        message = responseData.detail;
      } else if (responseData.requested_from) {
        message = Array.isArray(responseData.requested_from)
          ? responseData.requested_from.join(' ')
          : responseData.requested_from;
      } else if (responseData.requested_quantity) {
        message = Array.isArray(responseData.requested_quantity)
          ? responseData.requested_quantity.join(' ')
          : responseData.requested_quantity;
      } else {
        message = JSON.stringify(responseData);
      }
    }
    throw new Error(message);
  }
}

export async function approveTransferRequest(requestId) {
  const { data } = await departmentApi.post(`/request/${requestId}/approve/`);
  return data;
}

export async function rejectTransferRequest(requestId) {
  const { data } = await departmentApi.post(`/request/${requestId}/reject/`);
  return data;
}

