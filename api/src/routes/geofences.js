/**
 * Rotas de geofences (cercas virtuais)
 * GET /api/geofences - Listar geofences
 * GET /api/geofences/:id - Obter geofence
 * POST /api/geofences - Criar geofence
 * PUT /api/geofences/:id - Atualizar geofence
 * DELETE /api/geofences/:id - Deletar geofence
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar geofences
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const geofences = await traccar.getGeofences();

    const formatted = geofences.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      area: g.area,
      color: g.attributes?.color || '#FF0000',
      attributes: g.attributes
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get geofences error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar geofences' });
  }
});

// Obter geofence específica
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const geofence = await traccar.getGeofence(req.params.id);
    res.json(geofence);
  } catch (error) {
    console.error('Get geofence error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar geofence' });
  }
});

// Criar geofence
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const geofence = await traccar.createGeofence(req.body);
    res.status(201).json(geofence);
  } catch (error) {
    console.error('Create geofence error:', error.message);
    res.status(503).json({ error: 'Erro ao criar geofence' });
  }
});

// Atualizar geofence
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const geofence = await traccar.updateGeofence(req.params.id, req.body);
    res.json(geofence);
  } catch (error) {
    console.error('Update geofence error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar geofence' });
  }
});

// Deletar geofence
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    await traccar.deleteGeofence(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete geofence error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar geofence' });
  }
});

module.exports = router;
