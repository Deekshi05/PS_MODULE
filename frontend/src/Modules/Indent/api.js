import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';

function getAccessToken() {
  return localStorage.getItem('access_token') || '';
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

