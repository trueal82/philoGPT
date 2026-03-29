/**
 * security-ownership.test.js — Data isolation / ownership tests.
 *
 * Verifies users can only access their own sessions, messages, and memories.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const {
  connect, disconnect, cleanup, getApp,
  createUser, createAdmin, createBot,
} = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = getApp();
});
afterAll(async () => await disconnect());
afterEach(async () => await cleanup());

describe('Session ownership', () => {
  it('user can only list their own sessions', async () => {
    const { user: userA, token: tokenA } = await createUser();
    const { user: userB, token: tokenB } = await createUser();
    const bot = await createBot();

    // Create a session for userA
    const createRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ botId: bot._id.toString() });
    expect(createRes.status).toBe(201);

    // UserA sees the session
    const listA = await request(app)
      .get('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listA.body.sessions.length).toBe(1);

    // UserB sees nothing
    const listB = await request(app)
      .get('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.sessions.length).toBe(0);
  });

  it('user cannot access another user\'s session messages', async () => {
    const { token: tokenA } = await createUser();
    const { token: tokenB } = await createUser();
    const bot = await createBot();

    const createRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ botId: bot._id.toString() });
    const sessionId = createRes.body.session._id;

    // UserB cannot get messages from UserA's session
    const res = await request(app)
      .get(`/api/chat/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('user cannot post messages to another user\'s session', async () => {
    const { token: tokenA } = await createUser();
    const { token: tokenB } = await createUser();
    const bot = await createBot();

    const createRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ botId: bot._id.toString() });
    const sessionId = createRes.body.session._id;

    const res = await request(app)
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'hacked' });
    expect(res.status).toBe(404);
  });

  it('user cannot delete another user\'s session', async () => {
    const { token: tokenA } = await createUser();
    const { token: tokenB } = await createUser();
    const bot = await createBot();

    const createRes = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ botId: bot._id.toString() });
    const sessionId = createRes.body.session._id;

    const res = await request(app)
      .delete(`/api/chat/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

describe('Memory ownership', () => {
  it('user can only read their own bot memory', async () => {
    const { user: userA, token: tokenA } = await createUser();
    const { token: tokenB } = await createUser();
    const bot = await createBot();

    // Manually create a memory for userA
    const ClientMemory = mongoose.model('ClientMemory');
    await ClientMemory.create({
      userId: userA._id,
      botId: bot._id,
      data: { name: 'Alice' },
    });

    // UserA can read it
    const resA = await request(app)
      .get(`/api/chat/memory/${bot._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.memory).not.toBeNull();
    expect(resA.body.memory.data.name).toBe('Alice');

    // UserB gets null
    const resB = await request(app)
      .get(`/api/chat/memory/${bot._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.memory).toBeNull();
  });

  it('user can only delete their own memories', async () => {
    const { user: userA, token: tokenA } = await createUser();
    const { user: userB, token: tokenB } = await createUser();
    const bot = await createBot();

    const ClientMemory = mongoose.model('ClientMemory');
    await ClientMemory.create({ userId: userA._id, botId: bot._id, data: { key: 'val' } });
    await ClientMemory.create({ userId: userB._id, botId: bot._id, data: { key: 'other' } });

    // UserB deletes all their memories
    await request(app)
      .delete('/api/chat/memories')
      .set('Authorization', `Bearer ${tokenB}`);

    // UserA's memory should still exist
    const resA = await request(app)
      .get(`/api/chat/memory/${bot._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.body.memory).not.toBeNull();
  });
});
