// server/tests/userRoutes.test.js
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

jest.mock('../models/User');

describe('User Routes', () => {
  describe('GET /api/users/:id', () => {
    it('should return user if found', async () => {
      const mockUser = { _id: '1', username: 'TestUser', email: 'test@example.com' };
      User.findById = jest.fn().mockResolvedValue(mockUser);

      const res = await request(app).get('/api/users/1').expect('Content-Type', /json/).expect(200);

      expect(res.body).toHaveProperty('_id', '1');
      expect(res.body).toHaveProperty('username', 'TestUser');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });

    it('should return 404 if user not found', async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      const res = await request(app).get('/api/users/2').expect(404);

      expect(res.body).toHaveProperty('error', 'User not found');
    });
  });
});
