const request = require('supertest');
const app = require('../../server');
const {
  createTestUser,
  createAdminUser,
  createTestProblem,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Problems API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // =============================================
  // POST /api/v1/problems
  // =============================================
  describe('POST /api/v1/problems', () => {
    it('should create a problem as admin (201)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', authHeader(admin.token))
        .send({
          title: 'New Problem',
          description: 'A challenging problem',
          image_url: 'https://example.com/image.jpg'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('New Problem');
      expect(res.body.state).toBe('draft');
      expect(res.body.description).toBe('A challenging problem');
      expect(res.body.created_by).toBe(admin.id);
    });

    it('should reject problem creation for non-admin (403)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', authHeader(voter.token))
        .send({ title: 'Voter Problem' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should reject problem creation without title (400)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', authHeader(admin.token))
        .send({ description: 'No title here' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // =============================================
  // GET /api/v1/problems
  // =============================================
  describe('GET /api/v1/problems', () => {
    it('should list problems without authentication (200)', async () => {
      const admin = await createAdminUser();
      await createTestProblem(admin.id, { title: 'Problem 1', state: 'open' });
      await createTestProblem(admin.id, { title: 'Problem 2', state: 'draft' });

      const res = await request(app)
        .get('/api/v1/problems');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter problems by state (200)', async () => {
      const admin = await createAdminUser();
      await createTestProblem(admin.id, { title: 'Open Problem', state: 'open' });
      await createTestProblem(admin.id, { title: 'Draft Problem', state: 'draft' });
      await createTestProblem(admin.id, { title: 'Another Open', state: 'open' });

      const res = await request(app)
        .get('/api/v1/problems?state=open');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
      res.body.data.forEach(problem => {
        expect(problem.state).toBe('open');
      });
    });
  });

  // =============================================
  // GET /api/v1/problems/:id
  // =============================================
  describe('GET /api/v1/problems/:id', () => {
    it('should get a problem by ID without authentication (200)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { title: 'Specific Problem' });

      const res = await request(app)
        .get(`/api/v1/problems/${problem.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(problem.id);
      expect(res.body.title).toBe('Specific Problem');
      expect(res.body).toHaveProperty('submission_count');
    });

    it('should return 404 for non-existent problem', async () => {
      const res = await request(app)
        .get('/api/v1/problems/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  // =============================================
  // PATCH /api/v1/problems/:id
  // =============================================
  describe('PATCH /api/v1/problems/:id', () => {
    it('should allow valid state transition: draft -> open (200)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'draft' });

      const res = await request(app)
        .patch(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token))
        .send({ state: 'open' });

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('open');
    });

    it('should allow valid state transition: open -> voting (200)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'open' });

      const res = await request(app)
        .patch(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token))
        .send({ state: 'voting' });

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('voting');
    });

    it('should allow valid state transition: voting -> closed (200)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'voting' });

      const res = await request(app)
        .patch(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token))
        .send({ state: 'closed' });

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('closed');
    });

    it('should reject invalid state transition: draft -> closed (400)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'draft' });

      const res = await request(app)
        .patch(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token))
        .send({ state: 'closed' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STATE_TRANSITION');
    });

    it('should reject invalid state transition: draft -> voting (400)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { state: 'draft' });

      const res = await request(app)
        .patch(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token))
        .send({ state: 'voting' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STATE_TRANSITION');
    });
  });

  // =============================================
  // DELETE /api/v1/problems/:id
  // =============================================
  describe('DELETE /api/v1/problems/:id', () => {
    it('should delete a problem as admin (200)', async () => {
      const admin = await createAdminUser();
      const problem = await createTestProblem(admin.id, { title: 'To Delete' });

      const res = await request(app)
        .delete(`/api/v1/problems/${problem.id}`)
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(problem.id);
      expect(res.body.message).toBe('Problem deleted');

      // Verify problem is actually gone
      const getRes = await request(app)
        .get(`/api/v1/problems/${problem.id}`);

      expect(getRes.status).toBe(404);
    });
  });
});
