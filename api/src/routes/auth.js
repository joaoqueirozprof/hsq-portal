const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TraccarService = require('../services/traccar');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Utility: clean document (remove formatting)
function cleanDoc(doc) {
  return doc.replace(/[.\-\/]/g, '');
}

// Utility: validate CPF
function isValidCPF(cpf) {
  cpf = cleanDoc(cpf);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 > 9) d1 = 0;
  if (parseInt(cpf[9]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 > 9) d2 = 0;
  return parseInt(cpf[10]) === d2;
}

// Utility: validate CNPJ
function isValidCNPJ(cnpj) {
  cnpj = cleanDoc(cnpj);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * w1[i];
  let d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cnpj[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * w2[i];
  let d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(cnpj[13]) === d2;
}

// POST /api/auth/login - Client login with CPF/CNPJ
router.post('/login', async (req, res) => {
  try {
    const { document, password } = req.body;
    if (!document || !password) {
      return res.status(400).json({ error: 'Documento e senha sao obrigatorios' });
    }

    const db = req.app.locals.db;
    const cleanDocument = cleanDoc(document);

    // Find client by document
    const result = await db.query(
      "SELECT * FROM clients WHERE REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = $1",
      [cleanDocument]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Documento nao cadastrado' });
    }

    const client = result.rows[0];

    if (!client.is_active) {
      return res.status(403).json({ error: 'Sua conta esta desativada. Entre em contato com o administrador.' });
    }

    if (!client.traccar_user_id) {
      return res.status(500).json({ error: 'Conta nao vinculada ao sistema de rastreamento' });
    }

    // Get Traccar user email to login
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const traccarUser = await traccar.request('GET', `/api/users/${client.traccar_user_id}`);

    // Try to login to Traccar with the password
    try {
      await traccar.clientLogin(traccarUser.email, password);
    } catch (err) {
      if (client.is_first_login) {
        try {
          await traccar.clientLogin(traccarUser.email, cleanDocument);
        } catch {
          return res.status(401).json({ error: 'Senha incorreta' });
        }
      } else {
        return res.status(401).json({ error: 'Senha incorreta' });
      }
    }

    // Mark user as online
    await db.query(
      'UPDATE clients SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [client.id]
    );

    // Generate JWT
    const token = jwt.sign(
      {
        id: client.id,
        traccarUserId: client.traccar_user_id,
        document: client.document,
        name: client.name,
        role: 'client',
        isFirstLogin: client.is_first_login,
        mustChangePassword: client.must_change_password,
        onboardingCompleted: client.onboarding_completed,
      },
      req.app.locals.jwtSecret,
      { expiresIn: '24h' }
    );

    // Log
    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, ip_address) VALUES ($1, $2, $3, $4)',
      ['client', client.id, 'login', req.ip]
    );

    res.json({
      token,
      traccarEmail: traccarUser.email,
      traccarUrl: 'https://traccar.hsqrastreamento.com.br',
      user: {
        id: client.id,
        name: client.name,
        document: client.document,
        documentType: client.document_type,
        isFirstLogin: client.is_first_login,
        mustChangePassword: client.must_change_password,
        onboardingCompleted: client.onboarding_completed,
        traccarUserId: client.traccar_user_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/admin/login - Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM admin_users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
      req.app.locals.jwtSecret,
      { expiresIn: '12h' }
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, ip_address) VALUES ($1, $2, $3, $4)',
      ['admin', admin.id, 'admin_login', req.ip]
    );

    res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' } });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/change-password - Change password (client)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    const db = req.app.locals.db;
    const traccar = new TraccarService(req.app.locals.traccarUrl);

    await traccar.updatePassword(req.user.traccarUserId, newPassword);

    await db.query(
      'UPDATE clients SET must_change_password = false, is_first_login = false, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, ip_address) VALUES ($1, $2, $3, $4)',
      ['client', req.user.id, 'password_changed', req.ip]
    );

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// POST /api/auth/complete-onboarding - Mark onboarding as done
router.post('/complete-onboarding', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await db.query(
      'UPDATE clients SET onboarding_completed = true, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Onboarding concluido' });
  } catch (err) {
    console.error('Onboarding error:', err.message);
    res.status(500).json({ error: 'Erro ao completar onboarding' });
  }
});

// POST /api/auth/logout - Mark client as offline
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await db.query(
      'UPDATE clients SET last_logout_at = NOW(), updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, ip_address) VALUES ($1, $2, $3, $4)',
      ['client', req.user.id, 'logout', req.ip]
    );

    res.json({ message: 'Logout registrado' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Erro ao registrar logout' });
  }
});

// POST /api/auth/heartbeat - Update last_login_at (keep-alive)
router.post('/heartbeat', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await db.query(
      'UPDATE clients SET last_login_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Erro no heartbeat' });
  }
});

// POST /api/auth/forgot-password - Send reset code to client's registered email
router.post('/forgot-password', async (req, res) => {
  try {
    const { document } = req.body;
    if (!document) {
      return res.status(400).json({ error: 'Documento e obrigatorio' });
    }

    const db = req.app.locals.db;
    const cleanDocument = cleanDoc(document);

    // Find client by document
    const result = await db.query(
      "SELECT * FROM clients WHERE REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = $1",
      [cleanDocument]
    );

    // Security: don't reveal if document exists or not
    if (result.rows.length === 0) {
      return res.json({ mode: 'info', message: 'Se o documento estiver cadastrado e possuir email, um codigo sera enviado. Caso contrario, entre em contato com o administrador.' });
    }

    const client = result.rows[0];

    // Check if client has email registered
    if (!client.email) {
      return res.json({ mode: 'info', message: 'Este cadastro nao possui email registrado. Entre em contato com o administrador para recuperar sua senha.' });
    }

    // Check if SMTP is configured
    const smtpPass = process.env.SMTP_PASS || '';
    if (!smtpPass) {
      return res.json({ mode: 'info', message: 'Servico de email temporariamente indisponivel. Entre em contato com o administrador para recuperar sua senha.' });
    }

    // === SECURE EMAIL CODE FLOW ===
    // Ensure reset codes table exists (UUID client_id)
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id SERIAL PRIMARY KEY,
        client_id UUID NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate previous codes
    await db.query('UPDATE password_reset_codes SET used = true WHERE client_id = $1 AND used = false', [client.id]);

    // Store new code
    await db.query(
      'INSERT INTO password_reset_codes (client_id, code, expires_at) VALUES ($1, $2, $3)',
      [client.id, code, expiresAt]
    );

    // Send email with code
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'hsqrastreamento@gmail.com',
        pass: smtpPass,
      },
    });

    const mailSent = await transporter.sendMail({
      from: '"HSQ Rastreamento" <hsqrastreamento@gmail.com>',
      to: client.email,
      subject: 'Codigo de Recuperacao de Senha - HSQ Rastreamento',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h2 style="color:#1e293b;">HSQ Rastreamento</h2>
          </div>
          <p>Ola <strong>${client.name}</strong>,</p>
          <p>Voce solicitou a recuperacao de senha. Use o codigo abaixo:</p>
          <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;background:#f1f5f9;padding:16px 32px;border-radius:12px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e293b;">${code}</div>
          </div>
          <p style="color:#64748b;font-size:13px;">Este codigo expira em 15 minutos.</p>
          <p style="color:#64748b;font-size:13px;">Se voce nao solicitou, ignore este email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:11px;text-align:center;">HSQ Rastreamento - Monitoramento Inteligente</p>
        </div>
      `,
    }).catch(err => {
      console.error('Email send error:', err.message);
      return null;
    });

    if (!mailSent) {
      return res.status(500).json({ error: 'Erro ao enviar email. Tente novamente ou entre em contato com o administrador.' });
    }

    // Mask email for display
    const emailParts = client.email.split('@');
    const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      ['client', client.id, 'password_reset_requested', JSON.stringify({ method: 'email_code' }), req.ip]
    );

    return res.json({ mode: 'code', message: 'Codigo enviado para ' + maskedEmail, email: maskedEmail });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Erro ao processar solicitacao' });
  }
});

// POST /api/auth/verify-reset-code - Verify code and reset password
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { document, code } = req.body;
    if (!document || !code) {
      return res.status(400).json({ error: 'Documento e codigo sao obrigatorios' });
    }

    const db = req.app.locals.db;
    const cleanDocument = cleanDoc(document);

    const clientResult = await db.query(
      "SELECT * FROM clients WHERE REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = $1",
      [cleanDocument]
    );

    if (clientResult.rows.length === 0) {
      return res.status(400).json({ error: 'Codigo invalido ou expirado' });
    }

    const client = clientResult.rows[0];

    const codeResult = await db.query(
      'SELECT * FROM password_reset_codes WHERE client_id = $1 AND code = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [client.id, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Codigo invalido ou expirado' });
    }

    await db.query('UPDATE password_reset_codes SET used = true WHERE id = $1', [codeResult.rows[0].id]);

    if (client.traccar_user_id) {
      const traccar = new TraccarService(req.app.locals.traccarUrl);
      await traccar.updatePassword(client.traccar_user_id, cleanDocument);
    }

    await db.query(
      'UPDATE clients SET must_change_password = true, is_first_login = true, updated_at = NOW() WHERE id = $1',
      [client.id]
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      ['client', client.id, 'password_reset_completed', JSON.stringify({ method: 'email_code' }), req.ip]
    );

    res.json({ message: 'Senha resetada! Use seu CPF/CNPJ como senha para fazer login.' });
  } catch (err) {
    console.error('Verify reset code error:', err.message);
    res.status(500).json({ error: 'Erro ao verificar codigo' });
  }
});

module.exports = router;

