const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');
router.use(authMiddleware);
function getTraccar() {
  return createTraccarClient({ traccarUrl: process.env.TRACCAR_URL, traccarToken: process.env.TRACCAR_TOKEN });
}
router.get('/', async (req, res) => {
  try { const t = getTraccar(); const r = await t.getMaintenances(req.query); res.json(r || []); }
  catch (e) { console.error('Get maintenance error:', e.message); res.status(503).json({ error: 'Erro ao buscar manutenções' }); }
});
router.get('/:id', async (req, res) => {
  try { const t = getTraccar(); const r = await t.getMaintenance(req.params.id); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao buscar manutenção' }); }
});
router.post('/', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.createMaintenance(req.body); res.status(201).json(r); }
  catch (e) { console.error('Create maintenance error:', e.message); res.status(503).json({ error: 'Erro ao criar manutenção' }); }
});
router.put('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.updateMaintenance(req.params.id, req.body); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao atualizar manutenção' }); }
});
router.delete('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); await t.deleteMaintenance(req.params.id); res.status(204).send(); }
  catch (e) { res.status(503).json({ error: 'Erro ao deletar manutenção' }); }
});
module.exports = router;
