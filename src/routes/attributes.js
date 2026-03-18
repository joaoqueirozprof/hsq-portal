/**
 * Rotas de atributos computados
 * GET /api/attributes - Listar atributos
 * POST /api/attributes - Criar atributo
 * PUT /api/attributes/:id - Atualizar atributo
 * DELETE /api/attributes/:id - Deletar atributo
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Listar atributos computados
router.get('/', async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const attributes = await traccar.getComputedAttributes(req.query);
    res.json(attributes);
  } catch (error) {
    console.error('Get attributes error:', error.message);
    res.status(503).json({ error: 'Erro ao buscar atributos' });
  }
});

// Criar atributo computado
router.post('/', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const attribute = await traccar.createComputedAttribute(req.body);
    res.status(201).json(attribute);
  } catch (error) {
    console.error('Create attribute error:', error.message);
    res.status(503).json({ error: 'Erro ao criar atributo' });
  }
});

// Atualizar atributo computado
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    const attribute = await traccar.updateComputedAttribute(req.params.id, req.body);
    res.json(attribute);
  } catch (error) {
    console.error('Update attribute error:', error.message);
    res.status(503).json({ error: 'Erro ao atualizar atributo' });
  }
});

// Deletar atributo computado
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });
    await traccar.deleteComputedAttribute(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete attribute error:', error.message);
    res.status(503).json({ error: 'Erro ao deletar atributo' });
  }
});

module.exports = router;
