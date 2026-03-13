/**
 * Tests for global error handler
 */
const { errorHandler } = require('../src/middleware/errorHandler');

function mockReqRes() {
  const req = { method: 'GET', originalUrl: '/api/test', ip: '127.0.0.1' };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('errorHandler', () => {
  // Suppress console.error during tests
  beforeAll(() => { jest.spyOn(console, 'error').mockImplementation(); });
  afterAll(() => { console.error.mockRestore(); });

  test('returns 500 for generic errors in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { req, res, next } = mockReqRes();
    const err = new Error('Something broke');
    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
    expect(res.body.details).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('returns details in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { req, res, next } = mockReqRes();
    const err = new Error('Detailed error');
    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.details).toBe('Detailed error');

    process.env.NODE_ENV = originalEnv;
  });

  test('handles JSON parse errors', () => {
    const { req, res, next } = mockReqRes();
    const err = new Error('Bad JSON');
    err.type = 'entity.parse.failed';
    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('JSON invalido');
  });

  test('uses custom status code when provided', () => {
    const { req, res, next } = mockReqRes();
    const err = new Error('Not found');
    err.statusCode = 404;
    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
