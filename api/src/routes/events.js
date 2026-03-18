const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
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
    const events = await traccar.getEvents(req.query);
    res.json(events || []);
  } catch (error) {
    console.error('Get events error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar eventos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const traccar = getTraccar();
    const event = await traccar.getEvent(req.params.id);
    res.json(event);
  } catch (error) {
    console.error('Get event error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar evento' });
  }
});

module.exports = router;
