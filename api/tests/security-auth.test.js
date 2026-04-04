/**
 * security-auth.test.js — Authentication boundary tests.
 *
 * Covers: register, login, locked accounts, JWT validation.
 */

const request = require('supertest');
const { connect, disconnect, cleanup, getApp, createUser, signToken } = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = getApp();
});
afterAll(async () => await disconnect());
afterEach(async () => await cleanup());

describe('Registration', () => {
  it('creates a locked account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'Password123!' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/manual activation/i);
  });

  it('rejects duplicate email', async () => {
    await createUser({ email: 'dup@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Password123!' });
    expect(res.status).toBe(409);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@test.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Password123!' });
    expect(res.status).toBe(400);
  });
});

describe('Login', () => {
  it('returns token for unlocked user', async () => {
    await createUser({ email: 'login@test.com', isLocked: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects locked user with 423', async () => {
    await createUser({ email: 'locked@test.com', isLocked: true, lockedReason: 'test' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'locked@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('account_locked');
  });

  it('rejects wrong password', async () => {
    await createUser({ email: 'wrong@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('JWT validation', () => {
  it('rejects requests without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('rejects malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('rejects token signed with wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const badToken = jwt.sign({ userId: '000000000000000000000000' }, 'wrong-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects token for non-existent user', async () => {
    const mongoose = require('mongoose');
    const fakeId = new mongoose.Types.ObjectId();
    const token = signToken(fakeId);
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects token for locked user (middleware check)', async () => {
    const { user, token } = await createUser({ isLocked: true, lockedReason: 'test' });
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(423);
  });

  it('accepts valid token for unlocked user', async () => {
    const { user, token } = await createUser();
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });
});
