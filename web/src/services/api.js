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

// ==================== AUTENTICAÇÃO ====================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me')
};

// ==================== DISPOSITIVOS ====================
export const devicesAPI = {
  list: (params) => api.get('/devices', { params }),
  get: (id) => api.get(`/devices/${id}`),
  getPosition: (id) => api.get(`/devices/${id}/position`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  share: (deviceId, expiration) => api.post('/devices/share', { deviceId, expiration }),
  updateAccumulators: (id, data) => api.put(`/devices/${id}/accumulators`, data)
};

// ==================== POSIÇÕES ====================
export const positionsAPI = {
  list: (params) => api.get('/positions', { params }),
  history: (deviceId, from, to) => api.get('/positions', { params: { deviceId, from, to } }),
  delete: (deviceId, from, to) => api.delete('/positions', { params: { deviceId, from, to } })
};

// ==================== GEOFENCES ====================
export const geofencesAPI = {
  list: (params) => api.get('/geofences', { params }),
  get: (id) => api.get(`/geofences/${id}`),
  create: (data) => api.post('/geofences', data),
  update: (id, data) => api.put(`/geofences/${id}`, data),
  delete: (id) => api.delete(`/geofences/${id}`)
};

// ==================== RELATÓRIOS ====================
export const reportsAPI = {
  getTrips: (params) => api.get('/reports/trips', { params }),
  getSummary: (params) => api.get('/reports/summary', { params }),
  getEvents: (params) => api.get('/reports/events', { params }),
  getRoute: (params) => api.get('/reports/route', { params }),
  getStops: (params) => api.get('/reports/stops', { params }),
  getGeofences: (params) => api.get('/reports/geofences', { params })
};

// ==================== DRIVERS ====================
export const driversAPI = {
  list: (params) => api.get('/drivers', { params }),
  get: (id) => api.get(`/drivers/${id}`),
  create: (data) => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
  delete: (id) => api.delete(`/drivers/${id}`)
};

// ==================== MAINTENANCE ====================
export const maintenanceAPI = {
  list: (params) => api.get('/maintenance', { params }),
  get: (id) => api.get(`/maintenance/${id}`),
  create: (data) => api.post('/maintenance', data),
  update: (id, data) => api.put(`/maintenance/${id}`, data),
  delete: (id) => api.delete(`/maintenance/${id}`)
};

// ==================== COMANDOS ====================
export const commandsAPI = {
  list: (params) => api.get('/commands', { params }),
  types: (deviceId) => api.get('/commands/types', { params: { deviceId } }),
  send: (data) => api.post('/commands/send', data),
  create: (data) => api.post('/commands', data),
  update: (id, data) => api.put(`/commands/${id}`, data),
  delete: (id) => api.delete(`/commands/${id}`)
};

// ==================== NOTIFICAÇÕES ====================
export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  types: () => api.get('/notifications/types'),
  create: (data) => api.post('/notifications', data),
  update: (id, data) => api.put(`/notifications/${id}`, data),
  delete: (id) => api.delete(`/notifications/${id}`),
  test: () => api.post('/notifications/test'),
  send: (notificator, data) => api.post(`/notifications/send/${notificator}`, data)
};

// ==================== PERMISSIONS ====================
export const permissionsAPI = {
  add: (data) => api.post('/permissions', data),
  remove: (data) => api.delete('/permissions', { data })
};

// ==================== CALENDARS ====================
export const calendarsAPI = {
  list: (params) => api.get('/calendars', { params }),
  get: (id) => api.get(`/calendars/${id}`),
  create: (data) => api.post('/calendars', data),
  update: (id, data) => api.put(`/calendars/${id}`, data),
  delete: (id) => api.delete(`/calendars/${id}`)
};

// ==================== ATTRIBUTES ====================
export const attributesAPI = {
  list: (params) => api.get('/attributes', { params }),
  create: (data) => api.post('/attributes', data),
  update: (id, data) => api.put(`/attributes/${id}`, data),
  delete: (id) => api.delete(`/attributes/${id}`)
};

// ==================== STATISTICS ====================
export const statisticsAPI = {
  get: (from, to) => api.get('/statistics', { params: { from, to } })
};

// ==================== ORDERS ====================
export const ordersAPI = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`)
};

// ==================== SERVIDOR ====================
export const serverAPI = {
  info: () => api.get('/server/info')
};

// ==================== USERS (admin) ====================
export const usersAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get('/users/' + id),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put('/users/' + id, data),
  delete: (id) => api.delete('/users/' + id)
};

// ==================== EVENTS ====================
export const eventsAPI = {
  list: (params) => api.get('/events', { params })
};

// ==================== GROUPS ====================
export const groupsAPI = {
  list: (params) => api.get('/groups', { params }),
  get: (id) => api.get('/groups/' + id),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put('/groups/' + id, data),
  delete: (id) => api.delete('/groups/' + id)
};

// ==================== SERVER ====================
export const geocodeAPI = {
  reverse: (lat, lon) => api.get('/server/geocode', { params: { lat, lon } }),
  timezones: () => api.get('/server/timezones')
};
