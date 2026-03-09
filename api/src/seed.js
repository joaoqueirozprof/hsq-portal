// Run on startup to ensure schema and admin user exist
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    traccar_user_id INTEGER,
    document VARCHAR(18) NOT NULL UNIQUE,
    document_type VARCHAR(4) NOT NULL CHECK (document_type IN ('CPF', 'CNPJ')),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    contact_person VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_first_login BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT true,
    onboarding_completed BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    last_logout_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_type VARCHAR(10) NOT NULL,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document);
CREATE INDEX IF NOT EXISTS idx_clients_traccar_user_id ON clients(traccar_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_last_login ON clients(last_login_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
`;

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://hsq_admin:HsqSecure2026@hsq-db:5432/hsq_portal',
  });

  try {
    // Ensure schema exists
    console.log('Ensuring database schema...');
    await pool.query(SCHEMA_SQL);
    console.log('Schema OK');

    // Check if admin exists
    const existing = await pool.query("SELECT id FROM admin_users WHERE email = 'admin@hsqrastreamento.com'");
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('HSQ@2026Admin!', 10);
      await pool.query(
        "INSERT INTO admin_users (email, password_hash, name) VALUES ($1, $2, $3)",
        ['admin@hsqrastreamento.com', hash, 'HSQ Admin']
      );
      console.log('Admin user created: admin@hsqrastreamento.com');
    } else {
      console.log('Admin user already exists');
    }

    // Also create Oeste Frios as first client if not exists
    const oesteFrios = await pool.query("SELECT id FROM clients WHERE document = '00.000.000/0001-00'");
    if (oesteFrios.rows.length === 0) {
      await pool.query(
        `INSERT INTO clients (document, document_type, name, trade_name, phone, city, state, traccar_user_id, is_first_login, must_change_password, onboarding_completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (document) DO NOTHING`,
        ['00.000.000/0001-00', 'CNPJ', 'Oeste Frios Atacado e Varejo', 'Oeste Frios', '(84) 99999-0000',
         'Pau dos Ferros', 'RN', 2, false, false, true]
      );
      console.log('Oeste Frios client seeded');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await pool.end();
  }
}

module.exports = seed;
