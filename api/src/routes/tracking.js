const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const TraccarService = require('../services/traccar');

const router = express.Router();
router.use(authMiddleware);

// GET /api/tracking/positions - Get live positions
// Admin sees all devices, clients see only their devices
router.get('/positions', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);

    let devices, positions;

    if (req.user.role === 'admin') {
      // Admin sees everything
      devices = await traccar.getAllDevices();
      positions = await traccar.getPositions();
    } else {
      // Client sees only their devices
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

    // Combine devices with positions - show ALL devices even without position
    const result = devices.map(d => {
      const pos = posMap[d.id];
      // Use device's own lastUpdate lat/lng if no live position available
      const hasPos = pos && (pos.latitude !== 0 || pos.longitude !== 0);
      return {
        deviceId: d.id,
        name: d.name,
        uniqueId: d.uniqueId,
        category: d.category || 'car',
        status: d.status,
        lastUpdate: d.lastUpdate,
        position: hasPos ? {
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed ? Math.round(pos.speed * 1.852) : 0, // knots to km/h
          course: pos.course || 0,
          altitude: pos.altitude || 0,
          address: pos.address || null,
          fixTime: pos.fixTime,
          accuracy: pos.accuracy || 0,
          attributes: pos.attributes || {},
        } : (pos ? {
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: 0,
          course: 0,
          altitude: 0,
          address: 'Aguardando sinal GPS...',
          fixTime: pos.fixTime || d.lastUpdate,
          accuracy: 0,
          attributes: {},
          noGps: true,
        } : null),
        hasGps: hasPos,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Tracking positions error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar posições' });
  }
});

// GET /api/tracking/trail/:deviceId - Get position history for a device
router.get('/trail/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);

    // Check access - non-admin can only see their own devices
    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) {
        return res.status(403).json({ error: 'Acesso negado a este dispositivo' });
      }
    }

    // Get last 2 hours of positions
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
    console.error('Trail error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar trilha' });
  }
});

// ===================== ROUTE REPLAY =====================
// GET /api/tracking/replay/:deviceId?from=ISO&to=ISO
router.get('/replay/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios (ISO 8601)' });
    }

    // Check access
    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const positions = await traccar.request('GET',
      `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
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
    console.error('Replay error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar replay' });
  }
});

// ===================== REPORTS =====================
// GET /api/tracking/reports/trips/:deviceId?from=ISO&to=ISO
router.get('/reports/trips/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const trips = await traccar.request('GET',
      `/api/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
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
      distance: t.distance ? Math.round(t.distance / 1000 * 100) / 100 : 0, // km
      duration: t.duration || 0, // ms
      averageSpeed: t.averageSpeed ? Math.round(t.averageSpeed * 1.852) : 0,
      maxSpeed: t.maxSpeed ? Math.round(t.maxSpeed * 1.852) : 0,
      spentFuel: t.spentFuel || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Trips report error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar relatório de viagens' });
  }
});

// GET /api/tracking/reports/stops/:deviceId?from=ISO&to=ISO
router.get('/reports/stops/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const stops = await traccar.request('GET',
      `/api/reports/stops?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );

    const result = stops.map(s => ({
      startTime: s.startTime,
      endTime: s.endTime,
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address || '',
      duration: s.duration || 0,
      engineHours: s.engineHours || 0,
      spentFuel: s.spentFuel || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Stops report error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar relatório de paradas' });
  }
});

// GET /api/tracking/reports/summary/:deviceId?from=ISO&to=ISO
router.get('/reports/summary/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const summary = await traccar.request('GET',
      `/api/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
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
    console.error('Summary report error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

// GET /api/tracking/reports/events/:deviceId?from=ISO&to=ISO&type=allEvents
router.get('/reports/events/:deviceId', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const deviceId = parseInt(req.params.deviceId);
    const { from, to, type } = req.query;

    if (!from || !to) return res.status(400).json({ error: 'from e to obrigatórios' });

    if (req.user.role !== 'admin') {
      const userDevices = await traccar.getUserDevices(req.user.traccarUserId);
      if (!userDevices.find(d => d.id === deviceId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    const eventType = type || 'allEvents';
    const events = await traccar.request('GET',
      `/api/reports/events?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=${eventType}`
    );

    const result = events.map(e => ({
      type: e.type,
      eventTime: e.eventTime || e.serverTime,
      positionId: e.positionId,
      attributes: e.attributes || {},
    }));

    res.json(result);
  } catch (err) {
    console.error('Events report error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

// ===================== GEOFENCES =====================
// GET /api/tracking/geofences
router.get('/geofences', async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const geofences = await traccar.request('GET', '/api/geofences');
    res.json(geofences);
  } catch (err) {
    console.error('Geofences error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar geofences' });
  }
});

// POST /api/tracking/geofences
router.post('/geofences', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const { name, area, description } = req.body;

    const geofence = await traccar.request('POST', '/api/geofences', {
      name,
      area, // WKT format: CIRCLE(lat lng, radius) or POLYGON((lat lng, lat lng, ...))
      description: description || '',
    });

    res.json(geofence);
  } catch (err) {
    console.error('Create geofence error:', err.message);
    res.status(500).json({ error: 'Erro ao criar geofence' });
  }
});

// PUT /api/tracking/geofences/:id
router.put('/geofences/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const id = parseInt(req.params.id);
    const existing = await traccar.request('GET', `/api/geofences`);
    const gf = existing.find(g => g.id === id);
    if (!gf) return res.status(404).json({ error: 'Geofence não encontrada' });

    Object.assign(gf, req.body);
    const updated = await traccar.request('PUT', `/api/geofences/${id}`, gf);
    res.json(updated);
  } catch (err) {
    console.error('Update geofence error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar geofence' });
  }
});

// DELETE /api/tracking/geofences/:id
router.delete('/geofences/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    await traccar.request('DELETE', `/api/geofences/${parseInt(req.params.id)}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete geofence error:', err.message);
    res.status(500).json({ error: 'Erro ao deletar geofence' });
  }
});

// POST /api/tracking/geofences/:id/link - Link geofence to device
router.post('/geofences/:id/link', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const { deviceId } = req.body;
    await traccar.request('POST', '/api/permissions', {
      deviceId: parseInt(deviceId),
      geofenceId: parseInt(req.params.id),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Link geofence error:', err.message);
    res.status(500).json({ error: 'Erro ao vincular geofence' });
  }
});

module.exports = router;
