/**
 * Rotas de drivers
 * GET /api/drivers - Listar motoristas
 * GET /api/drivers/:id - Obter motorista
 * POST /api/drivers - Criar motorista
 * PUT /api/drivers/:id - Atualizar motorista
 * DELETE /api/drivers/:id - Deletar motorista
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar drivers
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const drivers = await traccar.getDrivers(req.query);
    res.json(drivers);
  } catch (error) {
    console.error('Get drivers error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Obter driver específico
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const driver = await traccar.getDriver(req.params.id);
    res.json(driver);
  } catch (error) {
    console.error('Get driver error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar motorista' });
  }
});

// Criar driver
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const driver = await traccar.createDriver(req.body);
    res.status(201).json(driver);
  } catch (error) {
    console.error('Create driver error:', error.message);
    res.status(503).json({ error: 'Erro ao criar motorista' });
  }
});

// Atualizar driver
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const driver = await traccar.updateDriver(req.params.id, req.body);
    res.json(driver);
  } catch (error) {
    console.error('Update driver error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar motorista' });
  }
});

// Deletar driver
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteDriver(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete driver error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar motorista' });
  }
});

module.exports = router;
