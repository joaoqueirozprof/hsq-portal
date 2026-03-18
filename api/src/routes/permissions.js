/**
 * Routes de Permissions (Permissões)
 */

const express = require('express');
const router = express.Router();

// GET /api/permissions/:userId - Listar permissões do usuário
router.get('/:userId', async (req, res) => {
  try {
    const traccar = require('../services/traccar').createTraccarClient({});

    if (process.env.TRACCAR_TOKEN) {
      const response = await traccar.get(`/api/permissions?userId=${req.params.userId}`);
      return res.json(response.data || []);
    }

    res.json([]);
  } catch (error) {
    console.error('Get permissions error:', error.message);
    res.status(500).json({ error: 'Erro ao buscar permissões' });
  }
});

module.exports = router;
