/**
 * Input validation and sanitization middleware
 * Protects against XSS, injection, and malformed input
 */

// Sanitize string: trim, remove HTML tags, limit length
function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '')    // Remove any remaining angle brackets
    .slice(0, maxLength);
}

// Sanitize all string values in request body recursively
function sanitizeBody(obj, maxLength = 500) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, maxLength);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeBody(value, maxLength);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Middleware: auto-sanitize all request bodies
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeBody(req.body);
  }
  // Sanitize query params
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key], 200);
      }
    }
  }
  next();
}

// Validation helpers
const validators = {
  // Validate email format
  isEmail(value) {
    if (!value || typeof value !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  },

  // Validate UUID format
  isUUID(value) {
    if (!value || typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  },

  // Validate positive integer
  isPositiveInt(value) {
    const num = parseInt(value);
    return !isNaN(num) && num > 0;
  },

  // Validate document (CPF/CNPJ - only digits after cleaning)
  isDocument(value) {
    if (!value || typeof value !== 'string') return false;
    const clean = value.replace(/[.\-\/]/g, '');
    return /^\d{11}$/.test(clean) || /^\d{14}$/.test(clean);
  },

  // Validate password strength
  isStrongPassword(value) {
    if (!value || typeof value !== 'string') return false;
    return value.length >= 6 && value.length <= 128;
  },

  // Validate phone number (Brazilian format)
  isPhone(value) {
    if (!value) return true; // optional field
    const clean = value.replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{10,15}$/.test(clean);
  },

  // Validate state code (Brazilian)
  isState(value) {
    if (!value) return true; // optional field
    const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    return states.includes(value.toUpperCase());
  },

  // Validate document type
  isDocumentType(value) {
    return ['CPF', 'CNPJ'].includes(value);
  },
};

// Create validation middleware for specific route
function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, ruleSet] of Object.entries(rules)) {
      const value = req.body[field];

      for (const rule of ruleSet) {
        if (rule === 'required' && (!value && value !== false && value !== 0)) {
          errors.push(`Campo '${field}' e obrigatorio`);
          break; // No need to check other rules if required fails
        }
        if (rule === 'email' && value && !validators.isEmail(value)) {
          errors.push(`Campo '${field}' deve ser um email valido`);
        }
        if (rule === 'uuid' && value && !validators.isUUID(value)) {
          errors.push(`Campo '${field}' deve ser um UUID valido`);
        }
        if (rule === 'document' && value && !validators.isDocument(value)) {
          errors.push(`Campo '${field}' deve ser um CPF ou CNPJ valido`);
        }
        if (rule === 'password' && value && !validators.isStrongPassword(value)) {
          errors.push(`Campo '${field}' deve ter entre 6 e 128 caracteres`);
        }
        if (rule === 'phone' && value && !validators.isPhone(value)) {
          errors.push(`Campo '${field}' deve ser um telefone valido`);
        }
        if (rule === 'state' && value && !validators.isState(value)) {
          errors.push(`Campo '${field}' deve ser uma UF valida`);
        }
        if (rule === 'documentType' && value && !validators.isDocumentType(value)) {
          errors.push(`Campo '${field}' deve ser CPF ou CNPJ`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    next();
  };
}

// Validate UUID in route params
function validateParamUUID(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (value && !validators.isUUID(value)) {
      return res.status(400).json({ error: `Parametro '${paramName}' deve ser um UUID valido` });
    }
    next();
  };
}

// Validate integer in route params
function validateParamInt(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (value && !validators.isPositiveInt(value)) {
      return res.status(400).json({ error: `Parametro '${paramName}' deve ser um numero inteiro positivo` });
    }
    next();
  };
}

module.exports = {
  sanitizeMiddleware,
  sanitizeString,
  sanitizeBody,
  validate,
  validateParamUUID,
  validateParamInt,
  validators,
};
