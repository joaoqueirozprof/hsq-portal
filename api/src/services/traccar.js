const axios = require('axios');

class TraccarService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.adminSession = null;
  }

  // Admin login to Traccar API
  async adminLogin() {
    const adminEmail = process.env.TRACCAR_ADMIN_EMAIL;
    const adminPassword = process.env.TRACCAR_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('TRACCAR_ADMIN_EMAIL and TRACCAR_ADMIN_PASSWORD must be configured');
    }

    const params = new URLSearchParams();
    params.append('email', adminEmail);
    params.append('password', adminPassword);

    const resp = await axios.post(`${this.baseUrl}/api/session`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      withCredentials: true,
    });

    // Extract session cookie
    const cookies = resp.headers['set-cookie'];
    if (cookies) {
      this.adminSession = cookies.map(c => c.split(';')[0]).join('; ');
    }
    return resp.data;
  }

  async ensureSession() {
    if (!this.adminSession) {
      await this.adminLogin();
    }
  }

  async request(method, path, data = null) {
    await this.ensureSession();
    try {
      const config = {
        method,
        url: `${this.baseUrl}${path}`,
        headers: { Cookie: this.adminSession },
      };
      if (data) config.data = data;
      const resp = await axios(config);
      return resp.data;
    } catch (err) {
      // Session expired? Re-login and retry
      if (err.response?.status === 401) {
        await this.adminLogin();
        const config = {
          method,
          url: `${this.baseUrl}${path}`,
          headers: { Cookie: this.adminSession },
        };
        if (data) config.data = data;
        const resp = await axios(config);
        return resp.data;
      }
      throw err;
    }
  }

  // Create a Traccar user for a client
  async createUser(email, password, name) {
    return this.request('POST', '/api/users', {
      name,
      email,
      password,
      administrator: false,
      disabled: false,
      deviceLimit: 10,
      deviceReadonly: true,
      limitCommands: true,
    });
  }

  // ---- Device Management ----

  async getAllDevices() {
    return this.request('GET', '/api/devices');
  }

  async getDevice(deviceId) {
    return this.request('GET', `/api/devices/${deviceId}`);
  }

  async createDevice(name, uniqueId, category = null) {
    return this.request('POST', '/api/devices', {
      name,
      uniqueId,
      category: category || null,
      disabled: false,
      groupId: 0,
    });
  }

  async updateDevice(deviceId, data) {
    const device = await this.request('GET', `/api/devices/${deviceId}`);
    Object.assign(device, data);
    return this.request('PUT', `/api/devices/${deviceId}`, device);
  }

  async deleteDevice(deviceId) {
    return this.request('DELETE', `/api/devices/${deviceId}`);
  }

  async linkDeviceToUser(userId, deviceId) {
    return this.request('POST', '/api/permissions', { userId, deviceId });
  }

  async unlinkDeviceFromUser(userId, deviceId) {
    return this.request('DELETE', '/api/permissions', { userId, deviceId });
  }

  async getPositions(deviceId = null) {
    const path = deviceId ? `/api/positions?deviceId=${deviceId}` : '/api/positions';
    return this.request('GET', path);
  }

  // Update user password
  async updatePassword(userId, newPassword) {
    const user = await this.request('GET', `/api/users/${userId}`);
    user.password = newPassword;
    return this.request('PUT', `/api/users/${userId}`, user);
  }

  // Enable/disable user
  async setUserActive(userId, active) {
    const user = await this.request('GET', `/api/users/${userId}`);
    user.disabled = !active;
    return this.request('PUT', `/api/users/${userId}`, user);
  }

  // Get user devices
  async getUserDevices(userId) {
    return this.request('GET', `/api/devices?userId=${userId}`);
  }

  // Get all users
  async getUsers() {
    return this.request('GET', '/api/users');
  }

  // Get user by ID
  async getUser(userId) {
    return this.request('GET', `/api/users/${userId}`);
  }

  // Delete user
  async deleteUser(userId) {
    return this.request('DELETE', `/api/users/${userId}`);
  }

  // Client login to Traccar (returns session for the client)
  async clientLogin(email, password) {
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('password', password);

    const resp = await axios.post(`${this.baseUrl}/api/session`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return {
      user: resp.data,
      cookies: resp.headers['set-cookie'],
    };
  }
}

module.exports = TraccarService;
