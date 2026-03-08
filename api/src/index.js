const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

// Routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const adminRoutes = require('./routes/admin');

const app = express();

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

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 4080;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`HSQ Portal API running on port ${PORT}`);
  // Run seed
  try {
    const seed = require('./seed');
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
});
