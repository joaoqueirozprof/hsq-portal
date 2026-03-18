/**
 * Routes de Attributes (Atributos)
 */

const express = require('express');
const router = express.Router();

// GET /api/attributes/:deviceId - Listar atributos do dispositivo
router.get('/:deviceId', async (req, res) => {
  try {
    const traccar = require('../services/traccar').createTraccarClient({});

    if (process.env.TRACCAR_TOKEN) {
      const response = await traccar.get(`/api/attributes?deviceId=${req.params.deviceId}`);
      return res.json(response.data || []);
    }

    res.json([]);
  } catch (error) {
    console.error('Get attributes error:', error.message);
    res.status(500).json({ error: 'Erro ao buscar atributos' });
  }
});

module.exports = router;
