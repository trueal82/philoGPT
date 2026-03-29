/**
 * security-owasp.test.js — OWASP-oriented negative tests.
 *
 * Covers: Broken Access Control (IDOR, role bypass), input validation,
 * invalid ObjectIds, missing/malformed JWT, and abuse controls.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const {
  connect, disconnect, cleanup, getApp,
  createUser, createAdmin, createBot, signToken,
} = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = getApp();
});
afterAll(async () => await disconnect());
afterEach(async () => await cleanup());

// ---------------------------------------------------------------------------
// A1 — Broken Access Control (IDOR, role escalation)
// ---------------------------------------------------------------------------
describe('IDOR — session access by guessing ID', () => {
  it('returns 404 for valid ObjectId belonging to another user', async () => {
    const { token: tokenA } = await createUser();
    const { token: tokenB } = await createUser();
    const bot = await createBot();

    // Create session as userA
    const { body } = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ botId: bot._id.toString() });
    const sessionId = body.session._id;

    // Try to access as userB
    const res = await request(app)
      .get(`/api/chat/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for fabricated ObjectId', async () => {
    const { token } = await createUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/chat/sessions/${fakeId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Role escalation via request body', () => {
  it('registration cannot set role to admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin-hack@test.com', password: 'Password123!', role: 'admin' });
    // Should succeed as registration but NOT grant admin
    expect(res.status).toBe(201);
    const User = mongoose.model('User');
    const user = await User.findOne({ email: 'admin-hack@test.com' });
    expect(user.role).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// A2 — Cryptographic / Authentication failures
// ---------------------------------------------------------------------------
describe('Authentication edge cases', () => {
  it('rejects empty Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', '');
    expect(res.status).toBe(401);
  });

  it('rejects Bearer with empty token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects Bearer with expired token', async () => {
    const jwt = require('jsonwebtoken');
    const { user } = await createUser();
    const expiredToken = jwt.sign(
      { userId: String(user._id) },
      process.env.JWT_SECRET,
      { expiresIn: '0s' },
    );
    // Small delay to ensure expiry
    await new Promise((r) => setTimeout(r, 100));
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// A3 — Injection / Input validation
// ---------------------------------------------------------------------------
describe('Invalid ObjectId handling', () => {
  it('GET /api/bots/:id rejects non-ObjectId', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get('/api/bots/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('GET /api/chat/sessions/:id/messages rejects non-ObjectId', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get('/api/chat/sessions/not-a-valid-id/messages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('POST /api/chat/sessions rejects non-ObjectId botId', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: 'drop table users;' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/chat/sessions/:id rejects non-ObjectId', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .delete('/api/chat/sessions/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('Message content validation', () => {
  it('rejects empty message content', async () => {
    const { token } = await createUser();
    const bot = await createBot();
    const sessionRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: bot._id.toString() });
    const sessionId = sessionRes.body.session._id;

    const res = await request(app)
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid role value', async () => {
    const { token } = await createUser();
    const bot = await createBot();
    const sessionRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: bot._id.toString() });
    const sessionId = sessionRes.body.session._id;

    const res = await request(app)
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hello', role: 'superadmin' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// General — Protected routes reject unauthenticated requests
// ---------------------------------------------------------------------------
describe('Protected routes without auth', () => {
  const protectedEndpoints = [
    { method: 'get', path: '/api/bots' },
    { method: 'get', path: '/api/chat/sessions' },
    { method: 'post', path: '/api/chat/sessions' },
    { method: 'get', path: '/api/chat/memories' },
    { method: 'delete', path: '/api/chat/memories' },
    { method: 'get', path: '/api/auth/profile' },
    { method: 'get', path: '/api/auth/languages' },
    { method: 'post', path: '/api/auth/logout' },
  ];

  it.each(protectedEndpoints)(
    '$method $path returns 401 without token',
    async ({ method, path }) => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    },
  );
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
describe('Security headers', () => {
  it('health endpoint includes security headers from Helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('does not expose x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
