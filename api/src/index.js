const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const http = require('http');
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

// ====== TRACCAR WEBSOCKET BRIDGE ======
// Connects to Traccar's native WebSocket and broadcasts position updates to HSQ clients
const TRACCAR_URL = process.env.TRACCAR_URL || 'http://72.61.129.78:8082';
const TRACCAR_ADMIN_EMAIL = process.env.TRACCAR_ADMIN_EMAIL || 'admin@hsqrastreamento.com';
const TRACCAR_ADMIN_PASSWORD = process.env.TRACCAR_ADMIN_PASSWORD || 'HSQ@2026Admin!';
const JWT_SECRET = process.env.JWT_SECRET || 'hsq-jwt-secret-2026-prod';

let traccarSession = null;
let traccarWs = null;
let traccarReconnectTimer = null;
const hsqClients = new Set(); // Connected HSQ frontend clients

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
    console.log('[WS-Bridge] Traccar session obtained');
    return traccarSession;
  } catch (err) {
    console.error('[WS-Bridge] Failed to get Traccar session:', err.message);
    return null;
  }
}

function connectTraccarWebSocket() {
  if (traccarWs) {
    try { traccarWs.close(); } catch(e) {}
  }
  if (traccarReconnectTimer) {
    clearTimeout(traccarReconnectTimer);
    traccarReconnectTimer = null;
  }

  if (!traccarSession) {
    console.log('[WS-Bridge] No session, will retry in 5s...');
    traccarReconnectTimer = setTimeout(async () => {
      await getTraccarSession();
      connectTraccarWebSocket();
    }, 5000);
    return;
  }

  const wsUrl = TRACCAR_URL.replace('http', 'ws') + '/api/socket';
  console.log('[WS-Bridge] Connecting to Traccar WebSocket:', wsUrl);

  traccarWs = new WebSocket(wsUrl, {
    headers: { Cookie: traccarSession },
  });

  traccarWs.on('open', () => {
    console.log('[WS-Bridge] Connected to Traccar WebSocket! Broadcasting to', hsqClients.size, 'clients');
  });

  traccarWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Traccar sends: { devices: [...], positions: [...] }
      // Forward position updates to all connected HSQ clients
      if (msg.positions && msg.positions.length > 0) {
        const broadcast = JSON.stringify({
          type: 'positions',
          positions: msg.positions.map(p => ({
            deviceId: p.deviceId,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ? Math.round(p.speed * 1.852) : 0, // knots to km/h
            course: p.course || 0,
            altitude: p.altitude || 0,
            fixTime: p.fixTime,
            accuracy: p.accuracy || 0,
            attributes: p.attributes || {},
          })),
        });
        hsqClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          }
        });
      }
      // Also forward device status updates
      if (msg.devices && msg.devices.length > 0) {
        const broadcast = JSON.stringify({
          type: 'devices',
          devices: msg.devices.map(d => ({
            deviceId: d.id,
            name: d.name,
            status: d.status,
            lastUpdate: d.lastUpdate,
            category: d.category || 'car',
          })),
        });
        hsqClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          }
        });
      }
    } catch (err) {
      // Not JSON or parse error, ignore
    }
  });

  traccarWs.on('close', (code, reason) => {
    console.log('[WS-Bridge] Traccar WebSocket closed:', code, reason?.toString());
    traccarWs = null;
    // Reconnect after 3s
    traccarReconnectTimer = setTimeout(async () => {
      await getTraccarSession();
      connectTraccarWebSocket();
    }, 3000);
  });

  traccarWs.on('error', (err) => {
    console.error('[WS-Bridge] Traccar WebSocket error:', err.message);
  });
}

// Create HTTP server + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/tracking' });

wss.on('connection', (ws, req) => {
  // Authenticate via token in query string
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    ws.userId = decoded.id;
    ws.userRole = decoded.role;
    ws.traccarUserId = decoded.traccarUserId;
  } catch (err) {
    ws.close(4002, 'Invalid token');
    return;
  }

  hsqClients.add(ws);
  console.log('[WS-Bridge] HSQ client connected. Total:', hsqClients.size);

  // Send a welcome message
  ws.send(JSON.stringify({ type: 'connected', message: 'Real-time tracking active' }));

  ws.on('close', () => {
    hsqClients.delete(ws);
    console.log('[WS-Bridge] HSQ client disconnected. Total:', hsqClients.size);
  });

  ws.on('error', () => {
    hsqClients.delete(ws);
  });
});

const PORT = process.env.PORT || 4080;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`HSQ Portal API running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws/tracking`);
  // Run seed
  try {
    const seed = require('./seed');
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
  // Start Traccar WebSocket bridge
  await getTraccarSession();
  connectTraccarWebSocket();
});
