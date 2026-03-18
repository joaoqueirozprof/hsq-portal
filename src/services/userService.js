/**
 * Serviço de autenticação e usuários próprios
 * Os usuários são armazenados no nosso próprio banco de dados PostgreSQL
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class UserService {
  // Criar um novo usuário
  async createUser(userData) {
    const { email, password, name, role = 'user' } = userData;

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const result = await pool.query(
      `INSERT INTO users (id, email, password, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, name, role, created_at`,
      [uuidv4(), email, hashedPassword, name, role]
    );

    return result.rows[0];
  }

  // Autenticar usuário
  async authenticate(email, password) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Credenciais inválidas');
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Credenciais inválidas');
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Registrar login nos logs
    await this.logLogin(user.id, 'success');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  // Verificar token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  // Listar todos os usuários (apenas admin)
  async getAllUsers() {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  // Atualizar usuário
  async updateUser(userId, userData) {
    const { name, email, role, password } = userData;

    let query = 'UPDATE users SET updated_at = NOW()';
    const params = [];
    let paramIndex = 1;

    if (name) {
      query += `, name = $${paramIndex++}`;
      params.push(name);
    }

    if (email) {
      query += `, email = $${paramIndex++}`;
      params.push(email);
    }

    if (role) {
      query += `, role = $${paramIndex++}`;
      params.push(role);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${paramIndex++}`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = $${paramIndex++} RETURNING id, email, name, role`;
    params.push(userId);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Deletar usuário
  async deleteUser(userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  // Log de login
  async logLogin(userId, status, ip = null) {
    await pool.query(
      `INSERT INTO login_logs (id, user_id, status, ip_address, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), userId, status, ip]
    );
  }

  // Obter logs de login
  async getLoginLogs(userId, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM login_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
}

module.exports = new UserService();
