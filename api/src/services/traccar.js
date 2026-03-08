const axios = require('axios');

class TraccarService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.adminSession = null;
  }

  // Admin login to Traccar API
  async adminLogin() {
    const params = new URLSearchParams();
    params.append('email', process.env.TRACCAR_ADMIN_EMAIL || 'admin@hsqrastreamento.com');
    params.append('password', process.env.TRACCAR_ADMIN_PASSWORD || 'HSQ@2026Admin!');

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
    });
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

  // Generate/set a session token for a Traccar user (for URL-based login)
  async setUserToken(userId) {
    const user = await this.request('GET', `/api/users/${userId}`);
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    user.token = token;
    await this.request('PUT', `/api/users/${userId}`, user);
    return token;
  }
}

module.exports = TraccarService;
