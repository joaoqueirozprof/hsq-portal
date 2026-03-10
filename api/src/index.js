const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const adminRoutes = require('./routes/admin');
const trackingRoutes = require('./routes/tracking');
const geocodeRoutes = require('./routes/geocode');

const app = express();
app.set("trust proxy", 1);

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hsq_admin:HsqSecure2026@hsq-db:5432/hsq_portal',
});

// Make pool available to routes
app.locals.db = pool;
app.locals.traccarUrl = process.env.TRACCAR_URL || 'http://72.61.129.78:8082';
app.locals.jwtSecret = process.env.JWT_SECRET || 'hsq-jwt-secret-2026-prod';

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/auth', limiter);

// ====== LONG POLLING for real-time tracking ======
// Hostinger host nginx buffers SSE/WebSocket, so we use long polling instead.
// Client polls /api/tracking/poll?since=<timestamp>, server holds request until
// new data arrives or 25s timeout, then responds with positions/devices.
const JWT_SECRET = process.env.JWT_SECRET || 'hsq-jwt-secret-2026-prod';

// Shared buffer for latest Traccar data (filled by WS bridge below)
let latestPositions = [];
let latestDevices = [];
let lastUpdateTime = 0;
const pollWaiters = new Set(); // { res, since, timer }

function notifyPollWaiters() {
  const now = lastUpdateTime;
  pollWaiters.forEach(waiter => {
    if (waiter.since < now) {
      clearTimeout(waiter.timer);
      pollWaiters.delete(waiter);
      try {
        waiter.res.json({
          positions: latestPositions,
          devices: latestDevices,
          timestamp: now,
        });
      } catch(e) {}
    }
  });
}

app.get('/api/tracking/poll', (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const since = parseInt(req.query.since) || 0;

  // If we already have newer data, respond immediately
  if (lastUpdateTime > since && (latestPositions.length > 0 || latestDevices.length > 0)) {
    return res.json({
      positions: latestPositions,
      devices: latestDevices,
      timestamp: lastUpdateTime,
    });
  }

  // Otherwise hold the request until new data arrives (long poll)
  const timer = setTimeout(() => {
    pollWaiters.delete(waiter);
    res.json({ positions: [], devices: [], timestamp: lastUpdateTime || Date.now() });
  }, 25000); // 25s timeout (less than typical proxy timeout of 60s)

  const waiter = { res, since, timer };
  pollWaiters.add(waiter);

  req.on('close', () => {
    clearTimeout(timer);
    pollWaiters.delete(waiter);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/geocode', geocodeRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ====== TRACCAR REAL-TIME BRIDGE ======
// Server-side: WebSocket to Traccar's native API
// Client-side: Long polling — works through any HTTP proxy (Hostinger buffers SSE)
const TRACCAR_URL = process.env.TRACCAR_URL || 'http://72.61.129.78:8082';
const TRACCAR_ADMIN_EMAIL = process.env.TRACCAR_ADMIN_EMAIL || 'admin@hsqrastreamento.com';
const TRACCAR_ADMIN_PASSWORD = process.env.TRACCAR_ADMIN_PASSWORD || 'HSQ@2026Admin!';

let traccarSession = null;
let traccarWs = null;
let traccarReconnectTimer = null;

async function getTraccarSession() {
  try {
    const params = new URLSearchParams();
    params.append('email', TRACCAR_ADMIN_EMAIL);
    params.append('password', TRACCAR_ADMIN_PASSWORD);
    const resp = await axios.post(`${TRACCAR_URL}/api/session`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const cookies = resp.headers['set-cookie'];
    if (cookies) {
      traccarSession = cookies.map(c => c.split(';')[0]).join('; ');
    }
    console.log('[Bridge] Traccar session obtained');
    return traccarSession;
  } catch (err) {
    console.error('[Bridge] Failed to get Traccar session:', err.message);
    return null;
  }
}

function onTraccarData(eventType, data) {
  if (eventType === 'positions') {
    latestPositions = data.positions || [];
  }
  if (eventType === 'devices') {
    latestDevices = data.devices || [];
  }
  lastUpdateTime = Date.now();
  // Wake up all long poll waiters
  notifyPollWaiters();
}

function connectTraccarWebSocket() {
  if (traccarWs) { try { traccarWs.close(); } catch(e) {} }
  if (traccarReconnectTimer) { clearTimeout(traccarReconnectTimer); traccarReconnectTimer = null; }

  if (!traccarSession) {
    console.log('[Bridge] No session, will retry in 5s...');
    traccarReconnectTimer = setTimeout(async () => {
      await getTraccarSession();
      connectTraccarWebSocket();
    }, 5000);
    return;
  }

  const wsUrl = TRACCAR_URL.replace('http', 'ws') + '/api/socket';
  console.log('[Bridge] Connecting to Traccar WS:', wsUrl);

  traccarWs = new WebSocket(wsUrl, { headers: { Cookie: traccarSession } });

  traccarWs.on('open', () => {
    console.log('[Bridge] Connected to Traccar! Poll waiters:', pollWaiters.size);
  });

  traccarWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.positions && msg.positions.length > 0) {
        onTraccarData('positions', {
          positions: msg.positions.map(p => ({
            deviceId: p.deviceId,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ? Math.round(p.speed * 1.852) : 0,
            course: p.course || 0,
            altitude: p.altitude || 0,
            fixTime: p.fixTime,
            accuracy: p.accuracy || 0,
            attributes: p.attributes || {},
          })),
        });
      }
      if (msg.devices && msg.devices.length > 0) {
        onTraccarData('devices', {
          devices: msg.devices.map(d => ({
            deviceId: d.id,
            name: d.name,
            status: d.status,
            lastUpdate: d.lastUpdate,
            category: d.category || 'car',
          })),
        });
      }
    } catch (err) { /* ignore parse errors */ }
  });

  traccarWs.on('close', (code, reason) => {
    console.log('[Bridge] Traccar WS closed:', code, reason?.toString());
    traccarWs = null;
    traccarReconnectTimer = setTimeout(async () => {
      await getTraccarSession();
      connectTraccarWebSocket();
    }, 3000);
  });

  traccarWs.on('error', (err) => {
    console.error('[Bridge] Traccar WS error:', err.message);
  });
}

const PORT = process.env.PORT || 4080;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`HSQ Portal API running on port ${PORT}`);
  console.log(`Long poll endpoint: /api/tracking/poll`);
  // Run seed
  try {
    const seed = require('./seed');
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
  // Start Traccar bridge
  await getTraccarSession();
  connectTraccarWebSocket();
});
