/**
 * Routes de Calendar (Calendários)
 */

const express = require('express');
const router = express.Router();

// GET /api/calendars - Listar calendários
router.get('/', async (req, res) => {
  try {
    const traccar = require('../services/traccar').createTraccarClient({});

    if (process.env.TRACCAR_TOKEN) {
      const response = await traccar.get('/api/calendars');
      return res.json(response.data || []);
    }

    res.json([]);
  } catch (error) {
    console.error('Get calendars error:', error.message);
    res.status(500).json({ error: 'Erro ao buscar calendários' });
  }
});

module.exports = router;
