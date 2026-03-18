/**
 * Rotas de dispositivos
 * GET /api/devices - Listar dispositivos
 * GET /api/devices/:id - Obter dispositivo
 * POST /api/devices - Criar dispositivo
 * PUT /api/devices/:id - Atualizar dispositivo
 * DELETE /api/devices/:id - Deletar dispositivo
 * GET /api/devices/:id/position - Última posição
 * PUT /api/devices/:id/accumulators - Atualizar acumuladores
 * POST /api/devices/:id/image - Upload de imagem
 * POST /api/devices/share - Compartilhar localização
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar dispositivos
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    let devices = await traccar.getDevices(req.query);
    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar dispositivos' });
  }
});

// Obter dispositivo específico
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const device = await traccar.getDevice(req.params.id);
    res.json(device);
  } catch (error) {
    console.error('Get device error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar dispositivo' });
  }
});

// Obter última posição do dispositivo
router.get('/:id/position', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const position = await traccar.getLatestPosition(req.params.id);
    if (!position) {
      return res.status(404).json({ error: 'Posição não encontrada' });
    }
    res.json(position);
  } catch (error) {
    console.error('Get position error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar posição' });
  }
});

// Atualizar acumuladores do dispositivo
router.put('/:id/accumulators', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.updateDeviceAccumulators(req.params.id, req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Update accumulators error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar acumuladores' });
  }
});

// Criar dispositivo
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const device = await traccar.createDevice(req.body);
    res.status(201).json(device);
  } catch (error) {
    console.error('Create device error:', error.message);
    res.status(503).json({ error: 'Erro ao criar dispositivo' });
  }
});

// Atualizar dispositivo
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const device = await traccar.updateDevice(req.params.id, req.body);
    res.json(device);
  } catch (error) {
    console.error('Update device error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar dispositivo' });
  }
});

// Deletar dispositivo
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteDevice(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete device error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar dispositivo' });
  }
});

// Compartilhar localização
router.post('/share', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const { deviceId, expiration } = req.body;
    const shareUrl = await traccar.shareDevice(deviceId, expiration);
    res.json({ url: shareUrl });
  } catch (error) {
    console.error('Share device error:', error.message);
    res.status(503).json({ error: 'Erro ao compartilhar dispositivo' });
  }
});

module.exports = router;
