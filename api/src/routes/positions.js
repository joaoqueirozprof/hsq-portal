/**
 * Rotas de posições em tempo real
 * GET /api/positions - Listar posições de todos os dispositivos
 * GET /api/positions/:deviceId - Histórico de posições de um dispositivo
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar posições de todos os dispositivos
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    // Obter todos os dispositivos
    const devices = await traccar.getDevices();

    // Obter posição de cada dispositivo
    const positions = await Promise.all(
      devices.map(async (device) => {
        try {
          const position = await traccar.getLatestPosition(device.id);
          return position ? {
            deviceId: device.id,
            deviceName: device.name,
            uniqueId: device.uniqueId,
            status: device.status,
            lat: position.latitude,
            lng: position.longitude,
            speed: position.speed ? Math.round(position.speed * 1.852) : 0, // knots to km/h
            course: position.course,
            altitude: position.altitude,
            timestamp: position.fixTime,
            attributes: position.attributes
          } : null;
        } catch (e) {
          return null;
        }
      })
    );

    // Filtrar posições válidas
    const validPositions = positions.filter(p => p !== null);
    res.json(validPositions);
  } catch (error) {
    console.error('Get all positions error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar posições' });
  }
});

// Histórico de posições de um dispositivo
router.get('/:deviceId', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const { deviceId } = req.params;
    const { from, to } = req.query;

    // Se não tiver datas, retorna última posição
    if (!from && !to) {
      const position = await traccar.getLatestPosition(deviceId);
      if (!position) {
        return res.status(404).json({ error: 'Posição não encontrada' });
      }
      return res.json([{
        deviceId: position.deviceId,
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        course: position.course,
        timestamp: position.fixTime
      }]);
    }

    // Histórico completo
    const positions = await traccar.getPositions(deviceId, from, to);

    const formatted = positions.map(p => ({
      deviceId: p.deviceId,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed,
      course: p.course,
      altitude: p.altitude,
      timestamp: p.fixTime,
      accuracy: p.accuracy,
      attributes: p.attributes
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get positions error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar posições' });
  }
});

module.exports = router;
