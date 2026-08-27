import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Authentication API Integration Tests', () => {
  const testUser = {
    name: 'Jest Test User',
    email: `jest_${Date.now()}@example.com`,
    password: 'Password123!'
  };

  let authToken = '';

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'jest_' } }
    });
    await prisma.$disconnect();
  });

  test('POST /api/auth/signup - Should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toHaveProperty('id');
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data).toHaveProperty('token');
  });

  test('POST /api/auth/signup - Should reject duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testUser);

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/auth/login - Should log in user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');

    authToken = res.body.data.token;
  });

  test('POST /api/auth/login - Should reject wrong password with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123!'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('GET /api/auth/me - Should fetch current user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  test('GET /api/auth/me - Should reject request with missing JWT token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });
});
