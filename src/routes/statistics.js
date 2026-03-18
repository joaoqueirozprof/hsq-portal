/**
 * Rotas de estatísticas
 * GET /api/statistics - Estatísticas do servidor
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Obter estatísticas do servidor
router.get('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros "from" e "to" são obrigatórios' });
    }

    const stats = await traccar.getStatistics(from, to);
    res.json(stats);
  } catch (error) {
    console.error('Get statistics error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
