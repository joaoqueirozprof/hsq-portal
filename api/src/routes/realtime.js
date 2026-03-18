const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createTraccarClient } = require('../services/traccar');

router.use(authMiddleware);

router.get('/positions', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const traccar = createTraccarClient({
    traccarUrl: process.env.TRACCAR_URL,
    traccarToken: process.env.TRACCAR_TOKEN
  });

  const sendPositions = async () => {
    try {
      const devices = await traccar.getDevices();
      const positions = await Promise.all(
        devices.map(async (device) => {
          try {
            const position = await traccar.getLatestPosition(device.id);
            if (!position) return null;
            return {
              deviceId: device.id,
              deviceName: device.name,
              uniqueId: device.uniqueId,
              status: device.status,
              lat: position.latitude,
              lng: position.longitude,
              speed: position.speed ? Math.round(position.speed * 1.852) : 0,
              course: position.course,
              timestamp: position.fixTime,
              attributes: position.attributes
            };
          } catch (e) { return null; }
        })
      );
      const valid = positions.filter(p => p !== null);
      res.write('data: ' + JSON.stringify(valid) + '\n\n');
    } catch (error) {
      res.write('data: ' + JSON.stringify({ error: error.message }) + '\n\n');
    }
  };

  sendPositions();
  const interval = setInterval(sendPositions, 10000);
  req.on('close', () => clearInterval(interval));
});

module.exports = router;
