/**
 * Rotas de pedidos
 * GET /api/orders - Listar pedidos
 * GET /api/orders/:id - Obter pedido
 * POST /api/orders - Criar pedido
 * PUT /api/orders/:id - Atualizar pedido
 * DELETE /api/orders/:id - Deletar pedido
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar pedidos
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const orders = await traccar.getOrders(req.query);
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar pedidos' });
  }
});

// Obter pedido específico
router.get('/:id', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const order = await traccar.getOrder(req.params.id);
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar pedido' });
  }
});

// Criar pedido
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const order = await traccar.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error.message);
    res.status(503).json({ error: 'Erro ao criar pedido' });
  }
});

// Atualizar pedido
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const order = await traccar.updateOrder(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar pedido' });
  }
});

// Deletar pedido
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteOrder(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete order error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar pedido' });
  }
});

module.exports = router;
