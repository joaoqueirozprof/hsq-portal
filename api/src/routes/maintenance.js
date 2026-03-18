/**
 * Routes de Maintenance (Manutenção)
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/maintenance - Listar manutenções
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM maintenance
      ORDER BY created_at DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Get maintenance error:', error.message);
    res.json([]);
  }
});

// POST /api/maintenance - Criar manutenção
router.post('/', async (req, res) => {
  try {
    const { device_id, type, description, due_date, status } = req.body;

    const result = await pool.query(`
      INSERT INTO maintenance (device_id, type, description, due_date, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [device_id, type, description, due_date, status || 'pending']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create maintenance error:', error.message);
    res.status(500).json({ error: 'Erro ao criar manutenção' });
  }
});

module.exports = router;
