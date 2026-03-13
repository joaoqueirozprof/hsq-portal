const axios = require('axios');

class TraccarService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.adminSession = null;
    this.sessionCreatedAt = 0;
    this.loginInProgress = null; // prevents concurrent logins
  }

  // Admin login to Traccar API — with deduplication
  async adminLogin() {
    // If a login is already in progress, wait for it instead of making another
    if (this.loginInProgress) {
      return this.loginInProgress;
    }

    this.loginInProgress = (async () => {
      try {
        const params = new URLSearchParams();
        params.append('email', process.env.TRACCAR_ADMIN_EMAIL || 'admin@hsqrastreamento.com');
        params.append('password', process.env.TRACCAR_ADMIN_PASSWORD || 'HSQ@2026Admin!');

        const resp = await axios.post(`${this.baseUrl}/api/session`, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          withCredentials: true,
          timeout: 10000,
        });

        const cookies = resp.headers['set-cookie'];
        if (cookies) {
          this.adminSession = cookies.map(c => c.split(';')[0]).join('; ');
          this.sessionCreatedAt = Date.now();
          console.log('[TraccarService] Admin session obtained successfully');
        }
        return resp.data;
      } catch (err) {
        console.error('[TraccarService] Admin login failed:', err.message);
        this.adminSession = null;
        this.sessionCreatedAt = 0;
        throw err;
      } finally {
        this.loginInProgress = null;
      }
    })();

    return this.loginInProgress;
  }

  async ensureSession() {
    // Session older than 25 minutes? Refresh proactively (Traccar sessions last ~30min)
    const SESSION_MAX_AGE = 25 * 60 * 1000;
    if (this.adminSession && (Date.now() - this.sessionCreatedAt) < SESSION_MAX_AGE) {
      return; // Session is fresh enough
    }

    // Session is missing or stale — refresh
    console.log('[TraccarService] Session missing or stale, refreshing...');
    await this.adminLogin();
  }

  async request(method, path, data = null, options = {}) {
    const timeout = options.timeout || 30000;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.ensureSession();

        if (!this.adminSession) {
          throw new Error('No Traccar admin session available');
        }

        const config = {
          method,
          url: `${this.baseUrl}${path}`,
          headers: { Cookie: this.adminSession },
          timeout,
        };
        if (data) config.data = data;
        const resp = await axios(config);
        return resp.data;
      } catch (err) {
        const status = err.response?.status;
        const isAuthError = status === 401 || status === 403;
        const isConnectionError = !err.response && (
          err.code === 'ECONNREFUSED' ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND' ||
          err.message?.includes('timeout') ||
          err.message?.includes('socket hang up')
        );

        // On auth or connection errors, invalidate session and retry
        if ((isAuthError || isConnectionError) && attempt < MAX_RETRIES) {
          console.log(`[TraccarService] Request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${err.message}. Retrying with fresh session...`);
          this.adminSession = null;
          this.sessionCreatedAt = 0;
          // Small backoff before retry
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        // Tag the error so routes know it's a Traccar connectivity issue
        err.isTraccarError = true;
        err.isTraccarAuthError = isAuthError;
        err.isTraccarConnectionError = isConnectionError;
        throw err;
      }
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
      timeout: 10000,
    });

    return {
      user: resp.data,
      cookies: resp.headers['set-cookie'],
    };
  }
}

// ====== SINGLETON ======
// One shared instance per process, reused across all requests
let _instance = null;

function getTraccarService(baseUrl) {
  if (!_instance || _instance.baseUrl !== baseUrl) {
    _instance = new TraccarService(baseUrl);
    console.log('[TraccarService] Singleton created for', baseUrl);
  }
  return _instance;
}

module.exports = TraccarService;
module.exports.getTraccarService = getTraccarService;
