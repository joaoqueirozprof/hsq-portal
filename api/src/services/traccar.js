/**
 * Cliente robusto para API do Traccar
 * Usa Bearer Token para autenticação sem precisar fazer login no Traccar
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class TraccarClient {
  constructor(config) {
    this.baseURL = config.traccarUrl;
    this.token = config.traccarToken;
    this.timeout = config.timeout || 30000;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Interceptor para logging de requisições
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Traccar API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para tratamento de erros
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.error(`[Traccar API Error] ${error.response.status}:`, error.response.data);
        } else if (error.request) {
          console.error('[Traccar API Error] No response received:', error.message);
        } else {
          console.error('[Traccar API Error]', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== Dispositivos ====================

  async getDevices(params = {}) {
    const response = await this.client.get('/api/devices', { params });
    return response.data;
  }

  async getDevice(id) {
    const response = await this.client.get(`/api/devices/${id}`);
    return response.data;
  }

  async createDevice(data) {
    const response = await this.client.post('/api/devices', data);
    return response.data;
  }

  async updateDevice(id, data) {
    const response = await this.client.put(`/api/devices/${id}`, data);
    return response.data;
  }

  async deleteDevice(id) {
    await this.client.delete(`/api/devices/${id}`);
  }

  // ==================== Posições ====================

  async getPositions(deviceId, from, to) {
    const params = { deviceId };
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await this.client.get('/api/positions', { params });
    return response.data;
  }

  async getLatestPosition(deviceId) {
    const response = await this.client.get(`/api/devices/${deviceId}/position`);
    return response.data;
  }

  // ==================== Grupos ====================

  async getGroups() {
    const response = await this.client.get('/api/groups');
    return response.data;
  }

  async getGroup(id) {
    const response = await this.client.get(`/api/groups/${id}`);
    return response.data;
  }

  async createGroup(data) {
    const response = await this.client.post('/api/groups', data);
    return response.data;
  }

  async updateGroup(id, data) {
    const response = await this.client.put(`/api/groups/${id}`, data);
    return response.data;
  }

  async deleteGroup(id) {
    await this.client.delete(`/api/groups/${id}`);
  }

  // ==================== Usuários ====================

  async getUsers() {
    const response = await this.client.get('/api/users');
    return response.data;
  }

  async getUser(id) {
    const response = await this.client.get(`/api/users/${id}`);
    return response.data;
  }

  async createUser(data) {
    const response = await this.client.post('/api/users', data);
    return response.data;
  }

  async updateUser(id, data) {
    const response = await this.client.put(`/api/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id) {
    await this.client.delete(`/api/users/${id}`);
  }

  // ==================== Geofences ====================

  async getGeofences(params = {}) {
    const response = await this.client.get('/api/geofences', { params });
    return response.data;
  }

  async getGeofence(id) {
    const response = await this.client.get(`/api/geofences/${id}`);
    return response.data;
  }

  async createGeofence(data) {
    const response = await this.client.post('/api/geofences', data);
    return response.data;
  }

  async updateGeofence(id, data) {
    const response = await this.client.put(`/api/geofences/${id}`, data);
    return response.data;
  }

  async deleteGeofence(id) {
    await this.client.delete(`/api/geofences/${id}`);
  }

  // ==================== Motoristas ====================

  async getDrivers() {
    const response = await this.client.get('/api/drivers');
    return response.data;
  }

  async getDriver(id) {
    const response = await this.client.get(`/api/drivers/${id}`);
    return response.data;
  }

  async createDriver(data) {
    const response = await this.client.post('/api/drivers', data);
    return response.data;
  }

  async updateDriver(id, data) {
    const response = await this.client.put(`/api/drivers/${id}`, data);
    return response.data;
  }

  async deleteDriver(id) {
    await this.client.delete(`/api/drivers/${id}`);
  }

  // ==================== Manutenção ====================

  async getMaintenances(params = {}) {
    const response = await this.client.get('/api/maintenances', { params });
    return response.data;
  }

  async getMaintenance(id) {
    const response = await this.client.get(`/api/maintenances/${id}`);
    return response.data;
  }

  async createMaintenance(data) {
    const response = await this.client.post('/api/maintenances', data);
    return response.data;
  }

  async updateMaintenance(id, data) {
    const response = await this.client.put(`/api/maintenances/${id}`, data);
    return response.data;
  }

  async deleteMaintenance(id) {
    await this.client.delete(`/api/maintenances/${id}`);
  }

  // ==================== Eventos ====================

  async getEvents(params = {}) {
    const response = await this.client.get('/api/events', { params });
    return response.data;
  }

  async getEvent(id) {
    const response = await this.client.get(`/api/events/${id}`);
    return response.data;
  }

  // ==================== Relatórios ====================

  async getRouteReport(deviceId, from, to) {
    const response = await this.client.get('/api/reports/route', {
      params: { deviceId, from, to }
    });
    return response.data;
  }

  async getEventsReport(params) {
    const response = await this.client.get('/api/reports/events', { params });
    return response.data;
  }

  async getGeofencesReport(params) {
    const response = await this.client.get('/api/reports/geofences', { params });
    return response.data;
  }

  async getSummaryReport(params) {
    const response = await this.client.get('/api/reports/summary', { params });
    return response.data;
  }

  async getTripsReport(params) {
    const response = await this.client.get('/api/reports/trips', { params });
    return response.data;
  }

  async getStopsReport(params) {
    const response = await this.client.get('/api/reports/stops', { params });
    return response.data;
  }

  // ==================== Comandos ====================

  async sendCommand(deviceId, type, attributes = {}) {
    const command = {
      deviceId,
      type,
      attributes
    };
    const response = await this.client.post('/api/commands', command);
    return response.data;
  }

  async getCommands() {
    const response = await this.client.get('/api/commands');
    return response.data;
  }

  // ==================== Notificações ====================

  async getNotifications() {
    const response = await this.client.get('/api/notifications');
    return response.data;
  }

  async createNotification(data) {
    const response = await this.client.post('/api/notifications', data);
    return response.data;
  }

  async updateNotification(id, data) {
    const response = await this.client.put(`/api/notifications/${id}`, data);
    return response.data;
  }

  async deleteNotification(id) {
    await this.client.delete(`/api/notifications/${id}`);
  }

  // ==================== Servidor ====================

  async getServer() {
    const response = await this.client.get('/api/server');
    return response.data;
  }

  async getStatistics() {
    const response = await this.client.get('/api/statistics');
    return response.data;
  }

  async getHealth() {
    const response = await this.client.get('/api/health');
    return response.data;
  }
}

// Factory function para criar instância com configuração
function createTraccarClient(config) {
  return new TraccarClient({
    traccarUrl: config.TRACCAR_URL || config.traccarUrl,
    traccarToken: config.TRACCAR_TOKEN || config.traccarToken,
    timeout: config.timeout || 30000
  });
}

module.exports = { TraccarClient, createTraccarClient };
