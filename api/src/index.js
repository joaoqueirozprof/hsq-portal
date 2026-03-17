/**
 * HSQ Portal API - Servidor principal
 * Conexão robusta com Traccar API via Bearer Token
 * Usuários e logs armazenados no próprio banco PostgreSQL
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./config/database');

// Importar rotas
const authRoutes = require('./routes/auth');
const devicesRoutes = require('./routes/devices');
const positionsRoutes = require('./routes/positions');
const geofencesRoutes = require('./routes/geofences');
const reportsRoutes = require('./routes/reports');

const app = express();

// Middleware de segurança
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Muitas requisições, tente novamente mais tarde' }
});
app.use('/api/', limiter);

// Parser de JSON
app.use(express.json());

//health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/geofences', geofencesRoutes);
app.use('/api/reports', reportsRoutes);

// Rota de informações do servidor
app.get('/api/server/info', async (req, res) => {
  try {
    const { createTraccarClient } = require('./services/traccar');
    const traccar = createTraccarClient({
      traccarUrl: process.env.TRACCAR_URL,
      traccarToken: process.env.TRACCAR_TOKEN
    });

    const serverInfo = await traccar.getServer();

    res.json({
      server: serverInfo,
      api: {
        version: '1.0.0',
        traccarUrl: process.env.TRACCAR_URL
      }
    });
  } catch (error) {
    console.error('Get server info error:', error.message);
    res.status(503).json({ error: 'Erro ao obter informações do servidor' });
  }
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializar banco de dados e servidor
const PORT = process.env.PORT || 4080;

async function initDatabase() {
  try {
    // Criar tabelas se não existirem
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
    console.log(`🚀 HSQ Portal API rodando na porta ${PORT}`);
    console.log(`📡 Conectado ao Traccar: ${process.env.TRACCAR_URL}`);
  });
}

start();
