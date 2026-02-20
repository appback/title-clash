const request = require('supertest');
const app = require('../../server');
const {
  createTestUser,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // =============================================
  // POST /api/v1/auth/register
  // =============================================
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully (201)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('token');
      expect(res.body.name).toBe('New User');
      expect(res.body.role).toBe('voter');
    });

    it('should register with agent_owner role (201)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Agent Owner',
          email: 'agentowner@example.com',
          password: 'password123',
          role: 'agent_owner'
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('agent_owner');
      expect(res.body).toHaveProperty('token');
    });

    it('should reject duplicate email (409)', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'User One',
          email: 'duplicate@example.com',
          password: 'password123'
        });

      // Second registration with same email
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'User Two',
          email: 'duplicate@example.com',
          password: 'password456'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should reject missing name (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'noname@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password shorter than 6 characters (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Short Pass',
          email: 'shortpass@example.com',
          password: '12345'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid role (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Bad Role',
          email: 'badrole@example.com',
          password: 'password123',
          role: 'superadmin'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================
  // POST /api/v1/auth/login
  // =============================================
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully (200)', async () => {
      // Create user first
      const user = await createTestUser({
        email: 'login@example.com',
        password: 'password123'
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('name');
      expect(res.body.user).toHaveProperty('role');
    });

    it('should reject wrong password (401)', async () => {
      await createTestUser({
        email: 'wrongpass@example.com',
        password: 'password123'
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject non-existent email (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject missing fields (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================
  // JWT Token Verification
  // =============================================
  describe('JWT Token Validation', () => {
    it('should return a valid JWT that can be used for authenticated requests', async () => {
      // Register and get token
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Token User',
          email: 'tokenuser@example.com',
          password: 'password123',
          role: 'agent_owner'
        });

      const { token } = registerRes.body;
      expect(token).toBeTruthy();

      // Use token for an authenticated endpoint (create agent requires JWT)
      const agentRes = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', authHeader(token))
        .send({ name: 'Test Agent' });

      expect(agentRes.status).toBe(201);
    });

    it('should set correct role in the JWT for voter', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Voter User',
          email: 'voter@example.com',
          password: 'password123'
        });

      expect(registerRes.body.role).toBe('voter');

      // Voter should be forbidden from creating agents
      const agentRes = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', authHeader(registerRes.body.token))
        .send({ name: 'Forbidden Agent' });

      expect(agentRes.status).toBe(403);
    });
  });
});
