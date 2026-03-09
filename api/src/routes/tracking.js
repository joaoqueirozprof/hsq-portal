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

    // Combine devices with positions
    const result = devices.map(d => {
      const pos = posMap[d.id];
      return {
        deviceId: d.id,
        name: d.name,
        uniqueId: d.uniqueId,
        category: d.category || 'car',
        status: d.status,
        lastUpdate: d.lastUpdate,
        position: pos ? {
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed ? Math.round(pos.speed * 1.852) : 0, // knots to km/h
          course: pos.course || 0,
          altitude: pos.altitude || 0,
          address: pos.address || null,
          fixTime: pos.fixTime,
          accuracy: pos.accuracy || 0,
          attributes: pos.attributes || {},
        } : null,
      };
    }).filter(d => d.position); // Only return devices with position

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

module.exports = router;
