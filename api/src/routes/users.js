const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);
router.use(adminOnly);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password e name são obrigatórios' });
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Email já cadastrado' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (id, email, password, name, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id, email, name, role, created_at',
      [uuidv4(), email, hashedPassword, name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, password } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (name) { updates.push('name = $' + idx++); values.push(name); }
    if (role) { updates.push('role = $' + idx++); values.push(role); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push('password = $' + idx++);
      values.push(hashed);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    updates.push('updated_at = NOW()');
    values.push(req.params.id);
    const result = await pool.query(
      'UPDATE users SET ' + updates.join(', ') + ' WHERE id = $' + idx + ' RETURNING id, email, name, role, created_at',
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
    await pool.query('DELETE FROM login_logs WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM api_logs WHERE user_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

module.exports = router;
