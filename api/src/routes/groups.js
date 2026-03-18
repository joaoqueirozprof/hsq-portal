const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');
router.use(authMiddleware);
function getTraccar() {
  return createTraccarClient({ traccarUrl: process.env.TRACCAR_URL, traccarToken: process.env.TRACCAR_TOKEN });
}
router.get('/', async (req, res) => {
  try { const t = getTraccar(); const r = await t.getGroups(); res.json(r || []); }
  catch (e) { console.error('Get groups error:', e.message); res.status(503).json({ error: 'Erro ao buscar grupos' }); }
});
router.get('/:id', async (req, res) => {
  try { const t = getTraccar(); const r = await t.getGroup(req.params.id); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao buscar grupo' }); }
});
router.post('/', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.createGroup(req.body); res.status(201).json(r); }
  catch (e) { console.error('Create group error:', e.message); res.status(503).json({ error: 'Erro ao criar grupo' }); }
});
router.put('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.updateGroup(req.params.id, req.body); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao atualizar grupo' }); }
});
router.delete('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); await t.deleteGroup(req.params.id); res.status(204).send(); }
  catch (e) { res.status(503).json({ error: 'Erro ao deletar grupo' }); }
});
module.exports = router;
