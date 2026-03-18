/**
 * Cliente completo para API do Traccar v6.12.2
 * Implementa TODOS os endpoints da documentação OpenAPI 3.1.0
 */

const axios = require('axios');

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

    // Interceptor para logging
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
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== HEALTH ====================

  async getHealth() {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  // ==================== SERVER ====================

  async getServer() {
    const response = await this.client.get('/api/server');
    return response.data;
  }

  async updateServer(data) {
    const response = await this.client.put('/api/server', data);
    return response.data;
  }

  async geocode(latitude, longitude) {
    const response = await this.client.get('/api/server/geocode', {
      params: { latitude, longitude }
    });
    return response.data;
  }

  async getTimezones() {
    const response = await this.client.get('/api/server/timezones');
    return response.data;
  }

  async getCacheDiagnostics() {
    const response = await this.client.get('/api/server/cache');
    return response.data;
  }

  async triggerGC() {
    await this.client.get('/api/server/gc');
  }

  async rebootServer() {
    await this.client.post('/api/server/reboot');
  }

  // ==================== SESSION ====================

  async getSession() {
    const response = await this.client.get('/api/session');
    return response.data;
  }

  async createSession(email, password) {
    const response = await this.client.post('/api/session', null, {
      params: { email, password }
    });
    return response.data;
  }

  async deleteSession() {
    await this.client.delete('/api/session');
  }

  async generateToken(expiration = null) {
    const response = await this.client.post('/api/session/token', null, {
      params: { expiration }
    });
    return response.data;
  }

  async revokeToken(token) {
    await this.client.post('/api/session/token/revoke', null, {
      params: { token }
    });
  }

  // ==================== DEVICES ====================

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

  async updateDeviceAccumulators(id, data) {
    await this.client.put(`/api/devices/${id}/accumulators`, data);
  }

  async uploadDeviceImage(id, imageBuffer, filename) {
    const response = await this.client.post(`/api/devices/${id}/image`, imageBuffer, {
      headers: { 'Content-Type': 'image/*' }
    });
    return response.data;
  }

  async shareDevice(deviceId, expiration) {
    const response = await this.client.post('/api/devices/share', null, {
      params: { deviceId, expiration }
    });
    return response.data;
  }

  // ==================== GROUPS ====================

  async getGroups(params = {}) {
    const response = await this.client.get('/api/groups', { params });
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

  // ==================== POSITIONS ====================

  async getPositions(params = {}) {
    const response = await this.client.get('/api/positions', { params });
    return response.data;
  }

  async deletePositions(deviceId, from, to) {
    await this.client.delete('/api/positions', {
      params: { deviceId, from, to }
    });
  }

  async deletePosition(id) {
    await this.client.delete(`/api/positions/${id}`);
  }

  async getPositionsKML(deviceId, from, to) {
    const response = await this.client.get('/api/positions/kml', {
      params: { deviceId, from, to },
      responseType: 'blob'
    });
    return response.data;
  }

  async getPositionsCSV(deviceId, from, to, geofenceId = null) {
    const response = await this.client.get('/api/positions/csv', {
      params: { deviceId, from, to, geofenceId },
      responseType: 'blob'
    });
    return response.data;
  }

  async getPositionsGPX(deviceId, from, to) {
    const response = await this.client.get('/api/positions/gpx', {
      params: { deviceId, from, to },
      responseType: 'blob'
    });
    return response.data;
  }

  // ==================== EVENTS ====================

  async getEvents(params = {}) {
    const response = await this.client.get('/api/events', { params });
    return response.data;
  }

  async getEvent(id) {
    const response = await this.client.get(`/api/events/${id}`);
    return response.data;
  }

  // ==================== REPORTS ====================

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

  // ==================== GEOFENCES ====================

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

  // ==================== COMMANDS ====================

  async getCommands(params = {}) {
    const response = await this.client.get('/api/commands', { params });
    return response.data;
  }

  async createCommand(data) {
    const response = await this.client.post('/api/commands', data);
    return response.data;
  }

  async updateCommand(id, data) {
    const response = await this.client.put(`/api/commands/${id}`, data);
    return response.data;
  }

  async deleteCommand(id) {
    await this.client.delete(`/api/commands/${id}`);
  }

  async getCommandsForDevice(deviceId) {
    const response = await this.client.get('/api/commands/send', {
      params: { deviceId }
    });
    return response.data;
  }

  async sendCommand(deviceId, data) {
    const response = await this.client.post('/api/commands/send', data, {
      params: { deviceId }
    });
    return response.data;
  }

  async sendCommandToGroup(groupId, data) {
    const response = await this.client.post('/api/commands/send', data, {
      params: { groupId }
    });
    return response.data;
  }

  async getCommandTypes(deviceId = null, textChannel = false) {
    const params = { textChannel };
    if (deviceId) params.deviceId = deviceId;
    const response = await this.client.get('/api/commands/types', { params });
    return response.data;
  }

  // ==================== NOTIFICATIONS ====================

  async getNotifications(params = {}) {
    const response = await this.client.get('/api/notifications', { params });
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

  async getNotificationTypes() {
    const response = await this.client.get('/api/notifications/types');
    return response.data;
  }

  async testNotification() {
    await this.client.post('/api/notifications/test');
  }

  async sendNotification(notificator, userIds, message) {
    await this.client.post(`/api/notifications/send/${notificator}`, message, {
      params: { userId: userIds }
    });
  }

  // ==================== USERS ====================

  async getUsers(params = {}) {
    const response = await this.client.get('/api/users', { params });
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

  async generateTOTP() {
    const response = await this.client.post('/api/users/totp');
    return response.data;
  }

  // ==================== PERMISSIONS ====================

  async addPermission(permission) {
    await this.client.post('/api/permissions', permission);
  }

  async removePermission(permission) {
    await this.client.delete('/api/permissions', { data: permission });
  }

  // ==================== DRIVERS ====================

  async getDrivers(params = {}) {
    const response = await this.client.get('/api/drivers', { params });
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

  // ==================== MAINTENANCE ====================

  async getMaintenances(params = {}) {
    const response = await this.client.get('/api/maintenance', { params });
    return response.data;
  }

  async getMaintenance(id) {
    const response = await this.client.get(`/api/maintenance/${id}`);
    return response.data;
  }

  async createMaintenance(data) {
    const response = await this.client.post('/api/maintenance', data);
    return response.data;
  }

  async updateMaintenance(id, data) {
    const response = await this.client.put(`/api/maintenance/${id}`, data);
    return response.data;
  }

  async deleteMaintenance(id) {
    await this.client.delete(`/api/maintenance/${id}`);
  }

  // ==================== CALENDARS ====================

  async getCalendars(params = {}) {
    const response = await this.client.get('/api/calendars', { params });
    return response.data;
  }

  async getCalendar(id) {
    const response = await this.client.get(`/api/calendars/${id}`);
    return response.data;
  }

  async createCalendar(data) {
    const response = await this.client.post('/api/calendars', data);
    return response.data;
  }

  async updateCalendar(id, data) {
    const response = await this.client.put(`/api/calendars/${id}`, data);
    return response.data;
  }

  async deleteCalendar(id) {
    await this.client.delete(`/api/calendars/${id}`);
  }

  // ==================== ATTRIBUTES (Computed) ====================

  async getComputedAttributes(params = {}) {
    const response = await this.client.get('/api/attributes/computed', { params });
    return response.data;
  }

  async createComputedAttribute(data) {
    const response = await this.client.post('/api/attributes/computed', data);
    return response.data;
  }

  async updateComputedAttribute(id, data) {
    const response = await this.client.put(`/api/attributes/computed/${id}`, data);
    return response.data;
  }

  async deleteComputedAttribute(id) {
    await this.client.delete(`/api/attributes/computed/${id}`);
  }

  // ==================== ORDERS ====================

  async getOrders(params = {}) {
    const response = await this.client.get('/api/orders', { params });
    return response.data;
  }

  async getOrder(id) {
    const response = await this.client.get(`/api/orders/${id}`);
    return response.data;
  }

  async createOrder(data) {
    const response = await this.client.post('/api/orders', data);
    return response.data;
  }

  async updateOrder(id, data) {
    const response = await this.client.put(`/api/orders/${id}`, data);
    return response.data;
  }

  async deleteOrder(id) {
    await this.client.delete(`/api/orders/${id}`);
  }

  // ==================== STATISTICS ====================

  async getStatistics(from, to) {
    const response = await this.client.get('/api/statistics', {
      params: { from, to }
    });
    return response.data;
  }
}

// Factory function
function createTraccarClient(config) {
  return new TraccarClient({
    traccarUrl: config.TRACCAR_URL || config.traccarUrl,
    traccarToken: config.TRACCAR_TOKEN || config.traccarToken,
    timeout: config.timeout || 30000
  });
}

module.exports = { TraccarClient, createTraccarClient };
