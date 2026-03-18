/**
 * Rotas de notificações
 * GET /api/notifications - Listar notificações
 * GET /api/notifications/types - Tipos de notificações disponíveis
 * POST /api/notifications - Criar notificação
 * PUT /api/notifications/:id - Atualizar notificação
 * DELETE /api/notifications/:id - Deletar notificação
 * POST /api/notifications/test - Enviar notificação de teste
 * POST /api/notifications/send/:notificator - Enviar notificação customizada
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar notificações
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const notifications = await traccar.getNotifications(req.query);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar notificações' });
  }
});

// Listar tipos de notificações disponíveis
router.get('/types', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const types = await traccar.getNotificationTypes();
    res.json(types);
  } catch (error) {
    console.error('Get notification types error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar tipos de notificações' });
  }
});

// Criar notificação
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const notification = await traccar.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error.message);
    res.status(503).json({ error: 'Erro ao criar notificação' });
  }
});

// Atualizar notificação
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const notification = await traccar.updateNotification(req.params.id, req.body);
    res.json(notification);
  } catch (error) {
    console.error('Update notification error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar notificação' });
  }
});

// Deletar notificação
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteNotification(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete notification error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar notificação' });
  }
});

// Enviar notificação de teste
router.post('/test', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.testNotification();
    res.status(204).send();
  } catch (error) {
    console.error('Test notification error:', error.message);
    res.status(503).json({ error: 'Erro ao enviar notificação de teste' });
  }
});

// Enviar notificação customizada
router.post('/send/:notificator', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const { userId, ...message } = req.body;
    await traccar.sendNotification(req.params.notificator, userId, message);
    res.status(204).send();
  } catch (error) {
    console.error('Send notification error:', error.message);
    res.status(503).json({ error: 'Erro ao enviar notificação' });
  }
});

module.exports = router;
