const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { validate, validateParamUUID, validateParamInt } = require('../middleware/validate');
const TraccarService = require('../services/traccar');
const emailService = require('../services/email');

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminOnly);

// Utility: clean document
function cleanDoc(doc) {
  return doc.replace(/[.\-\/]/g, '');
}

// Utility: format document
function formatDoc(doc, type) {
  const clean = cleanDoc(doc);
  if (type === 'CPF' && clean.length === 11) {
    return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
  }
  if (type === 'CNPJ' && clean.length === 14) {
    return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
  }
  return doc;
}

// GET /api/admin/clients - List all clients (with search/pagination)
router.get('/clients', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { search, page = 1, limit = 20 } = req.query;

    // Validate pagination params
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM clients';
    let countQuery = 'SELECT COUNT(*) FROM clients';
    const params = [];
    const countParams = [];

    if (search) {
      const searchClause = ` WHERE name ILIKE $1 OR document ILIKE $1 OR trade_name ILIKE $1 OR email ILIKE $1 OR city ILIKE $1`;
      query += searchClause;
      countQuery += searchClause;
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/clients/:id
router.get('/clients/:id', validateParamUUID(), async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const client = result.rows[0];
    let devices = [];
    if (client.traccar_user_id) {
      try {
        const traccar = new TraccarService(req.app.locals.traccarUrl);
        devices = await traccar.getUserDevices(client.traccar_user_id);
      } catch (e) {
        console.error('Failed to get devices:', e.message);
      }
    }

    res.json({ ...client, devices });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/clients - Create new client
router.post('/clients',
  validate({
    document: ['required', 'document'],
    documentType: ['required', 'documentType'],
    name: ['required'],
    email: ['required', 'email'],
  }),
  async (req, res, next) => {
    try {
      const db = req.app.locals.db;
      const { document, documentType, name, tradeName, phone, email, address, city, state, contactPerson } = req.body;

      const formattedDoc = formatDoc(document, documentType);
      const cleanDocument = cleanDoc(document);

      const existing = await db.query(
        "SELECT id FROM clients WHERE REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = $1",
        [cleanDocument]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Documento ja cadastrado' });
      }

      const traccar = new TraccarService(req.app.locals.traccarUrl);
      const traccarEmail = `${cleanDocument}@hsqrastreamento.com`;
      const traccarUser = await traccar.createUser(traccarEmail, cleanDocument, name);

      const result = await db.query(
        `INSERT INTO clients (document, document_type, name, trade_name, phone, email, address, city, state, contact_person, traccar_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [formattedDoc, documentType, name, tradeName || null, phone || null, email || null,
         address || null, city || null, state || null, contactPerson || null, traccarUser.id]
      );

      await db.query(
        'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
        ['admin', req.user.id, 'client_created', JSON.stringify({ clientId: result.rows[0].id, name })]
      );

      // Send welcome email (non-blocking)
      if (email && emailService.isConfigured) {
        emailService.sendWelcome(email, name, cleanDocument).catch(err => {
          console.error('Welcome email failed:', err.message);
        });
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/clients/:id
router.patch('/clients/:id', validateParamUUID(), async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { name, tradeName, phone, email, address, city, state, contactPerson } = req.body;

    if (email !== undefined && email !== null && email !== '') {
      const { validators } = require('../middleware/validate');
      if (!validators.isEmail(email)) {
        return res.status(400).json({ error: 'Email invalido' });
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (tradeName !== undefined) { fields.push(`trade_name = $${idx++}`); values.push(tradeName); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (address !== undefined) { fields.push(`address = $${idx++}`); values.push(address); }
    if (city !== undefined) { fields.push(`city = $${idx++}`); values.push(city); }
    if (state !== undefined) { fields.push(`state = $${idx++}`); values.push(state); }
    if (contactPerson !== undefined) { fields.push(`contact_person = $${idx++}`); values.push(contactPerson); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await db.query(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/clients/:id/toggle-active
router.post('/clients/:id/toggle-active', validateParamUUID(), async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const current = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const client = current.rows[0];
    const newActive = !client.is_active;

    await db.query('UPDATE clients SET is_active = $1, updated_at = NOW() WHERE id = $2', [newActive, req.params.id]);

    if (client.traccar_user_id) {
      const traccar = new TraccarService(req.app.locals.traccarUrl);
      await traccar.setUserActive(client.traccar_user_id, newActive);
    }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, newActive ? 'client_activated' : 'client_deactivated',
       JSON.stringify({ clientId: req.params.id })]
    );

    // Send status notification email (non-blocking)
    if (client.email && emailService.isConfigured) {
      emailService.sendAccountStatus(client.email, client.name, newActive).catch(err => {
        console.error('Status email failed:', err.message);
      });
    }

    res.json({ isActive: newActive, message: newActive ? 'Cliente ativado' : 'Cliente desativado' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/clients/:id/reset-password
router.post('/clients/:id/reset-password', validateParamUUID(), async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const client = result.rows[0];
    const cleanDocument = cleanDoc(client.document);

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    await traccar.updatePassword(client.traccar_user_id, cleanDocument);

    await db.query(
      'UPDATE clients SET must_change_password = true, is_first_login = true, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'password_reset', JSON.stringify({ clientId: req.params.id })]
    );

    res.json({ message: 'Senha resetada para o documento do cliente' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const [totalClients, activeClients, recentLogins, onlineNow] = await Promise.all([
      db.query('SELECT COUNT(*) FROM clients'),
      db.query('SELECT COUNT(*) FROM clients WHERE is_active = true'),
      db.query("SELECT COUNT(*) FROM audit_log WHERE action = 'login' AND created_at > NOW() - INTERVAL '7 days'"),
      db.query("SELECT COUNT(*) FROM clients WHERE last_login_at IS NOT NULL AND (last_logout_at IS NULL OR last_login_at > last_logout_at)"),
    ]);

    res.json({
      totalClients: parseInt(totalClients.rows[0].count),
      activeClients: parseInt(activeClients.rows[0].count),
      recentLogins: parseInt(recentLogins.rows[0].count),
      onlineNow: parseInt(onlineNow.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/clients/:id
router.delete('/clients/:id', validateParamUUID(), async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const client = result.rows[0];
    if (client.traccar_user_id) {
      try {
        const traccar = new TraccarService(req.app.locals.traccarUrl);
        await traccar.deleteUser(client.traccar_user_id);
      } catch (e) {
        console.error('Traccar delete failed:', e.message);
      }
    }

    await db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'client_deleted', JSON.stringify({ clientId: req.params.id, name: client.name })]
    );

    res.json({ message: 'Cliente deletado permanentemente' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/online-users
router.get('/online-users', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(`
      SELECT id, name, document, document_type, phone, email, city, state,
             last_login_at, last_logout_at,
             CASE WHEN last_login_at IS NOT NULL AND (last_logout_at IS NULL OR last_login_at > last_logout_at)
               THEN true ELSE false END as is_online,
             CASE WHEN last_login_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (NOW() - last_login_at)) / 60 ELSE NULL END as minutes_since_activity
      FROM clients WHERE is_active = true
      ORDER BY
        CASE WHEN last_login_at IS NOT NULL AND (last_logout_at IS NULL OR last_login_at > last_logout_at) THEN 0 ELSE 1 END,
        last_login_at DESC NULLS LAST
    `);

    const users = result.rows.map(u => ({
      id: u.id, name: u.name, document: u.document, documentType: u.document_type,
      phone: u.phone, email: u.email, city: u.city, state: u.state,
      lastLoginAt: u.last_login_at, lastLogoutAt: u.last_logout_at,
      isOnline: u.is_online,
      minutesSinceActivity: u.minutes_since_activity ? Math.round(u.minutes_since_activity) : null,
    }));

    res.json({ onlineCount: users.filter(u => u.isOnline).length, totalActive: users.length, users });
  } catch (err) {
    next(err);
  }
});

// ============ DEVICE MANAGEMENT ============

// GET /api/admin/devices
router.get('/devices', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const devices = await traccar.getAllDevices();

    const clientsResult = await db.query('SELECT id, name, document, traccar_user_id FROM clients WHERE traccar_user_id IS NOT NULL');
    const clientsByTraccarId = {};
    for (const c of clientsResult.rows) { clientsByTraccarId[c.traccar_user_id] = c; }

    const users = await traccar.getUsers();
    const nonAdminUsers = users.filter(u => !u.administrator);

    const deviceToClient = {};
    for (const user of nonAdminUsers) {
      try {
        const userDevices = await traccar.getUserDevices(user.id);
        const client = clientsByTraccarId[user.id];
        if (client) {
          for (const d of userDevices) {
            deviceToClient[d.id] = { clientId: client.id, clientName: client.name, clientDocument: client.document, traccarUserId: user.id };
          }
        }
      } catch (e) { /* skip */ }
    }

    let positions = [];
    try { positions = await traccar.getPositions(); } catch (e) { /* ignore */ }
    const positionsByDevice = {};
    for (const p of positions) { positionsByDevice[p.deviceId] = p; }

    const enriched = devices.map(d => ({
      id: d.id, name: d.name, uniqueId: d.uniqueId, category: d.category,
      status: d.status, disabled: d.disabled, lastUpdate: d.lastUpdate,
      client: deviceToClient[d.id] || null,
      position: positionsByDevice[d.id] ? {
        latitude: positionsByDevice[d.id].latitude, longitude: positionsByDevice[d.id].longitude,
        speed: positionsByDevice[d.id].speed, address: positionsByDevice[d.id].address || null,
        fixTime: positionsByDevice[d.id].fixTime,
      } : null,
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/devices
router.post('/devices', validate({ name: ['required'], uniqueId: ['required'] }), async (req, res, next) => {
  try {
    const { name, uniqueId, category, clientId } = req.body;
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const device = await traccar.createDevice(name, uniqueId, category);

    if (clientId) {
      const db = req.app.locals.db;
      const clientResult = await db.query('SELECT traccar_user_id FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length > 0 && clientResult.rows[0].traccar_user_id) {
        await traccar.linkDeviceToUser(clientResult.rows[0].traccar_user_id, device.id);
      }
    }

    const db = req.app.locals.db;
    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_created', JSON.stringify({ deviceId: device.id, name, uniqueId })]
    );

    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/devices/:id
router.put('/devices/:id', validateParamInt('id'), async (req, res, next) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const { name, uniqueId, category, disabled } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (uniqueId !== undefined) updates.uniqueId = uniqueId;
    if (category !== undefined) updates.category = category;
    if (disabled !== undefined) updates.disabled = disabled;

    const device = await traccar.updateDevice(parseInt(req.params.id), updates);

    const db = req.app.locals.db;
    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_updated', JSON.stringify({ deviceId: req.params.id, updates })]
    );

    res.json(device);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/devices/:id
router.delete('/devices/:id', validateParamInt('id'), async (req, res, next) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    await traccar.deleteDevice(parseInt(req.params.id));

    const db = req.app.locals.db;
    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_deleted', JSON.stringify({ deviceId: req.params.id })]
    );

    res.json({ message: 'Dispositivo deletado' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/devices/:id/assign
router.post('/devices/:id/assign', validateParamInt('id'), validate({ clientId: ['required', 'uuid'] }), async (req, res, next) => {
  try {
    const { clientId } = req.body;
    const db = req.app.locals.db;
    const clientResult = await db.query('SELECT id, name, traccar_user_id FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ error: 'Cliente nao encontrado' });

    const client = clientResult.rows[0];
    if (!client.traccar_user_id) return res.status(400).json({ error: 'Cliente nao tem usuario Traccar vinculado' });

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    try { await traccar.linkDeviceToUser(client.traccar_user_id, parseInt(req.params.id)); }
    catch (linkErr) { if (linkErr.response?.status !== 400) throw linkErr; }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_assigned', JSON.stringify({ deviceId: req.params.id, clientId, clientName: client.name })]
    );

    res.json({ message: `Dispositivo vinculado a ${client.name}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/devices/:id/unassign
router.post('/devices/:id/unassign', validateParamInt('id'), validate({ clientId: ['required', 'uuid'] }), async (req, res, next) => {
  try {
    const { clientId } = req.body;
    const db = req.app.locals.db;
    const clientResult = await db.query('SELECT id, name, traccar_user_id FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ error: 'Cliente nao encontrado' });

    const client = clientResult.rows[0];
    if (!client.traccar_user_id) return res.status(400).json({ error: 'Cliente nao tem usuario Traccar vinculado' });

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    try { await traccar.unlinkDeviceFromUser(client.traccar_user_id, parseInt(req.params.id)); }
    catch (unlinkErr) { if (unlinkErr.response?.status !== 400) throw unlinkErr; }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_unassigned', JSON.stringify({ deviceId: req.params.id, clientId })]
    );

    res.json({ message: 'Dispositivo desvinculado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
