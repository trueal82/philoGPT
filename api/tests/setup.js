/**
 * Shared test setup — in-memory MongoDB, app import, user/token helpers.
 *
 * Usage:
 *   const { getApp, createUser, createAdmin, signToken, createBot, cleanup } = require('./setup');
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'test-secret-do-not-use-in-production';

// Set env vars before importing app
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function cleanup() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, JWT_SECRET, { expiresIn: '1h' });
}

async function createUser(overrides = {}) {
  const User = mongoose.model('User');
  const defaults = {
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!', // plain text — pre-save hook will hash it
    provider: 'local',
    role: 'user',
    isLocked: false,
    languageCode: 'en-us',
  };
  const user = await User.create({ ...defaults, ...overrides });
  const token = signToken(user._id);
  return { user, token };
}

async function createAdmin(overrides = {}) {
  return createUser({ role: 'admin', ...overrides });
}

async function createBot(overrides = {}) {
  const Bot = mongoose.model('Bot');
  const defaults = {
    avatar: '🧪',
    availableToSubscriptionIds: [],
  };
  return Bot.create({ ...defaults, ...overrides });
}

async function createSubscription(overrides = {}) {
  const Subscription = mongoose.model('Subscription');
  const defaults = {
    name: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    active: true,
  };
  return Subscription.create({ ...defaults, ...overrides });
}

function getApp() {
  // Lazy-require so env vars are set first
  return require('../src/server').default;
}

module.exports = {
  connect,
  disconnect,
  cleanup,
  signToken,
  createUser,
  createAdmin,
  createBot,
  createSubscription,
  getApp,
  JWT_SECRET,
};
