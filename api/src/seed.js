// Run on startup to ensure admin user exists
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://hsq_admin:HsqSecure2026@hsq-db:5432/hsq_portal',
  });

  try {
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
      // Check if Oeste Frios user exists in Traccar (user ID 2)
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
