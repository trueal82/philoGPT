/**
 * security-admin.test.js — Admin API separation tests.
 *
 * Verifies all admin endpoints reject unauthenticated and non-admin users.
 */

const request = require('supertest');
const { connect, disconnect, cleanup, getApp, createUser, createAdmin } = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = getApp();
});
afterAll(async () => await disconnect());
afterEach(async () => await cleanup());

// Representative sample of admin endpoints (all 44 use same middleware)
const adminEndpoints = [
  { method: 'get', path: '/api/admin/users' },
  { method: 'get', path: '/api/admin/llm-configs' },
  { method: 'get', path: '/api/admin/bots' },
  { method: 'get', path: '/api/admin/languages' },
  { method: 'get', path: '/api/admin/user-groups' },
  { method: 'get', path: '/api/admin/subscriptions' },
  { method: 'get', path: '/api/admin/sessions' },
  { method: 'get', path: '/api/admin/tools' },
  { method: 'get', path: '/api/admin/client-memories' },
  { method: 'get', path: '/api/admin/system-prompt' },
  { method: 'post', path: '/api/admin/llm-configs' },
  { method: 'post', path: '/api/admin/languages' },
  { method: 'post', path: '/api/admin/user-groups' },
  { method: 'post', path: '/api/admin/subscriptions' },
  { method: 'post', path: '/api/admin/tools' },
  { method: 'delete', path: '/api/admin/users/000000000000000000000000' },
  { method: 'put', path: '/api/admin/users/000000000000000000000000/role' },
];

describe('Admin endpoints — unauthenticated', () => {
  it.each(adminEndpoints)(
    '$method $path returns 401 without token',
    async ({ method, path }) => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    },
  );
});

describe('Admin endpoints — normal user', () => {
  it.each(adminEndpoints)(
    '$method $path returns 403 for non-admin',
    async ({ method, path }) => {
      const { token } = await createUser();
      const res = await request(app)[method](path).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    },
  );
});

describe('Admin endpoints — admin user', () => {
  it('GET /api/admin/users returns 200 for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/bots returns 200 for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Playground endpoints — admin only', () => {
  it('GET /api/playground/bots returns 401 without token', async () => {
    const res = await request(app).get('/api/playground/bots');
    expect(res.status).toBe(401);
  });

  it('GET /api/playground/bots returns 403 for normal user', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get('/api/playground/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/playground/bots returns 200 for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/playground/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('POST /api/playground/sessions returns 403 for normal user', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post('/api/playground/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: '000000000000000000000000' });
    expect(res.status).toBe(403);
  });

  it('POST /api/playground/messages returns 403 for normal user', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post('/api/playground/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: '000000000000000000000000', message: 'hello' });
    expect(res.status).toBe(403);
  });
});
