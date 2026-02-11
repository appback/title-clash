const request = require('supertest');
const app = require('../../server');
const {
  db,
  createTestUser,
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  createTestSubmission,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Votes API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  /**
   * Helper: set up a problem in voting state with a submission for vote tests.
   */
  async function setupVotingScenario() {
    const admin = await createAdminUser();
    const owner = await createAgentOwner();
    const agent = await createTestAgent(owner.id);
    const problem = await createTestProblem(admin.id, { state: 'voting' });
    const submission = await createTestSubmission(problem.id, agent.id, { title: 'Vote Target' });
    return { admin, owner, agent, problem, submission };
  }

  // =============================================
  // POST /api/v1/votes
  // =============================================
  describe('POST /api/v1/votes', () => {
    it('should allow JWT-authenticated user to vote (201)', async () => {
      const { submission } = await setupVotingScenario();
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({ submission_id: submission.id });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.submission_id).toBe(submission.id);
      expect(res.body).toHaveProperty('created_at');
    });

    it('should allow anonymous cookie-based vote (201)', async () => {
      const { submission } = await setupVotingScenario();

      const res = await request(app)
        .post('/api/v1/votes')
        .send({ submission_id: submission.id });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.submission_id).toBe(submission.id);
    });

    it('should reject duplicate vote from same JWT user (409)', async () => {
      const { submission } = await setupVotingScenario();
      const voter = await createTestUser({ role: 'voter' });

      // First vote
      await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({ submission_id: submission.id });

      // Duplicate vote
      const res = await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({ submission_id: submission.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should reject duplicate vote from same cookie voter (409)', async () => {
      const { submission } = await setupVotingScenario();

      // First vote - capture the cookie
      const firstRes = await request(app)
        .post('/api/v1/votes')
        .send({ submission_id: submission.id });

      expect(firstRes.status).toBe(201);

      // Extract voterId cookie - must exist
      const cookies = firstRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const voterIdCookie = cookies.find(c => c.startsWith('voterId='));
      expect(voterIdCookie).toBeDefined();

      // Duplicate vote with same cookie
      const res = await request(app)
        .post('/api/v1/votes')
        .set('Cookie', voterIdCookie)
        .send({ submission_id: submission.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should reject vote when problem is not in voting or open state (422)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      // Create problem in 'closed' state - need to go through the state machine
      const problem = await createTestProblem(admin.id, { state: 'closed' });
      const submission = await createTestSubmission(problem.id, agent.id, { title: 'Closed Sub' });

      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({ submission_id: submission.id });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('VOTING_CLOSED');
    });

    it('should return 404 for non-existent submission (404)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({ submission_id: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('should reject vote with missing submission_id (400)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/votes')
        .set('Authorization', authHeader(voter.token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================
  // GET /api/v1/votes/summary/:problemId
  // =============================================
  describe('GET /api/v1/votes/summary/:problemId', () => {
    it('should return correct vote aggregation (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'voting' });
      const sub1 = await createTestSubmission(problem.id, agent.id, { title: 'Title A' });
      const sub2 = await createTestSubmission(problem.id, agent.id, { title: 'Title B' });

      // Cast votes - 3 for sub1, 1 for sub2
      const voter1 = await createTestUser({ role: 'voter' });
      const voter2 = await createTestUser({ role: 'voter' });
      const voter3 = await createTestUser({ role: 'voter' });
      const voter4 = await createTestUser({ role: 'voter' });

      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter1.token))
        .send({ submission_id: sub1.id });
      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter2.token))
        .send({ submission_id: sub1.id });
      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter3.token))
        .send({ submission_id: sub1.id });
      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter4.token))
        .send({ submission_id: sub2.id });

      const res = await request(app)
        .get(`/api/v1/votes/summary/${problem.id}`);

      expect(res.status).toBe(200);
      expect(res.body.problem_id).toBe(problem.id);
      expect(res.body.total_votes).toBe(4);
      expect(res.body).toHaveProperty('submissions');
      expect(res.body.submissions.length).toBe(2);

      // Verify the top submission has more votes
      const topSubmission = res.body.submissions[0];
      expect(topSubmission.vote_count).toBe(3);
      expect(topSubmission.title).toBe('Title A');

      const secondSubmission = res.body.submissions[1];
      expect(secondSubmission.vote_count).toBe(1);
    });

    it('should return 404 for non-existent problem', async () => {
      const res = await request(app)
        .get('/api/v1/votes/summary/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('should verify percentage calculation in vote summary', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'voting' });
      const sub1 = await createTestSubmission(problem.id, agent.id, { title: 'Half' });
      const sub2 = await createTestSubmission(problem.id, agent.id, { title: 'Other Half' });

      const voter1 = await createTestUser({ role: 'voter' });
      const voter2 = await createTestUser({ role: 'voter' });

      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter1.token))
        .send({ submission_id: sub1.id });
      await request(app).post('/api/v1/votes')
        .set('Authorization', authHeader(voter2.token))
        .send({ submission_id: sub2.id });

      const res = await request(app)
        .get(`/api/v1/votes/summary/${problem.id}`);

      expect(res.status).toBe(200);
      expect(res.body.total_votes).toBe(2);

      // Each submission should have 50% (or close to it)
      const percentages = res.body.submissions.map(s => s.percentage);
      const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
      expect(totalPercentage).toBe(100);
      res.body.submissions.forEach(s => {
        expect(s.percentage).toBe(50);
      });
    });
  });
});
