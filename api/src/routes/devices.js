/**
 * Rotas de dispositivos
 * GET /api/devices - Listar dispositivos
 * GET /api/devices/:id - Obter dispositivo
 * POST /api/devices - Criar dispositivo
 * PUT /api/devices/:id - Atualizar dispositivo
 * DELETE /api/devices/:id - Deletar dispositivo
 * GET /api/devices/:id/position - Última posição
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar dispositivos
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    let devices = await traccar.getDevices();

    // Filtrar por grupo se especificado
    if (req.query.groupId) {
      devices = devices.filter(d => d.groupId === parseInt(req.query.groupId));
    }

    // Retornar apenas dados relevantes
    const formatted = devices.map(d => ({
      id: d.id,
      name: d.name,
      uniqueId: d.uniqueId,
      status: d.status,
      lastUpdate: d.lastUpdate,
      positionId: d.positionId,
      groupId: d.groupId,
      groupName: d.groupId ? null : null,
      attributes: {
        phone: d.attributes?.phone,
        model: d.attributes?.model,
        contact: d.attributes?.contact,
        category: d.attributes?.category
      }
    }));

    res.json(formatted);
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

    res.json({
      deviceId: position.deviceId,
      latitude: position.latitude,
      longitude: position.longitude,
      speed: position.speed,
      course: position.course,
      altitude: position.altitude,
      timestamp: position.fixTime,
      attributes: position.attributes
    });
  } catch (error) {
    console.error('Get position error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar posição' });
  }
});

// Criar dispositivo (apenas admin)
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

// Atualizar dispositivo (apenas admin)
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

// Deletar dispositivo (apenas admin)
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

module.exports = router;
