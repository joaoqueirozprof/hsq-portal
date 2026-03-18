/**
 * Rotas de manutenção
 * GET /api/maintenance - Listar manutenções
 * GET /api/maintenance/:id - Obter manutenção
 * POST /api/maintenance - Criar manutenção
 * PUT /api/maintenance/:id - Atualizar manutenção
 * DELETE /api/maintenance/:id - Deletar manutenção
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar manutenções
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const maintenances = await traccar.getMaintenances(req.query);
    res.json(maintenances);
  } catch (error) {
    console.error('Get maintenances error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar manutenções' });
  }
});

// Obter manutenção específica
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const maintenance = await traccar.getMaintenance(req.params.id);
    res.json(maintenance);
  } catch (error) {
    console.error('Get maintenance error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar manutenção' });
  }
});

// Criar manutenção
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const maintenance = await traccar.createMaintenance(req.body);
    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Create maintenance error:', error.message);
    res.status(503).json({ error: 'Erro ao criar manutenção' });
  }
});

// Atualizar manutenção
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const maintenance = await traccar.updateMaintenance(req.params.id, req.body);
    res.json(maintenance);
  } catch (error) {
    console.error('Update maintenance error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar manutenção' });
  }
});

// Deletar manutenção
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteMaintenance(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete maintenance error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar manutenção' });
  }
});

module.exports = router;
