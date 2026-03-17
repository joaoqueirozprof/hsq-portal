/**
 * Rotas de autenticação
 * POST /api/auth/register - Registrar novo usuário
 * POST /api/auth/login - Login
 * GET /api/auth/me - Obter usuário atual
 * GET /api/auth/logs - Logs de login (apenas admin)
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Registrar novo usuário
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    const user = await userService.createUser({ email, password, name, role });
    res.status(201).json(user);
  } catch (error) {
    if (error.message === 'Email já cadastrado') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const result = await userService.authenticate(email, password);
    res.json(result);
  } catch (error) {
    if (error.message === 'Credenciais inválidas') {
      return res.status(401).json({ error: error.message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Obter usuário atual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Erro ao obter dados do usuário' });
  }
});

// Obter logs de login (apenas admin)
router.get('/logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const logs = await userService.getLoginLogs(req.query.userId, parseInt(req.query.limit) || 50);
    res.json(logs);
  } catch (error) {
    console.error('Get login logs error:', error);
    res.status(500).json({ error: 'Erro ao obter logs de login' });
  }
});

module.exports = router;
