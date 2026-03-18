/**
 * Rotas de permissões
 * POST /api/permissions - Vincular objeto a outro
 * DELETE /api/permissions - Desvincular objeto
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Vincular permissão
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.addPermission(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Add permission error:', error.message);
    res.status(503).json({ error: 'Erro ao adicionar permissão' });
  }
});

// Desvincular permissão
router.delete('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.removePermission(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Remove permission error:', error.message);
    res.status(503).json({ error: 'Erro ao remover permissão' });
  }
});

module.exports = router;
