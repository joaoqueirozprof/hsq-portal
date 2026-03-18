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
    const drivers = await traccar.getDrivers();
    res.json(drivers || []);
  } catch (error) {
    console.error('Get drivers error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar motoristas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const traccar = getTraccar();
    const driver = await traccar.getDriver(req.params.id);
    res.json(driver);
  } catch (error) {
    console.error('Get driver error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar motorista' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const { name, uniqueId, attributes } = req.body;
    if (!name || !uniqueId) return res.status(400).json({ error: 'name e uniqueId são obrigatórios' });
    const driver = await traccar.createDriver({ name, uniqueId, attributes: attributes || {} });
    res.status(201).json(driver);
  } catch (error) {
    console.error('Create driver error:', error.message);
    res.status(503).json({ error: 'Erro ao criar motorista' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const driver = await traccar.updateDriver(req.params.id, req.body);
    res.json(driver);
  } catch (error) {
    console.error('Update driver error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar motorista' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    await traccar.deleteDriver(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete driver error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar motorista' });
  }
});

module.exports = router;
