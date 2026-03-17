/**
 * Middleware de autenticação JWT
 */

const userService = require('../services/userService');

// Middleware para verificar autenticação
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);
    const user = await userService.verifyToken(token);

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Middleware para verificar se é admin
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
