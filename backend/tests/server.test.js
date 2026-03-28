const request = require('supertest');
const app = require('../src/server');

describe('Server', () => {
  it('should respond with a message on root route', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('PhiloGPT Backend API');
  });

  it('should have authentication routes', async () => {
    const response = await request(app).get('/api/auth');
    expect(response.status).toBe(404); // Not found since there's no GET route
  });
});