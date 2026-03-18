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

router.get('/', async (req, res) => {
  try {
    const traccar = getTraccar();
    const response = await traccar.client.get('/api/orders', { params: req.query }).catch(() => ({ data: [] }));
    res.json(response.data || []);
  } catch (error) {
    res.json([]);
  }
});

module.exports = router;
