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

// SSE endpoint MUST be defined before tracking routes (to avoid auth middleware)
// Actual handler is set up after bridge variables are initialized (see below)
const JWT_SECRET = process.env.JWT_SECRET || 'hsq-jwt-secret-2026-prod';
const sseClients = new Set();

app.get('/api/tracking/stream', (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Real-time tracking active' })}\n\n`);

  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch(e) { clearInterval(keepalive); }
  }, 15000);

  sseClients.add(res);
  console.log('[SSE] Client connected. Total:', sseClients.size);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(res);
    console.log('[SSE] Client disconnected. Total:', sseClients.size);
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
// Client-side: SSE (Server-Sent Events) — works through any HTTP proxy
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

function broadcastToSSEClients(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch(e) { sseClients.delete(client); }
  });
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
    console.log('[Bridge] Connected to Traccar! SSE clients:', sseClients.size);
  });

  traccarWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.positions && msg.positions.length > 0) {
        broadcastToSSEClients('positions', {
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
        broadcastToSSEClients('devices', {
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
  console.log(`SSE endpoint: /api/tracking/stream`);
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
