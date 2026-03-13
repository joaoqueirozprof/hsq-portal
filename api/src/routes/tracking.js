const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getTraccarService } = require('../services/traccar');

const router = express.Router();
router.use(authMiddleware);

// ====== HELPER: handle Traccar errors properly ======
// If Traccar is unreachable or session fails, return 503 (service unavailable)
// so the frontend knows it's a temporary issue and can retry
function handleTraccarError(res, err, context) {
  console.error(`${context} error:`, err.message);

  // Connection/timeout errors → 503 Service Unavailable (frontend will retry)
  if (err.isTraccarConnectionError || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(503).json({
      error: 'Servidor de rastreamento temporariamente indisponível. Tente novamente em alguns segundos.',
      retryable: true,
    });
  }

  // Traccar auth errors → 502 (our admin session with Traccar broke)
  if (err.isTraccarAuthError) {
    return res.status(502).json({
      error: 'Erro de autenticação com servidor de rastreamento. Tente novamente.',
      retryable: true,
    });
  }

  // Generic server error
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ====== HELPER: get TraccarService singleton ======
function getTraccar(req) {
  return getTraccarService(req.app.locals.traccarUrl);
}

// GET /api/tracking/positions - Get live positions
// Admin sees all devices, clients see only their devices
router.get('/positions', async (req, res) => {
  try {
    const traccar = getTraccar(req);

    let devices, positions;

    if (req.user.role === 'admin') {
      devices = await traccar.getAllDevices();
      positions = await traccar.getPositions();
    } else {
      const traccarUserId = req.user.traccarUserId;
      if (!traccarUserId) {
        return res.json([]);
      }
      devices = await traccar.getUserDevices(traccarUserId);
      positions = await traccar.getPositions();
    }

    // Build position map
    const posMap = {};
    for (const p of positions) {
      posMap[p.deviceId] = p;
    }

    // Combine devices with positions - FLAT format for frontend Tracking.tsx
    const result = devices.map(d => {
      const pos = posMap[d.id];
      const hasPos = pos && (pos.latitude !== 0 || pos.longitude !== 0);
      return {
        deviceId: d.id,
        name: d.name,
        uniqueId: d.uniqueId,
        category: d.category || 'car',
        status: d.status,
        lastUpdate: d.lastUpdate,
        hasGps: hasPos,
        latitude: pos ? pos.latitude : 0,
        longitude: pos ? pos.longitude : 0,
        speed: hasPos && pos.speed ? Math.round(pos.speed * 1.852) : 0,
        course: pos ? (pos.course || 0) : 0,
        altitude: pos ? (pos.altitude || 0) : 0,
        address: hasPos ? (pos.address || null) : (pos ? 'Aguardando sinal GPS...' : null),
        fixTime: pos ? (pos.fixTime || d.lastUpdate) : null,
        accuracy: pos ? (pos.accuracy || 0) : 0,
      };
    });

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Tracking positions');
  }
});

// GET /api/tracking/devices - Simple device list (used by ClientDashboard)
router.get('/devices', async (req, res) => {
  try {
    const traccar = getTraccar(req);

    let devices;
    if (req.user.role === 'admin') {
      devices = await traccar.getAllDevices();
    } else {
      const traccarUserId = req.user.traccarUserId;
      if (!traccarUserId) {
        return res.json({ devices: [] });
      }
      devices = await traccar.getUserDevices(traccarUserId);
    }

    const result = devices.map(d => ({
      deviceId: d.id,
      name: d.name,
      status: d.status,
      lastUpdate: d.lastUpdate,
      category: d.category || 'car',
    }));

    res.json({ devices: result });
  } catch (err) {
    handleTraccarError(res, err, 'Tracking devices');
  }
});

// GET /api/tracking/traccar-session - Create Traccar session and return token for auto-login
router.get('/traccar-session', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    let email, password;

    if (req.user.role === 'admin') {
      email = process.env.TRACCAR_ADMIN_EMAIL || 'admin@hsqrastreamento.com';
      password = process.env.TRACCAR_ADMIN_PASSWORD || 'HSQ@2026Admin!';
    } else {
      const db = req.app.locals.db;
      const client = await db.query(
        'SELECT traccar_user_id, document FROM clients WHERE id = $1',
        [req.user.id]
      );

      if (client.rows.length === 0 || !client.rows[0].traccar_user_id) {
        return res.json({ token: null });
      }

      const traccarUser = await traccar.request('GET', `/api/users/${client.rows[0].traccar_user_id}`);
      email = traccarUser.email;
      password = client.rows[0].document.replace(/[.\-\/]/g, '');
    }

    const axios = require('axios');
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('password', password);

    const sessionResp = await axios.post(
      `${req.app.locals.traccarUrl}/api/session`,
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );

    const token = sessionResp.data.token;
    if (token) {
      return res.json({ token });
    }

    const cookies = sessionResp.headers['set-cookie'];
    const sessionCookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    try {
      const tokenResp = await axios.post(
        `${req.app.locals.traccarUrl}/api/session/token`,
        {},
        { headers: { Cookie: sessionCookie }, timeout: 10000 }
      );
      return res.json({ token: tokenResp.data.token || tokenResp.data });
    } catch {
      return res.json({ email, password, token: null });
    }
  } catch (err) {
    console.error('Traccar session error:', err.message);
    res.json({ token: null });
  }
});

// GET /api/tracking/trail/:deviceId - Get position history for a device
router.get('/trail/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) {
        return res.status(403).json({ error: 'Acesso negado a este dispositivo' });
      }
    }

    const now = new Date();
    const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const positions = await traccar.request('GET',
      `/api/positions?deviceId=${deviceId}&from=${from.toISOString()}&to=${now.toISOString()}`
    );

    const trail = positions.map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed ? Math.round(p.speed * 1.852) : 0,
      time: p.fixTime,
    }));

    res.json(trail);
  } catch (err) {
    handleTraccarError(res, err, 'Trail');
  }
});

// ===================== ROUTE REPLAY =====================
router.get('/replay/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios (ISO 8601)' });
    }

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const positions = await traccar.request('GET',
      `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      null, { timeout: 120000 }
    );

    const result = positions.map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed ? Math.round(p.speed * 1.852) : 0,
      course: p.course || 0,
      altitude: p.altitude || 0,
      address: p.address || '',
      time: p.fixTime,
      attributes: p.attributes || {},
    }));

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Replay');
  }
});

// ===================== REPORTS =====================
router.get('/reports/trips/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const trips = await traccar.request('GET',
      `/api/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      null, { timeout: 120000 }
    );

    const result = trips.map(t => ({
      startTime: t.startTime,
      endTime: t.endTime,
      startLat: t.startLat,
      startLon: t.startLon,
      endLat: t.endLat,
      endLon: t.endLon,
      startAddress: t.startAddress || '',
      endAddress: t.endAddress || '',
      distance: t.distance ? Math.round(t.distance / 1000 * 100) / 100 : 0,
      duration: t.duration || 0,
      averageSpeed: t.averageSpeed ? Math.round(t.averageSpeed * 1.852) : 0,
      maxSpeed: t.maxSpeed ? Math.round(t.maxSpeed * 1.852) : 0,
      spentFuel: t.spentFuel || 0,
    }));

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Trips report');
  }
});

router.get('/reports/stops/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const stops = await traccar.request('GET',
      `/api/reports/stops?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      null, { timeout: 120000 }
    );

    const result = stops.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      latitude: s.latitude || 0,
      longitude: s.longitude || 0,
      address: s.address || '',
      duration: s.duration || 0,
      engineHours: s.engineHours || 0,
      spentFuel: s.spentFuel || 0,
    }));

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Stops report');
  }
});

router.get('/reports/summary/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const summary = await traccar.request('GET',
      `/api/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      null, { timeout: 120000 }
    );

    const result = summary.map(s => ({
      deviceName: s.deviceName,
      distance: s.distance ? Math.round(s.distance / 1000 * 100) / 100 : 0,
      averageSpeed: s.averageSpeed ? Math.round(s.averageSpeed * 1.852) : 0,
      maxSpeed: s.maxSpeed ? Math.round(s.maxSpeed * 1.852) : 0,
      engineHours: s.engineHours || 0,
      spentFuel: s.spentFuel || 0,
      startTime: from,
      endTime: to,
    }));

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Summary report');
  }
});

router.get('/reports/events/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to, type } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const eventType = type || 'allEvents';
    const events = await traccar.request('GET',
      `/api/reports/events?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=${eventType}`,
      null, { timeout: 120000 }
    );

    const result = events.map(e => ({
      type: e.type,
      eventTime: e.eventTime || e.serverTime,
      positionId: e.positionId,
      attributes: e.attributes || {},
    }));

    res.json(result);
  } catch (err) {
    handleTraccarError(res, err, 'Events report');
  }
});

// ===================== GEOFENCES =====================
router.get('/geofences', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const geofences = await traccar.request('GET', '/api/geofences');
    res.json(geofences);
  } catch (err) {
    handleTraccarError(res, err, 'Geofences');
  }
});

router.post('/geofences', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = getTraccar(req);
    const { name, area, description } = req.body;

    const geofence = await traccar.request('POST', '/api/geofences', {
      name,
      area,
      description: description || '',
    });

    res.json(geofence);
  } catch (err) {
    handleTraccarError(res, err, 'Create geofence');
  }
});

router.put('/geofences/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = getTraccar(req);
    const id = parseInt(req.params.id);
    const existing = await traccar.request('GET', `/api/geofences`);
    const gf = existing.find(g => g.id === id);
    if (!gf) return res.status(404).json({ error: 'Geofence não encontrada' });

    Object.assign(gf, req.body);
    const updated = await traccar.request('PUT', `/api/geofences/${id}`, gf);
    res.json(updated);
  } catch (err) {
    handleTraccarError(res, err, 'Update geofence');
  }
});

router.delete('/geofences/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = getTraccar(req);
    await traccar.request('DELETE', `/api/geofences/${parseInt(req.params.id)}`);
    res.json({ success: true });
  } catch (err) {
    handleTraccarError(res, err, 'Delete geofence');
  }
});

router.post('/geofences/:id/link', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = getTraccar(req);
    const { deviceId } = req.body;
    await traccar.request('POST', '/api/permissions', {
      deviceId: parseInt(deviceId),
      geofenceId: parseInt(req.params.id),
    });
    res.json({ success: true });
  } catch (err) {
    handleTraccarError(res, err, 'Link geofence');
  }
});

// ===================== REMOTE COMMANDS =====================
router.post('/commands/:deviceId', async (req, res) => {
  try {
    const traccar = getTraccar(req);
    const deviceId = parseInt(req.params.deviceId);
    const { type } = req.body;

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const commandMap = {
      engineStop: { type: 'engineStop', attributes: {} },
      engineResume: { type: 'engineResume', attributes: {} },
      fuelCut: { type: 'custom', attributes: { data: 'relay,1#' } },
      fuelResume: { type: 'custom', attributes: { data: 'relay,0#' } },
    };

    const cmd = commandMap[type];
    if (!cmd) {
      return res.status(400).json({ error: 'Tipo de comando inválido. Use: engineStop, engineResume, fuelCut, fuelResume' });
    }

    const result = await traccar.request('POST', '/api/commands/send', {
      deviceId,
      type: cmd.type,
      attributes: cmd.attributes,
    });

    const db = req.app.locals.db;
    await db.query(
      'INSERT INTO audit_log (user_id, user_type, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.user.role, 'vehicle_command', JSON.stringify({ deviceId, type, result: 'sent' })]
    ).catch(() => {});

    res.json({ success: true, message: `Comando ${type} enviado com sucesso`, result });
  } catch (err) {
    handleTraccarError(res, err, 'Command');
  }
});

module.exports = router;
