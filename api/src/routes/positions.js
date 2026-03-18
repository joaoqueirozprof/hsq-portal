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
    const devices = await t.getDevices();
    const positions = await Promise.all(devices.map(async (device) => {
      try {
        const position = await t.getLatestPosition(device.id);
        return position ? {
          deviceId: device.id, deviceName: device.name, uniqueId: device.uniqueId,
          status: device.status, lat: position.latitude, lng: position.longitude,
          speed: position.speed ? Math.round(position.speed * 1.852) : 0,
          course: position.course, altitude: position.altitude,
          timestamp: position.fixTime, attributes: position.attributes
        } : null;
      } catch (e) { return null; }
    }));
    res.json(positions.filter(p => p !== null));
  } catch (e) { console.error('Get all positions error:', e.message); res.status(503).json({ error: 'Erro ao buscar posições' }); }
});
router.get('/export/kml', async (req, res) => {
  try {
    const t = getTraccar();
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
    const r = await t.client.get('/api/positions/kml', { params: { deviceId, from, to }, responseType: 'text' });
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'attachment; filename=rota.kml');
    res.send(r.data);
  } catch (e) { res.status(503).json({ error: 'Erro ao exportar KML' }); }
});
router.get('/export/csv', async (req, res) => {
  try {
    const t = getTraccar();
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
    const r = await t.client.get('/api/positions/csv', { params: req.query, responseType: 'text' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=posicoes.csv');
    res.send(r.data);
  } catch (e) { res.status(503).json({ error: 'Erro ao exportar CSV' }); }
});
router.get('/export/gpx', async (req, res) => {
  try {
    const t = getTraccar();
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
    const r = await t.client.get('/api/positions/gpx', { params: { deviceId, from, to }, responseType: 'text' });
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', 'attachment; filename=rota.gpx');
    res.send(r.data);
  } catch (e) { res.status(503).json({ error: 'Erro ao exportar GPX' }); }
});
router.get('/:deviceId', async (req, res) => {
  try {
    const t = getTraccar();
    const { from, to } = req.query;
    if (!from && !to) {
      const position = await t.getLatestPosition(req.params.deviceId);
      if (!position) return res.status(404).json({ error: 'Posição não encontrada' });
      return res.json([{ deviceId: position.deviceId, lat: position.latitude, lng: position.longitude, speed: position.speed, course: position.course, timestamp: position.fixTime }]);
    }
    const positions = await t.getPositions(req.params.deviceId, from, to);
    res.json(positions.map(p => ({ deviceId: p.deviceId, lat: p.latitude, lng: p.longitude, speed: p.speed, course: p.course, altitude: p.altitude, timestamp: p.fixTime, accuracy: p.accuracy, attributes: p.attributes })));
  } catch (e) { console.error('Get positions error:', e.message); res.status(503).json({ error: 'Erro ao buscar posições' }); }
});
router.delete('/', adminOnly, async (req, res) => {
  try {
    const t = getTraccar();
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
    await t.client.delete('/api/positions', { params: { deviceId, from, to } });
    res.status(204).send();
  } catch (e) { res.status(503).json({ error: 'Erro ao deletar posições' }); }
});
module.exports = router;
