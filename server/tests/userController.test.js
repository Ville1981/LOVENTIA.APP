const request = require('supertest');
const app = require('../src/app'); // Varmista polku Express-appiin
const User = require('../src/models/User'); // Varmista polku User-malliin

describe('User Controller', () => {
  test('POST /api/users luo uuden käyttäjän', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    const response = await request(app).post('/api/users').send(userData).expect(201);

    expect(response.body).toHaveProperty('_id');
    expect(response.body.email).toBe(userData.email);

    // Varmistetaan, että tietokantaankin tallentui
    const userInDb = await User.findOne({ email: userData.email });
    expect(userInDb).not.toBeNull();
  });
});
