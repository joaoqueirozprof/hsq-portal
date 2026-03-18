/**
 * Rotas de calendários
 * GET /api/calendars - Listar calendários
 * GET /api/calendars/:id - Obter calendário
 * POST /api/calendars - Criar calendário
 * PUT /api/calendars/:id - Atualizar calendário
 * DELETE /api/calendars/:id - Deletar calendário
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar calendários
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const calendars = await traccar.getCalendars(req.query);
    res.json(calendars);
  } catch (error) {
    console.error('Get calendars error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar calendários' });
  }
});

// Obter calendário específico
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const calendar = await traccar.getCalendar(req.params.id);
    res.json(calendar);
  } catch (error) {
    console.error('Get calendar error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar calendário' });
  }
});

// Criar calendário
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const calendar = await traccar.createCalendar(req.body);
    res.status(201).json(calendar);
  } catch (error) {
    console.error('Create calendar error:', error.message);
    res.status(503).json({ error: 'Erro ao criar calendário' });
  }
});

// Atualizar calendário
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const calendar = await traccar.updateCalendar(req.params.id, req.body);
    res.json(calendar);
  } catch (error) {
    console.error('Update calendar error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar calendário' });
  }
});

// Deletar calendário
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteCalendar(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete calendar error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar calendário' });
  }
});

module.exports = router;
