/**
 * security-entitlement.test.js — Bot entitlement / subscription tests.
 *
 * Verifies users can only access bots available to their subscription tier.
 */

const request = require('supertest');
const {
  connect, disconnect, cleanup, getApp,
  createUser, createAdmin, createBot, createSubscription,
} = require('./setup');

let app;

beforeAll(async () => {
  await connect();
  app = getApp();
});
afterAll(async () => await disconnect());
afterEach(async () => await cleanup());

describe('Bot entitlement — GET /api/bots/:id', () => {
  it('admin can access any bot regardless of subscription', async () => {
    const sub = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub._id] });
    const { token } = await createAdmin();

    const res = await request(app)
      .get(`/api/bots/${bot._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('user with matching subscription can access restricted bot', async () => {
    const sub = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub._id] });
    const { token } = await createUser({ subscriptionId: sub._id });

    const res = await request(app)
      .get(`/api/bots/${bot._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('user without matching subscription cannot access restricted bot', async () => {
    const sub1 = await createSubscription();
    const sub2 = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub1._id] });
    const { token } = await createUser({ subscriptionId: sub2._id });

    const res = await request(app)
      .get(`/api/bots/${bot._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('user without any subscription cannot access restricted bot', async () => {
    const sub = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub._id] });
    const { token } = await createUser(); // no subscriptionId

    const res = await request(app)
      .get(`/api/bots/${bot._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('any user can access bot with no subscription restrictions', async () => {
    const bot = await createBot({ availableToSubscriptionIds: [] });
    const { token } = await createUser();

    const res = await request(app)
      .get(`/api/bots/${bot._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Bot entitlement — POST /api/chat/sessions', () => {
  it('user with matching subscription can create session', async () => {
    const sub = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub._id] });
    const { token } = await createUser({ subscriptionId: sub._id });

    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: bot._id.toString() });
    expect(res.status).toBe(201);
  });

  it('user without matching subscription cannot create session', async () => {
    const sub1 = await createSubscription();
    const sub2 = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub1._id] });
    const { token } = await createUser({ subscriptionId: sub2._id });

    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: bot._id.toString() });
    expect(res.status).toBe(403);
  });

  it('rejects session creation for non-existent bot', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: '000000000000000000000000' });
    expect(res.status).toBe(404);
  });

  it('admin can create session with any bot', async () => {
    const sub = await createSubscription();
    const bot = await createBot({ availableToSubscriptionIds: [sub._id] });
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ botId: bot._id.toString() });
    expect(res.status).toBe(201);
  });
});

describe('Bot list — GET /api/bots', () => {
  it('user only sees bots for their subscription', async () => {
    const sub1 = await createSubscription();
    const sub2 = await createSubscription();
    await createBot({ availableToSubscriptionIds: [sub1._id] });
    await createBot({ availableToSubscriptionIds: [sub2._id] });
    await createBot({ availableToSubscriptionIds: [] }); // free bot

    const { token } = await createUser({ subscriptionId: sub1._id });
    const res = await request(app)
      .get('/api/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Should see the sub1 bot only (free bots have empty array, so they don't match subscription filter)
    expect(res.body.bots.length).toBe(1);
  });

  it('admin sees all bots', async () => {
    const sub = await createSubscription();
    await createBot({ availableToSubscriptionIds: [sub._id] });
    await createBot({ availableToSubscriptionIds: [] });

    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bots.length).toBe(2);
  });
});
