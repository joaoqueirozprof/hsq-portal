const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

function getTraccar() {
  return createTraccarClient({
    traccarUrl: process.env.TRACCAR_URL,
    traccarToken: process.env.TRACCAR_TOKEN
  });
}

router.get('/', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const { from, to } = req.query;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await traccar.client.get('/api/statistics', { params });
    res.json(response.data || []);
  } catch (error) {
    console.error('Get statistics error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
