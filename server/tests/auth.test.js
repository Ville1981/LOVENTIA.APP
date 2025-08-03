// server/tests/auth.test.js
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should return 400 if email already exists', async () => {
      // First call for email check, second for username
      User.findOne = jest.fn()
        .mockResolvedValueOnce({ _id: '1', email: 'test@example.com' })
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'User', email: 'test@example.com', password: 'password123' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'Sähköposti on jo käytössä');
    });

    it('should return 400 if username already exists', async () => {
      // First call for email checks null, second for username
      User.findOne = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: '2', username: 'User' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'User', email: 'new@example.com', password: 'password123' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'Käyttäjänimi on jo varattu');
    });

    it('should register a new user and return 201', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);
      bcrypt.hash = jest.fn().mockResolvedValue('hashedpassword');
      // Mock the save method on User instance
      const saveMock = jest.fn().mockResolvedValue();
      User.prototype.save = saveMock;

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'NewUser', email: 'new@example.com', password: 'password123' })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Rekisteröinti onnistui');
      expect(saveMock).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 404 if user not found', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'none@example.com', password: 'password123' })
        .expect(404);

      expect(res.body).toHaveProperty('error', 'User not found');
    });

    it('should return 400 if password is incorrect', async () => {
      User.findOne = jest.fn().mockResolvedValue({ _id: '1', password: 'hashedpassword' });
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should login successfully and return token', async () => {
      User.findOne = jest.fn().mockResolvedValue({ _id: '1', password: 'hashedpassword' });
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('token123');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(res.body).toHaveProperty('token', 'token123');
    });
  });
});
