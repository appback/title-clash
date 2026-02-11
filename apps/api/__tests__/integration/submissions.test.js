const request = require('supertest');
const app = require('../../server');
const {
  createTestUser,
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  createTestSubmission,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Submissions API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // =============================================
  // POST /api/v1/submissions
  // =============================================
  describe('POST /api/v1/submissions', () => {
    it('should create a submission with valid agent token to open problem (201)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: 'My Creative Title'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('My Creative Title');
      expect(res.body.problem_id).toBe(problem.id);
      expect(res.body.agent_id).toBe(agent.id);
      expect(res.body.status).toBe('active');
    });

    it('should reject submission with JWT token instead of agent token (401)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', authHeader(admin.token))
        .send({
          problem_id: problem.id,
          title: 'JWT Submission'
        });

      expect(res.status).toBe(401);
    });

    it('should reject submission without authentication (401)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .send({
          problem_id: problem.id,
          title: 'No Auth Submission'
        });

      expect(res.status).toBe(401);
    });

    it('should reject submission to non-open problem (422)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'draft' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: 'Draft Problem Submission'
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PROBLEM_NOT_OPEN');
    });

    it('should reject duplicate title for same agent and problem (409)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });

      // First submission
      await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: 'Duplicate Title'
        });

      // Second submission with same title
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: 'Duplicate Title'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should reject submission from inactive agent (403)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });

      // Deactivate the agent
      await request(app)
        .delete(`/api/v1/agents/${agent.id}`)
        .set('Authorization', authHeader(admin.token));

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: 'Inactive Agent Submission'
        });

      expect(res.status).toBe(403);
    });

    it('should reject submission with invalid agent token (401)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', 'Bearer tc_agent_invalidtoken12345')
        .send({
          problem_id: problem.id,
          title: 'Bad Token Submission'
        });

      expect(res.status).toBe(401);
    });

    it('should reject submission with missing problem_id (400)', async () => {
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          title: 'No Problem ID'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject submission with missing title (400)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject title exceeding 300 characters (400)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const longTitle = 'A'.repeat(301);

      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${agent.rawToken}`)
        .send({
          problem_id: problem.id,
          title: longTitle
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================
  // GET /api/v1/submissions
  // =============================================
  describe('GET /api/v1/submissions', () => {
    it('should list submissions without authentication (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      await createTestSubmission(problem.id, agent.id, { title: 'Sub 1' });
      await createTestSubmission(problem.id, agent.id, { title: 'Sub 2' });

      const res = await request(app)
        .get('/api/v1/submissions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter submissions by problem_id (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem1 = await createTestProblem(admin.id, { title: 'P1', state: 'open' });
      const problem2 = await createTestProblem(admin.id, { title: 'P2', state: 'open' });
      await createTestSubmission(problem1.id, agent.id, { title: 'Sub for P1' });
      await createTestSubmission(problem2.id, agent.id, { title: 'Sub for P2 A' });
      await createTestSubmission(problem2.id, agent.id, { title: 'Sub for P2 B' });

      const res = await request(app)
        .get(`/api/v1/submissions?problem_id=${problem2.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
      res.body.data.forEach(sub => {
        expect(sub.problem_id).toBe(problem2.id);
      });
    });
  });

  // =============================================
  // GET /api/v1/submissions/:id
  // =============================================
  describe('GET /api/v1/submissions/:id', () => {
    it('should get a single submission by ID (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id, { title: 'Get Me' });

      const res = await request(app)
        .get(`/api/v1/submissions/${submission.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(submission.id);
      expect(res.body.title).toBe('Get Me');
      expect(res.body).toHaveProperty('vote_count');
      expect(res.body.vote_count).toBe(0);
    });

    it('should return 404 for non-existent submission', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });
});
