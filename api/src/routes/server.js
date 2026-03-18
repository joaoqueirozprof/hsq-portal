const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');
router.use(authMiddleware);
function getTraccar() {
  return createTraccarClient({ traccarUrl: process.env.TRACCAR_URL, traccarToken: process.env.TRACCAR_TOKEN });
}
router.get('/geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat e lon são obrigatórios' });
    const t = getTraccar();
    const r = await t.client.get('/api/server/geocode', { params: { latitude: lat, longitude: lon } });
    res.json(r.data);
  } catch (e) { res.status(503).json({ error: 'Erro ao geocodificar' }); }
});
router.get('/timezones', async (req, res) => {
  try { const t = getTraccar(); const r = await t.client.get('/api/server/timezones'); res.json(r.data); }
  catch (e) { res.status(503).json({ error: 'Erro ao buscar timezones' }); }
});
router.put('/', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.client.put('/api/server', req.body); res.json(r.data); }
  catch (e) { res.status(503).json({ error: 'Erro ao atualizar servidor' }); }
});
router.get('/info', async (req, res) => {
  try {
    const t = getTraccar();
    const r = await t.client.get('/api/server');
    res.json({ server: r.data, api: { version: '2.0.0', traccarVersion: '6.12.2' } });
  } catch (e) { res.status(503).json({ error: 'Erro ao obter informações do servidor' }); }
});
module.exports = router;
