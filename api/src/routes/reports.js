/**
 * Rotas de relatórios
 * GET /api/reports/trips - Relatório de viagens
 * GET /api/reports/summary - Resumo geral
 * GET /api/reports/events - Relatório de eventos
 * GET /api/reports/route - Rota percorrida
 * GET /api/reports/stops - Paradas
 * GET /api/reports/geofences - Tempo em geofences
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

// Middleware para validar parâmetros de relatório
function validateReportParams(req, res, next) {
  const { deviceId, groupId, from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Parâmetros "from" e "to" são obrigatórios' });
  }

  if (!deviceId && !groupId && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'Informe deviceId ou groupId' });
  }

  next();
}

// Helper para converter datas para formato ISO
function toISO(dateStr) {
  if (!dateStr) return dateStr;
  if (dateStr.includes('T')) return dateStr;
  return new Date(dateStr).toISOString();
}

// GET /api/reports/trips - Relatório de viagens
router.get('/trips', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 120000 // 2 minutos para relatórios longos
    });

    const { deviceId, groupId, from, to } = req.query;
    const params = { from: toISO(from), to: toISO(to) };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;

    const trips = await traccar.getTripsReport(params);

    const formatted = (trips || []).map(trip => ({
      deviceId: trip.deviceId,
      deviceName: trip.deviceName,
      maxSpeed: trip.maxSpeed ? Math.round(trip.maxSpeed * 1.852) : 0,
      averageSpeed: trip.averageSpeed ? Math.round(trip.averageSpeed * 1.852) : 0,
      distance: trip.distance ? (trip.distance / 1000).toFixed(2) : 0,
      spentFuel: trip.spentFuel || 0,
      duration: trip.duration,
      durationFormatted: formatDuration(trip.duration),
      startTime: trip.startTime,
      startAddress: trip.startAddress || null,
      endTime: trip.endTime,
      endAddress: trip.endAddress || null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Trips report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório de viagens' });
  }
});

// GET /api/reports/summary - Resumo geral
router.get('/summary', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 120000
    });

    const { deviceId, groupId, from, to } = req.query;
    const params = { from: toISO(from), to: toISO(to) };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;

    const summary = await traccar.getSummaryReport(params);

    const formatted = (summary || []).map(item => ({
      deviceId: item.deviceId,
      deviceName: item.deviceName,
      maxSpeed: item.maxSpeed ? Math.round(item.maxSpeed * 1.852) : 0,
      averageSpeed: item.averageSpeed ? Math.round(item.averageSpeed * 1.852) : 0,
      distance: item.distance ? (item.distance / 1000).toFixed(2) : 0,
      spentFuel: item.spentFuel || 0,
      engineHours: item.engineHours || 0,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Summary report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório resumido' });
  }
});

// GET /api/reports/events - Relatório de eventos
router.get('/events', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const { deviceId, groupId, from, to, type } = req.query;
    const params = { from: toISO(from), to: toISO(to) };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;
    if (type) params.type = type;

    const events = await traccar.getEventsReport(params);
    res.json(events || []);
  } catch (error) {
    console.error('Events report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório de eventos' });
  }
});

// GET /api/reports/route - Rota percorrida
router.get('/route', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 120000
    });

    const { deviceId, from, to } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId é obrigatório para rota' });
    }

    const route = await traccar.getRouteReport(deviceId, from, to);

    const formatted = (route || []).map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed ? Math.round(p.speed * 1.852) : 0,
      course: p.course || 0,
      time: p.fixTime,
      address: p.address || null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Route report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório de rota' });
  }
});

// GET /api/reports/stops - Paradas
router.get('/stops', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 120000
    });

    const { deviceId, groupId, from, to } = req.query;
    const params = { from: toISO(from), to: toISO(to) };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;

    const stops = await traccar.getStopsReport(params);

    const formatted = (stops || []).map(stop => ({
      deviceId: stop.deviceId,
      deviceName: stop.deviceName,
      duration: stop.duration,
      durationFormatted: formatDuration(stop.duration),
      startTime: stop.startTime,
      endTime: stop.endTime,
      latitude: stop.latitude,
      longitude: stop.longitude,
      address: stop.address || null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Stops report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório de paradas' });
  }
});

// GET /api/reports/geofences - Tempo em geofences
router.get('/geofences', validateReportParams, async (req, res) => {
  try {
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 120000
    });

    const { deviceId, groupId, from, to } = req.query;
    const params = { from: toISO(from), to: toISO(to) };
    if (deviceId) params.deviceId = deviceId;
    if (groupId) params.groupId = groupId;

    const geofenceData = await traccar.getGeofencesReport(params);

    const formatted = (geofenceData || []).map(g => ({
      deviceId: g.deviceId,
      deviceName: g.deviceName,
      geofenceId: g.geofenceId,
      duration: g.duration,
      durationFormatted: formatDuration(g.duration),
      startTime: g.startTime,
      endTime: g.endTime,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Geofences report error:', error.message);
    res.status(503).json({ error: 'Erro ao gerar relatório de geofences' });
  }
});

// Função para formatar duração
function formatDuration(seconds) {
  if (!seconds) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

module.exports = router;
