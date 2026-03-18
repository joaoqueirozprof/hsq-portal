require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./config/database');

const authRoutes = require('./routes/auth');
const devicesRoutes = require('./routes/devices');
const positionsRoutes = require('./routes/positions');
const geofencesRoutes = require('./routes/geofences');
const reportsRoutes = require('./routes/reports');
const driversRoutes = require('./routes/drivers');
const maintenanceRoutes = require('./routes/maintenance');
const commandsRoutes = require('./routes/commands');
const notificationsRoutes = require('./routes/notifications');
const permissionsRoutes = require('./routes/permissions');
const calendarRoutes = require('./routes/calendar');
const attributesRoutes = require('./routes/attributes');
const statisticsRoutes = require('./routes/statistics');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const eventsRoutes = require('./routes/events');
const realtimeRoutes = require('./routes/realtime');
const groupsRoutes = require('./routes/groups');
const serverRoutes = require('./routes/server');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: { error: 'Muitas requisições, tente novamente mais tarde' },
  trustProxy: true
});
app.use('/api/', limiter);
app.use(express.json());

app.get('/api/health', async (req, res) => {
  let traccarStatus = 'unavailable';
  try {
    const { createTraccarClient } = require('./services/traccar');
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN,
      timeout: 5000
    });
    await traccar.getServer();
    traccarStatus = 'connected';
  } catch (e) {}
  res.json({ status: 'ok', traccar: traccarStatus, timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/geofences', geofencesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/attributes', attributesRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/server', serverRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 4080;

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS login_logs (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        status VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS api_logs (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        method VARCHAR(10) NOT NULL,
        path VARCHAR(500) NOT NULL,
        status_code INTEGER,
        response_time INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
    `);
    console.log('✅ Banco de dados inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
  }
}

async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HSQ Portal API v2.0 rodando na porta ${PORT}`);
    console.log(`📡 Traccar: ${process.env.TRACCAR_URL}`);
    console.log('✅ Rotas: auth, devices, positions, geofences, reports, drivers, maintenance, commands, notifications, permissions, calendars, attributes, statistics, orders, users, events, realtime, groups, server');
  });
}

start();
