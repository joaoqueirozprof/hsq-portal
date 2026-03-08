const express = require('express');
const bcrypt = require('bcrypt');
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
      return res.status(400).json({ error: 'Documento e senha são obrigatórios' });
    }

    const db = req.app.locals.db;
    const cleanDocument = cleanDoc(document);

    // Find client by document
    const result = await db.query(
      'SELECT * FROM clients WHERE REPLACE(REPLACE(REPLACE(document, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = $1',
      [cleanDocument]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Documento não cadastrado' });
    }

    const client = result.rows[0];

    if (!client.is_active) {
      return res.status(403).json({ error: 'Sua conta está desativada. Entre em contato com o administrador.' });
    }

    if (!client.traccar_user_id) {
      return res.status(500).json({ error: 'Conta não vinculada ao sistema de rastreamento' });
    }

    // Get Traccar user email to login
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const traccarUser = await traccar.request('GET', `/api/users/${client.traccar_user_id}`);

    // Try to login to Traccar with the password
    try {
      await traccar.clientLogin(traccarUser.email, password);
    } catch (err) {
      // If first login, password is the document number itself
      if (client.is_first_login) {
        try {
          await traccar.clientLogin(traccarUser.email, cleanDocument);
          // First login successful with document as password
        } catch {
          return res.status(401).json({ error: 'Senha incorreta' });
        }
      } else {
        return res.status(401).json({ error: 'Senha incorreta' });
      }
    }

    // Generate a Traccar session token for direct URL login
    let traccarToken = null;
    try {
      traccarToken = await traccar.setUserToken(client.traccar_user_id);
    } catch (tokenErr) {
      console.error('Warning: Could not set Traccar token:', tokenErr.message);
    }

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
      traccarToken,
      traccarUrl: process.env.TRACCAR_URL || 'http://72.61.129.78:8082',
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
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM admin_users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
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

    // Update password in Traccar
    await traccar.updatePassword(req.user.traccarUserId, newPassword);

    // Mark password changed
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

    res.json({ message: 'Onboarding concluído' });
  } catch (err) {
    console.error('Onboarding error:', err.message);
    res.status(500).json({ error: 'Erro ao completar onboarding' });
  }
});

module.exports = router;
