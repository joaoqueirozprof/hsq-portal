const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

function getTraccar() {
  return createTraccarClient({
    traccarUrl: process.env.TRACCAR_URL,
    traccarToken: process.env.TRACCAR_TOKEN,
    timeout: 60000
  });
}

// GET /api/events - lista eventos usando /api/reports/events do Traccar
router.get('/', async (req, res) => {
  try {
    const traccar = getTraccar();
    const { from, to, deviceId, groupId, type } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' });
    }

    const params = { from, to };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;
    if (type) params.type = type;

    const response = await traccar.client.get('/api/reports/events', { params });
    res.json(response.data || []);
  } catch (error) {
    console.error('Get events error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar eventos: ' + error.message });
  }
});

module.exports = router;
