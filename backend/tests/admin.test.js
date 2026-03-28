const request = require('supertest');
const app = require('../src/server');

describe('Admin Routes', () => {
  it('should have admin routes', async () => {
    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(401); // Not authenticated
  });
});