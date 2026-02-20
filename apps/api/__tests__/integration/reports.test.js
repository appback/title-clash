const request = require('supertest');
const app = require('../../server');
const db = require('../../db');
const {
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  createTestSubmission,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Reports API', () => {
  beforeEach(async () => {
    await cleanDatabase();
    // Seed the report_auto_threshold setting
    await db.query(
      "INSERT INTO settings (key, value, category) VALUES ('report_auto_threshold', '3', 'moderation') ON CONFLICT (key) DO NOTHING"
    );
    // Reload settings into configManager cache
    const configManager = require('../../services/configManager');
    await configManager.loadSettings();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/reports', () => {
    it('should create a report with voterId (201)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          submission_id: submission.id,
          reason: 'spam',
          detail: 'This looks like spam'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.reason).toBe('spam');
      expect(res.body.status).toBe('pending');
    });

    it('should reject duplicate report from same voter (409)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      // Use a specific agent to get consistent cookie
      const agent1 = request.agent(app);
      await agent1.post('/api/v1/reports').send({
        submission_id: submission.id,
        reason: 'spam'
      });

      const res = await agent1.post('/api/v1/reports').send({
        submission_id: submission.id,
        reason: 'offensive'
      });

      expect(res.status).toBe(409);
    });

    it('should auto-restrict submission after threshold reports', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      // Create 3 reports (threshold is 3 for test) from different users
      for (let i = 0; i < 3; i++) {
        const voter = await createAgentOwner({ name: `Voter ${i}` });
        await request(app)
          .post('/api/v1/reports')
          .set('Authorization', authHeader(voter.token))
          .send({
            submission_id: submission.id,
            reason: 'inappropriate'
          });
      }

      // Check submission is now restricted
      const subRes = await db.query('SELECT status FROM submissions WHERE id = $1', [submission.id]);
      expect(subRes.rows[0].status).toBe('restricted');
    });

    it('should reject report for non-existent submission (404)', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          submission_id: '00000000-0000-0000-0000-000000000000',
          reason: 'spam'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/reports (admin)', () => {
    it('should list reports for admin (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      // Create a report
      await request(app)
        .post('/api/v1/reports')
        .set('Authorization', authHeader(admin.token))
        .send({ submission_id: submission.id, reason: 'spam' });

      const res = await request(app)
        .get('/api/v1/reports')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty('submission_title');
    });

    it('should reject non-admin access (403)', async () => {
      const voter = await createAgentOwner();

      const res = await request(app)
        .get('/api/v1/reports')
        .set('Authorization', authHeader(voter.token));

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/reports/:id (admin review)', () => {
    it('should dismiss a report (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      const createRes = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', authHeader(admin.token))
        .send({ submission_id: submission.id, reason: 'spam' });

      const res = await request(app)
        .patch('/api/v1/reports/' + createRes.body.id)
        .set('Authorization', authHeader(admin.token))
        .send({ status: 'dismissed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('dismissed');
    });

    it('should confirm a report and disqualify submission (200)', async () => {
      const admin = await createAdminUser();
      const owner = await createAgentOwner();
      const agent = await createTestAgent(owner.id);
      const problem = await createTestProblem(admin.id, { state: 'open' });
      const submission = await createTestSubmission(problem.id, agent.id);

      const createRes = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', authHeader(admin.token))
        .send({ submission_id: submission.id, reason: 'offensive' });

      const res = await request(app)
        .patch('/api/v1/reports/' + createRes.body.id)
        .set('Authorization', authHeader(admin.token))
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');

      // Check submission is disqualified
      const subRes = await db.query('SELECT status FROM submissions WHERE id = $1', [submission.id]);
      expect(subRes.rows[0].status).toBe('disqualified');
    });
  });
});
