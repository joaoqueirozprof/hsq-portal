/**
 * Tests for validation middleware
 */
const {
  sanitizeString,
  sanitizeBody,
  validators,
  validate,
  validateParamUUID,
  validateParamInt,
} = require('../src/middleware/validate');

// ========== sanitizeString ==========

describe('sanitizeString', () => {
  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  test('removes HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeString('Hello <b>World</b>')).toBe('Hello World');
  });

  test('removes angle brackets', () => {
    expect(sanitizeString('test<>value')).toBe('testvalue');
  });

  test('limits length', () => {
    const long = 'a'.repeat(1000);
    expect(sanitizeString(long, 100).length).toBe(100);
  });

  test('returns non-string values unchanged', () => {
    expect(sanitizeString(123)).toBe(123);
    expect(sanitizeString(null)).toBe(null);
  });
});

// ========== sanitizeBody ==========

describe('sanitizeBody', () => {
  test('sanitizes all string values in object', () => {
    const input = {
      name: '  <script>test</script>  ',
      age: 25,
      email: 'test@email.com',
    };
    const result = sanitizeBody(input);
    expect(result.name).toBe('test');
    expect(result.age).toBe(25);
    expect(result.email).toBe('test@email.com');
  });

  test('handles nested objects', () => {
    const input = { user: { name: '<b>John</b>' } };
    const result = sanitizeBody(input);
    expect(result.user.name).toBe('John');
  });

  test('handles null/undefined', () => {
    expect(sanitizeBody(null)).toBe(null);
    expect(sanitizeBody(undefined)).toBe(undefined);
  });
});

// ========== validators ==========

describe('validators', () => {
  describe('isEmail', () => {
    test('accepts valid emails', () => {
      expect(validators.isEmail('test@example.com')).toBe(true);
      expect(validators.isEmail('user.name@domain.co')).toBe(true);
    });

    test('rejects invalid emails', () => {
      expect(validators.isEmail('')).toBe(false);
      expect(validators.isEmail('notanemail')).toBe(false);
      expect(validators.isEmail('@domain.com')).toBe(false);
      expect(validators.isEmail(null)).toBe(false);
    });
  });

  describe('isUUID', () => {
    test('accepts valid UUIDs', () => {
      expect(validators.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validators.isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    test('rejects invalid UUIDs', () => {
      expect(validators.isUUID('not-a-uuid')).toBe(false);
      expect(validators.isUUID('12345')).toBe(false);
      expect(validators.isUUID(null)).toBe(false);
    });
  });

  describe('isDocument', () => {
    test('accepts valid CPF (11 digits)', () => {
      expect(validators.isDocument('12345678901')).toBe(true);
      expect(validators.isDocument('123.456.789-01')).toBe(true);
    });

    test('accepts valid CNPJ (14 digits)', () => {
      expect(validators.isDocument('12345678000199')).toBe(true);
      expect(validators.isDocument('12.345.678/0001-99')).toBe(true);
    });

    test('rejects invalid documents', () => {
      expect(validators.isDocument('12345')).toBe(false);
      expect(validators.isDocument('')).toBe(false);
      expect(validators.isDocument(null)).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    test('accepts passwords >= 6 chars', () => {
      expect(validators.isStrongPassword('123456')).toBe(true);
      expect(validators.isStrongPassword('strongpassword')).toBe(true);
    });

    test('rejects short passwords', () => {
      expect(validators.isStrongPassword('12345')).toBe(false);
      expect(validators.isStrongPassword('')).toBe(false);
    });

    test('rejects very long passwords', () => {
      expect(validators.isStrongPassword('a'.repeat(200))).toBe(false);
    });
  });

  describe('isState', () => {
    test('accepts valid Brazilian states', () => {
      expect(validators.isState('RN')).toBe(true);
      expect(validators.isState('SP')).toBe(true);
      expect(validators.isState('rj')).toBe(true);
    });

    test('rejects invalid states', () => {
      expect(validators.isState('XX')).toBe(false);
      expect(validators.isState('ABC')).toBe(false);
    });

    test('allows empty (optional field)', () => {
      expect(validators.isState('')).toBe(true);
      expect(validators.isState(null)).toBe(true);
    });
  });

  describe('isDocumentType', () => {
    test('accepts CPF and CNPJ', () => {
      expect(validators.isDocumentType('CPF')).toBe(true);
      expect(validators.isDocumentType('CNPJ')).toBe(true);
    });

    test('rejects other values', () => {
      expect(validators.isDocumentType('RG')).toBe(false);
      expect(validators.isDocumentType('')).toBe(false);
    });
  });

  describe('isPositiveInt', () => {
    test('accepts positive integers', () => {
      expect(validators.isPositiveInt('1')).toBe(true);
      expect(validators.isPositiveInt('100')).toBe(true);
      expect(validators.isPositiveInt(42)).toBe(true);
    });

    test('rejects non-positive values', () => {
      expect(validators.isPositiveInt('0')).toBe(false);
      expect(validators.isPositiveInt('-1')).toBe(false);
      expect(validators.isPositiveInt('abc')).toBe(false);
    });
  });
});

// ========== validate middleware ==========

describe('validate middleware', () => {
  function mockReqRes(body = {}) {
    const req = { body };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
  }

  test('passes when all required fields are present', () => {
    const middleware = validate({ name: ['required'], email: ['required', 'email'] });
    const { req, res, next } = mockReqRes({ name: 'John', email: 'john@test.com' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails when required field is missing', () => {
    const middleware = validate({ name: ['required'] });
    const { req, res, next } = mockReqRes({});
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('fails on invalid email format', () => {
    const middleware = validate({ email: ['required', 'email'] });
    const { req, res, next } = mockReqRes({ email: 'notanemail' });
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('fails on invalid document format', () => {
    const middleware = validate({ document: ['required', 'document'] });
    const { req, res, next } = mockReqRes({ document: '12345' });
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
  });
});

// ========== validateParamUUID ==========

describe('validateParamUUID', () => {
  function mockReqRes(params = {}) {
    const req = { params };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
  }

  test('passes with valid UUID', () => {
    const middleware = validateParamUUID();
    const { req, res, next } = mockReqRes({ id: '550e8400-e29b-41d4-a716-446655440000' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails with invalid UUID', () => {
    const middleware = validateParamUUID();
    const { req, res, next } = mockReqRes({ id: 'not-valid' });
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ========== validateParamInt ==========

describe('validateParamInt', () => {
  function mockReqRes(params = {}) {
    const req = { params };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
  }

  test('passes with valid integer', () => {
    const middleware = validateParamInt('id');
    const { req, res, next } = mockReqRes({ id: '42' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails with non-integer', () => {
    const middleware = validateParamInt('id');
    const { req, res, next } = mockReqRes({ id: 'abc' });
    middleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
