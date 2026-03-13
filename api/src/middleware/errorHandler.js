/**
 * Global error handler middleware
 * Catches unhandled errors and returns consistent JSON responses
 */

function errorHandler(err, req, res, _next) {
  // Log the full error in development/production
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON invalido no corpo da requisicao',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Arquivo inesperado no upload',
    });
  }

  // Default: Internal Server Error
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500
    ? 'Erro interno do servidor'
    : err.message || 'Erro desconhecido';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
  });
}

// Handle unhandled promise rejections
function setupProcessHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
    // Give time to flush logs then exit
    setTimeout(() => process.exit(1), 1000);
  });
}

module.exports = { errorHandler, setupProcessHandlers };
