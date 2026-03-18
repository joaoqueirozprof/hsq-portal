/**
 * Rotas de comandos
 */
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
    const commands = await traccar.getCommands();
    res.json(commands || []);
  } catch (error) {
    console.error('Get commands error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar comandos' });
  }
});

router.get('/types', async (req, res) => {
  try {
    const traccar = getTraccar();
    const { deviceId } = req.query;
    const response = await traccar.client.get('/api/commands/types', { params: deviceId ? { deviceId } : {} });
    res.json(response.data || []);
  } catch (error) {
    console.error('Get command types error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar tipos de comandos' });
  }
});

router.post('/send', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const { deviceId, type, attributes } = req.body;
    if (!deviceId || !type) return res.status(400).json({ error: 'deviceId e type são obrigatórios' });
    const result = await traccar.sendCommand(deviceId, type, attributes || {});
    res.json(result);
  } catch (error) {
    console.error('Send command error:', error.message);
    res.status(503).json({ error: 'Erro ao enviar comando' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const response = await traccar.client.post('/api/commands', req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Create command error:', error.message);
    res.status(503).json({ error: 'Erro ao criar comando' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const response = await traccar.client.put('/api/commands/' + req.params.id, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Update command error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar comando' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    await traccar.client.delete('/api/commands/' + req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete command error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar comando' });
  }
});

module.exports = router;
