const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const TraccarService = require('../services/traccar');

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

// GET /api/admin/clients - List all clients
router.get('/clients', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
    params.push(parseInt(limit), offset);

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('List clients error:', err.message);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// GET /api/admin/clients/:id - Get client details
router.get('/clients/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = result.rows[0];

    // Also get devices from Traccar
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
    console.error('Get client error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// POST /api/admin/clients - Create new client
router.post('/clients', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      document, documentType, name, tradeName, phone, email,
      address, city, state, contactPerson,
    } = req.body;

    if (!document || !documentType || !name || !email) {
      return res.status(400).json({ error: 'Documento, tipo, nome e email sao obrigatorios' });
    }

    const formattedDoc = formatDoc(document, documentType);
    const cleanDocument = cleanDoc(document);

    // Check if document already exists
    const existing = await db.query(
      "SELECT id FROM clients WHERE REPLACE(REPLACE(REPLACE(document, '.', ''), '-', ''), '/', '') = $1",
      [cleanDocument]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Documento já cadastrado' });
    }

    // Create user in Traccar with document as initial password
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const traccarEmail = `${cleanDocument}@hsqrastreamento.com`;
    const traccarUser = await traccar.createUser(traccarEmail, cleanDocument, name);

    // Insert into portal DB
    const result = await db.query(
      `INSERT INTO clients (document, document_type, name, trade_name, phone, email, address, city, state, contact_person, traccar_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [formattedDoc, documentType, name, tradeName || null, phone || null, email || null,
       address || null, city || null, state || null, contactPerson || null, traccarUser.id]
    );

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'client_created', JSON.stringify({ clientId: result.rows[0].id, name })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create client error:', err.message);
    res.status(500).json({ error: 'Erro ao criar cliente: ' + err.message });
  }
});

// PATCH /api/admin/clients/:id - Update client
router.patch('/clients/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, tradeName, phone, email, address, city, state, contactPerson } = req.body;

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
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update client error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// POST /api/admin/clients/:id/toggle-active - Activate/deactivate client
router.post('/clients/:id/toggle-active', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Get current state
    const current = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = current.rows[0];
    const newActive = !client.is_active;

    // Update in portal DB
    await db.query('UPDATE clients SET is_active = $1, updated_at = NOW() WHERE id = $2', [newActive, req.params.id]);

    // Update in Traccar
    if (client.traccar_user_id) {
      const traccar = new TraccarService(req.app.locals.traccarUrl);
      await traccar.setUserActive(client.traccar_user_id, newActive);
    }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, newActive ? 'client_activated' : 'client_deactivated',
       JSON.stringify({ clientId: req.params.id })]
    );

    res.json({ isActive: newActive, message: newActive ? 'Cliente ativado' : 'Cliente desativado' });
  } catch (err) {
    console.error('Toggle active error:', err.message);
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
});

// POST /api/admin/clients/:id/reset-password - Reset client password to document
router.post('/clients/:id/reset-password', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = result.rows[0];
    const cleanDocument = cleanDoc(client.document);

    // Reset password in Traccar to the document number
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    await traccar.updatePassword(client.traccar_user_id, cleanDocument);

    // Mark as first login again
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
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Erro ao resetar senha' });
  }
});

// GET /api/admin/dashboard - Dashboard stats
router.get('/dashboard', async (req, res) => {
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
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatisticas' });
  }
});

// DELETE /api/admin/clients/:id - Delete client permanently
router.delete('/clients/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado' });
    }

    const client = result.rows[0];

    // Delete from Traccar first
    if (client.traccar_user_id) {
      try {
        const traccar = new TraccarService(req.app.locals.traccarUrl);
        await traccar.deleteUser(client.traccar_user_id);
      } catch (e) {
        console.error('Traccar delete failed:', e.message);
      }
    }

    // Delete from portal DB
    await db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'client_deleted', JSON.stringify({ clientId: req.params.id, name: client.name })]
    );

    res.json({ message: 'Cliente deletado permanentemente' });
  } catch (err) {
    console.error('Delete client error:', err.message);
    res.status(500).json({ error: 'Erro ao deletar cliente: ' + err.message });
  }
});


// GET /api/admin/online-users - List users with online status
router.get('/online-users', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(`
      SELECT id, name, document, document_type, phone, email, city, state,
             last_login_at, last_logout_at,
             CASE 
               WHEN last_login_at IS NOT NULL AND (last_logout_at IS NULL OR last_login_at > last_logout_at)
               THEN true
               ELSE false
             END as is_online,
             CASE
               WHEN last_login_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (NOW() - last_login_at)) / 60
               ELSE NULL
             END as minutes_since_activity
      FROM clients
      WHERE is_active = true
      ORDER BY 
        CASE 
          WHEN last_login_at IS NOT NULL AND (last_logout_at IS NULL OR last_login_at > last_logout_at) THEN 0
          ELSE 1
        END,
        last_login_at DESC NULLS LAST
    `);
    
    const users = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      document: u.document,
      documentType: u.document_type,
      phone: u.phone,
      email: u.email,
      city: u.city,
      state: u.state,
      lastLoginAt: u.last_login_at,
      lastLogoutAt: u.last_logout_at,
      isOnline: u.is_online,
      minutesSinceActivity: u.minutes_since_activity ? Math.round(u.minutes_since_activity) : null,
    }));

    const onlineCount = users.filter(u => u.isOnline).length;
    
    res.json({
      onlineCount,
      totalActive: users.length,
      users,
    });
  } catch (err) {
    console.error('Online users error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar usuarios online' });
  }
});


// ============ DEVICE MANAGEMENT ============

// GET /api/admin/devices - List all devices with client assignments
router.get('/devices', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const traccar = new TraccarService(req.app.locals.traccarUrl);

    // Get all devices from Traccar
    const devices = await traccar.getAllDevices();

    // Get all clients with their traccar_user_id
    const clientsResult = await db.query('SELECT id, name, document, traccar_user_id FROM clients WHERE traccar_user_id IS NOT NULL');
    const clientsByTraccarId = {};
    for (const c of clientsResult.rows) {
      clientsByTraccarId[c.traccar_user_id] = c;
    }

    // Get all non-admin users from Traccar to map devices to clients
    const users = await traccar.getUsers();
    const nonAdminUsers = users.filter(u => !u.administrator);

    // For each non-admin user, get their devices and build mapping
    const deviceToClient = {};
    for (const user of nonAdminUsers) {
      try {
        const userDevices = await traccar.getUserDevices(user.id);
        const client = clientsByTraccarId[user.id];
        if (client) {
          for (const d of userDevices) {
            deviceToClient[d.id] = {
              clientId: client.id,
              clientName: client.name,
              clientDocument: client.document,
              traccarUserId: user.id,
            };
          }
        }
      } catch (e) {
        // Skip users that fail
      }
    }

    // Get latest positions
    let positions = [];
    try {
      positions = await traccar.getPositions();
    } catch (e) { /* ignore */ }
    const positionsByDevice = {};
    for (const p of positions) {
      positionsByDevice[p.deviceId] = p;
    }

    // Enrich devices
    const enriched = devices.map(d => {
      const assignment = deviceToClient[d.id] || null;
      const pos = positionsByDevice[d.id] || null;
      return {
        id: d.id,
        name: d.name,
        uniqueId: d.uniqueId,
        category: d.category,
        status: d.status,
        disabled: d.disabled,
        lastUpdate: d.lastUpdate,
        client: assignment,
        position: pos ? {
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed,
          address: pos.address || null,
          fixTime: pos.fixTime,
        } : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('List devices error:', err.message);
    res.status(500).json({ error: 'Erro ao listar dispositivos' });
  }
});

// POST /api/admin/devices - Create device
router.post('/devices', async (req, res) => {
  try {
    const { name, uniqueId, category, clientId } = req.body;

    if (!name || !uniqueId) {
      return res.status(400).json({ error: 'Nome e identificador (IMEI) são obrigatórios' });
    }

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const device = await traccar.createDevice(name, uniqueId, category);

    // If clientId provided, link device to client's Traccar user
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
    console.error('Create device error:', err.message);
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ error: 'Erro ao criar dispositivo: ' + msg });
  }
});

// PUT /api/admin/devices/:id - Update device
router.put('/devices/:id', async (req, res) => {
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
    console.error('Update device error:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar dispositivo' });
  }
});

// DELETE /api/admin/devices/:id - Delete device
router.delete('/devices/:id', async (req, res) => {
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
    console.error('Delete device error:', err.message);
    res.status(500).json({ error: 'Erro ao deletar dispositivo' });
  }
});

// POST /api/admin/devices/:id/assign - Assign device to client
router.post('/devices/:id/assign', async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }

    const db = req.app.locals.db;
    const clientResult = await db.query('SELECT id, name, traccar_user_id FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];
    if (!client.traccar_user_id) {
      return res.status(400).json({ error: 'Cliente não tem usuário Traccar vinculado' });
    }

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    try {
      await traccar.linkDeviceToUser(client.traccar_user_id, parseInt(req.params.id));
    } catch (linkErr) {
      // If already linked (Traccar returns 400), ignore it
      const traccarMsg = linkErr.response?.data?.message || linkErr.response?.data || linkErr.message;
      console.error('Traccar link error (may be duplicate):', traccarMsg);
      if (linkErr.response?.status !== 400) {
        throw linkErr;
      }
      // 400 often means "already linked" - continue
    }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_assigned', JSON.stringify({ deviceId: req.params.id, clientId, clientName: client.name })]
    );

    res.json({ message: `Dispositivo vinculado a ${client.name}` });
  } catch (err) {
    console.error('Assign device error:', err.message, err.response?.data);
    const msg = err.response?.data?.message || err.message;
    res.status(500).json({ error: 'Erro ao vincular dispositivo: ' + msg });
  }
});

// POST /api/admin/devices/:id/unassign - Unassign device from client
router.post('/devices/:id/unassign', async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }

    const db = req.app.locals.db;
    const clientResult = await db.query('SELECT id, name, traccar_user_id FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];
    if (!client.traccar_user_id) {
      return res.status(400).json({ error: 'Cliente não tem usuário Traccar vinculado' });
    }

    const traccar = new TraccarService(req.app.locals.traccarUrl);
    try {
      await traccar.unlinkDeviceFromUser(client.traccar_user_id, parseInt(req.params.id));
    } catch (unlinkErr) {
      const traccarMsg = unlinkErr.response?.data?.message || unlinkErr.response?.data || unlinkErr.message;
      console.error('Traccar unlink error:', traccarMsg);
      if (unlinkErr.response?.status !== 400) {
        throw unlinkErr;
      }
    }

    await db.query(
      'INSERT INTO audit_log (user_type, user_id, action, details) VALUES ($1, $2, $3, $4)',
      ['admin', req.user.id, 'device_unassigned', JSON.stringify({ deviceId: req.params.id, clientId })]
    );

    res.json({ message: 'Dispositivo desvinculado' });
  } catch (err) {
    console.error('Unassign device error:', err.message, err.response?.data);
    res.status(500).json({ error: 'Erro ao desvincular dispositivo' });
  }
});

module.exports = router;

