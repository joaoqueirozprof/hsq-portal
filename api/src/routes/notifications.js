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
    const notifications = await traccar.getNotifications();
    res.json(notifications || []);
  } catch (error) {
    console.error('Get notifications error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar notificações' });
  }
});

router.get('/types', async (req, res) => {
  try {
    const traccar = getTraccar();
    const response = await traccar.client.get('/api/notifications/types');
    res.json(response.data || []);
  } catch (error) {
    res.status(503).json({ error: 'Erro ao buscar tipos' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const notification = await traccar.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error.message);
    res.status(503).json({ error: 'Erro ao criar notificação' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    const notification = await traccar.updateNotification(req.params.id, req.body);
    res.json(notification);
  } catch (error) {
    console.error('Update notification error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar notificação' });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = getTraccar();
    await traccar.deleteNotification(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete notification error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar notificação' });
  }
});

module.exports = router;
