import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API de autenticação
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me')
};

// API de dispositivos
export const devicesAPI = {
  list: (params) => api.get('/devices', { params }),
  get: (id) => api.get(`/devices/${id}`),
  getPosition: (id) => api.get(`/devices/${id}/position`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`)
};

// API de posições
export const positionsAPI = {
  list: () => api.get('/positions'),
  history: (deviceId, from, to) => api.get(`/positions/${deviceId}`, { params: { from, to } })
};

// API de geofences
export const geofencesAPI = {
  list: () => api.get('/geofences'),
  get: (id) => api.get(`/geofences/${id}`),
  create: (data) => api.post('/geofences', data),
  update: (id, data) => api.put(`/geofences/${id}`, data),
  delete: (id) => api.delete(`/geofences/${id}`)
};

// API de relatórios
export const reportsAPI = {
  getTrips: (params) => api.get('/reports/trips', { params }),
  getSummary: (params) => api.get('/reports/summary', { params }),
  getEvents: (params) => api.get('/reports/events', { params }),
  getRoute: (params) => api.get('/reports/route', { params }),
  getStops: (params) => api.get('/reports/stops', { params }),
  getGeofences: (params) => api.get('/reports/geofences', { params })
};

// API do servidor
export const serverAPI = {
  info: () => api.get('/server/info')
};
