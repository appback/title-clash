const request = require('supertest');
const app = require('../../server');
const {
  createTestUser,
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Agents API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // =============================================
  // POST /api/v1/agents/register (self-registration)
  // =============================================
  describe('POST /api/v1/agents/register', () => {
    it('should register agent without auth and return token (201)', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'GPT-4 Agent', email: 'gpt4@openai.com', model_name: 'gpt-4', description: 'A test agent' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agent_id');
      expect(res.body).toHaveProperty('api_token');
      expect(res.body.name).toBe('GPT-4 Agent');
      expect(res.body.api_token).toMatch(/^tc_agent_/);
      expect(res.body).toHaveProperty('created_at');
    });

    it('should register agent with only name (201)', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'Minimal Agent' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Minimal Agent');
      expect(res.body).toHaveProperty('api_token');
    });

    it('should reject registration without name (400)', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ email: 'no-name@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with invalid email (400)', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'Bad Email Agent', email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate agent name (409)', async () => {
      await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'Unique Agent' });

      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'Unique Agent' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should allow submissions with self-registered token', async () => {
      // Register agent
      const regRes = await request(app)
        .post('/api/v1/agents/register')
        .send({ name: 'Submitter Agent', model_name: 'claude-3' });

      expect(regRes.status).toBe(201);
      const agentToken = regRes.body.api_token;

      // Create an open problem (need admin for this)
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'open' });

      // Submit a title using the self-registered token
      const submitRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ problem_id: problem.id, title: 'A creative title', model_name: 'claude-3' });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.title).toBe('A creative title');
    });
  });

  // =============================================
  // POST /api/v1/agents
  // =============================================
  describe('POST /api/v1/agents', () => {
    it('should create agent as agent_owner (201)', async () => {
      const owner = await createAgentOwner();

      const res = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', authHeader(owner.token))
        .send({ name: 'My Agent' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('api_token');
      expect(res.body.name).toBe('My Agent');
      expect(res.body.owner_id).toBe(owner.id);
      expect(res.body.is_active).toBe(true);
      // Raw token should start with tc_agent_ prefix
      expect(res.body.api_token).toMatch(/^tc_agent_/);
    });

    it('should create agent as admin (201)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', authHeader(admin.token))
        .send({ name: 'Admin Agent' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('api_token');
      expect(res.body.name).toBe('Admin Agent');
    });

    it('should reject agent creation for voter role (403)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', authHeader(voter.token))
        .send({ name: 'Voter Agent' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should reject agent creation without JWT (401)', async () => {
      const res = await request(app)
        .post('/api/v1/agents')
        .send({ name: 'No Auth Agent' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  // =============================================
  // GET /api/v1/agents
  // =============================================
  describe('GET /api/v1/agents', () => {
    it('should list agents as admin (200)', async () => {
      const admin = await createAdminUser();
      // Create a couple of agents
      await createTestAgent(admin.id, { name: 'Agent Alpha' });
      await createTestAgent(admin.id, { name: 'Agent Beta' });

      const res = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
      // Tokens should be masked in list
      res.body.data.forEach(agent => {
        expect(agent.api_token).toContain('...');
      });
    });

    it('should reject listing for non-admin (403)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .get('/api/v1/agents')
        .set('Authorization', authHeader(voter.token));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  // =============================================
  // GET /api/v1/agents/:id
  // =============================================
  describe('GET /api/v1/agents/:id', () => {
    it('should return agent details for owner (200)', async () => {
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id, { name: 'Owned Agent' });

      const res = await request(app)
        .get(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(owner.token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agent.id);
      expect(res.body.name).toBe('Owned Agent');
      // Token should be masked
      expect(res.body.api_token).toContain('...');
    });

    it('should reject access for non-owner non-admin (403)', async () => {
      const owner = await createAgentOwner();
      const otherUser = await createAgentOwner({ email: 'other@example.com' });
      const agent = await createTestAgent(owner.id);

      const res = await request(app)
        .get(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(otherUser.token));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should return 404 for non-existent agent', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/agents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  // =============================================
  // PATCH /api/v1/agents/:id
  // =============================================
  describe('PATCH /api/v1/agents/:id', () => {
    it('should update agent name as owner (200)', async () => {
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id, { name: 'Old Name' });

      const res = await request(app)
        .patch(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(owner.token))
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.id).toBe(agent.id);
    });
  });

  // =============================================
  // POST /api/v1/agents/:id/regenerate-token
  // =============================================
  describe('POST /api/v1/agents/:id/regenerate-token', () => {
    it('should regenerate token and return new one (200)', async () => {
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const oldToken = agent.rawToken;

      const res = await request(app)
        .post(`/api/v1/agents/${agent.id}/regenerate-token`)
        .set('Authorization', authHeader(owner.token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('api_token');
      expect(res.body.api_token).toMatch(/^tc_agent_/);
      // New token should be different from old one
      expect(res.body.api_token).not.toBe(oldToken);
    });

    it('should invalidate old token after regeneration', async () => {
      const owner = await createAgentOwner();
      const admin = await createAdminUser();
      const agent = await createTestAgent(owner.id);
      const oldToken = agent.rawToken;

      // Create an open problem for submission testing
      const problem = await require('../helpers').createTestProblem(admin.id, { state: 'open' });

      // Old token should work
      const submitBefore = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ problem_id: problem.id, title: 'Before Regen', model_name: 'test' });

      expect(submitBefore.status).toBe(201);

      // Regenerate token
      const regenRes = await request(app)
        .post(`/api/v1/agents/${agent.id}/regenerate-token`)
        .set('Authorization', authHeader(owner.token));

      const newToken = regenRes.body.api_token;

      // Old token should no longer work
      const submitWithOld = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ problem_id: problem.id, title: 'After Regen Old', model_name: 'test' });

      expect(submitWithOld.status).toBe(401);

      // New token should work
      const submitWithNew = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ problem_id: problem.id, title: 'After Regen New', model_name: 'test' });

      expect(submitWithNew.status).toBe(201);
    });
  });

  // =============================================
  // DELETE /api/v1/agents/:id
  // =============================================
  describe('DELETE /api/v1/agents/:id', () => {
    it('should soft-delete agent as admin (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);

      const res = await request(app)
        .delete(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agent.id);
      expect(res.body.is_active).toBe(false);

      // Verify agent is now inactive by fetching it
      const getRes = await request(app)
        .get(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(admin.token));

      expect(getRes.status).toBe(200);
      expect(getRes.body.is_active).toBe(false);
    });
  });
});
