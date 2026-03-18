/**
 * Rotas de comandos
 * GET /api/commands - Listar comandos salvos
 * GET /api/commands/types - Tipos de comandos disponíveis
 * POST /api/commands - Criar comando salvo
 * PUT /api/commands/:id - Atualizar comando salvo
 * DELETE /api/commands/:id - Deletar comando salvo
 * POST /api/commands/send - Enviar comando para dispositivo
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar comandos salvos
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const commands = await traccar.getCommands(req.query);
    res.json(commands);
  } catch (error) {
    console.error('Get commands error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar comandos' });
  }
});

// Listar tipos de comandos disponíveis para um dispositivo
router.get('/types', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const types = await traccar.getCommandTypes(req.query.deviceId, req.query.textChannel === 'true');
    res.json(types);
  } catch (error) {
    console.error('Get command types error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar tipos de comandos' });
  }
});

// Obter comandos disponíveis para um dispositivo
router.get('/send', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const commands = await traccar.getCommandsForDevice(req.query.deviceId);
    res.json(commands);
  } catch (error) {
    console.error('Get commands for device error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar comandos do dispositivo' });
  }
});

// Criar comando salvo
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const command = await traccar.createCommand(req.body);
    res.status(201).json(command);
  } catch (error) {
    console.error('Create command error:', error.message);
    res.status(503).json({ error: 'Erro ao criar comando' });
  }
});

// Atualizar comando salvo
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const command = await traccar.updateCommand(req.params.id, req.body);
    res.json(command);
  } catch (error) {
    console.error('Update command error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar comando' });
  }
});

// Deletar comando salvo
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteCommand(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete command error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar comando' });
  }
});

// Enviar comando para dispositivo
router.post('/send', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const { deviceId, groupId, ...commandData } = req.body;

    let result;
    if (groupId) {
      result = await traccar.sendCommandToGroup(groupId, commandData);
    } else if (deviceId) {
      result = await traccar.sendCommand(deviceId, commandData);
    } else {
      return res.status(400).json({ error: 'deviceId ou groupId é obrigatório' });
    }

    res.json(result);
  } catch (error) {
    console.error('Send command error:', error.message);
    res.status(503).json({ error: 'Erro ao enviar comando' });
  }
});

module.exports = router;
