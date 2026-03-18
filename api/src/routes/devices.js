const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');
router.use(authMiddleware);
function getTraccar() {
  return createTraccarClient({ traccarUrl: process.env.TRACCAR_URL, traccarToken: process.env.TRACCAR_TOKEN });
}
router.get('/', async (req, res) => {
  try {
    const t = getTraccar();
    let devices = await t.getDevices();
    if (req.query.groupId) devices = devices.filter(d => d.groupId === parseInt(req.query.groupId));
    res.json(devices.map(d => ({
      id: d.id, name: d.name, uniqueId: d.uniqueId, status: d.status,
      lastUpdate: d.lastUpdate, positionId: d.positionId, groupId: d.groupId,
      attributes: { phone: d.attributes?.phone, model: d.attributes?.model, contact: d.attributes?.contact, category: d.attributes?.category }
    })));
  } catch (e) { console.error('Get devices error:', e.message); res.status(503).json({ error: 'Erro ao buscar dispositivos' }); }
});
router.get('/:id', async (req, res) => {
  try { const t = getTraccar(); const r = await t.getDevice(req.params.id); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao buscar dispositivo' }); }
});
router.get('/:id/position', async (req, res) => {
  try {
    const t = getTraccar();
    const position = await t.getLatestPosition(req.params.id);
    if (!position) return res.status(404).json({ error: 'Posição não encontrada' });
    res.json({ deviceId: position.deviceId, latitude: position.latitude, longitude: position.longitude, speed: position.speed, course: position.course, altitude: position.altitude, timestamp: position.fixTime, attributes: position.attributes });
  } catch (e) { res.status(503).json({ error: 'Erro ao buscar posição' }); }
});
router.put('/:id/accumulators', adminOnly, async (req, res) => {
  try {
    const t = getTraccar();
    await t.client.put('/api/devices/' + req.params.id + '/accumulators', req.body);
    res.status(204).send();
  } catch (e) { console.error('Update accumulators error:', e.message); res.status(503).json({ error: 'Erro ao atualizar hodômetro' }); }
});
router.post('/share', adminOnly, async (req, res) => {
  try {
    const t = getTraccar();
    const r = await t.client.post('/api/devices/share', req.body);
    res.json(r.data);
  } catch (e) { console.error('Share device error:', e.message); res.status(503).json({ error: 'Erro ao compartilhar dispositivo' }); }
});
router.post('/', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.createDevice(req.body); res.status(201).json(r); }
  catch (e) { console.error('Create device error:', e.message); res.status(503).json({ error: 'Erro ao criar dispositivo' }); }
});
router.put('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); const r = await t.updateDevice(req.params.id, req.body); res.json(r); }
  catch (e) { res.status(503).json({ error: 'Erro ao atualizar dispositivo' }); }
});
router.delete('/:id', adminOnly, async (req, res) => {
  try { const t = getTraccar(); await t.deleteDevice(req.params.id); res.status(204).send(); }
  catch (e) { res.status(503).json({ error: 'Erro ao deletar dispositivo' }); }
});
module.exports = router;
