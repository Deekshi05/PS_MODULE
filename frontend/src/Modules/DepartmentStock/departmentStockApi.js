import axios from 'axios';
import { getAccessToken } from '../../api';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';
const api = axios.create({
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

api.interceptors.request.use((config) => {
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
  const { data } = await api.get('/me/');
  return data;
}

export async function fetchStockList() {
  const { data } = await api.get('/stock/');
  return data;
}

export async function fetchAvailableStockList() {
  const { data } = await api.get('/stock/available/');
  return data;
}

export async function fetchRequestList() {
  const { data } = await api.get('/requests/');
  return data;
}

export async function createTransferRequest(stockId, requestedFrom, requestedQuantity) {
  try {
    const { data } = await api.post('/request/', {
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
  const { data } = await api.post(`/request/${requestId}/approve/`);
  return data;
}

export async function rejectTransferRequest(requestId) {
  const { data } = await api.post(`/request/${requestId}/reject/`);
  return data;
}
