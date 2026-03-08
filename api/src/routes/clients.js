const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const TraccarService = require('../services/traccar');

const router = express.Router();

// GET /api/clients/me - Get current client profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM clients WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    const client = result.rows[0];
    res.json({
      id: client.id,
      document: client.document,
      documentType: client.document_type,
      name: client.name,
      tradeName: client.trade_name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      city: client.city,
      state: client.state,
      contactPerson: client.contact_person,
      isActive: client.is_active,
      isFirstLogin: client.is_first_login,
      mustChangePassword: client.must_change_password,
      onboardingCompleted: client.onboarding_completed,
    });
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// GET /api/clients/devices - Get client's devices from Traccar
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const traccar = new TraccarService(req.app.locals.traccarUrl);
    const devices = await traccar.getUserDevices(req.user.traccarUserId);
    res.json(devices);
  } catch (err) {
    console.error('Get devices error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dispositivos' });
  }
});

// GET /api/clients/traccar-redirect - Get Traccar URL with session
router.get('/traccar-redirect', authMiddleware, async (req, res) => {
  try {
    res.json({
      traccarUrl: req.app.locals.traccarUrl,
      message: 'Redirecione o usuário para o Traccar. O login será feito via a sessão existente.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar redirecionamento' });
  }
});

module.exports = router;
