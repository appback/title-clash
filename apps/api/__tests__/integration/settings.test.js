const request = require('supertest');
const app = require('../../server');
const db = require('../../db');
const {
  createAdminUser,
  createAgentOwner,
  cleanDatabase,
  authHeader
} = require('../helpers');

describe('Settings API', () => {
  beforeEach(async () => {
    await cleanDatabase();
    // Seed some test settings
    await db.query(`
      INSERT INTO settings (key, value, category, description) VALUES
        ('reward_1st', '100', 'rewards', '1st place points'),
        ('reward_2nd', '50', 'rewards', '2nd place points'),
        ('storage_mode', '"s3"', 'storage', 'Storage backend')
      ON CONFLICT (key) DO NOTHING
    `);
    // Load settings into cache
    const configManager = require('../../services/configManager');
    await configManager.loadSettings();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('GET /api/v1/settings', () => {
    it('should list all settings for admin (200)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
      expect(res.body.settings).toHaveProperty('reward_1st');
    });

    it('should filter settings by category (200)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get('/api/v1/settings?category=rewards')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.settings).toHaveProperty('reward_1st');
      expect(res.body.settings).not.toHaveProperty('storage_mode');
    });

    it('should reject non-admin access (403)', async () => {
      const voter = await createAgentOwner();

      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(voter.token));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated access (401)', async () => {
      const res = await request(app)
        .get('/api/v1/settings');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/settings', () => {
    it('should update settings (200)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(admin.token))
        .send({
          settings: {
            reward_1st: 200,
            reward_2nd: 100
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Settings updated');

      // Verify values are updated
      const configManager = require('../../services/configManager');
      expect(configManager.getNumber('reward_1st', 0)).toBe(200);
      expect(configManager.getNumber('reward_2nd', 0)).toBe(100);
    });

    it('should reject missing settings body (400)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(admin.token))
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/settings/refresh', () => {
    it('should reload settings from DB (200)', async () => {
      const admin = await createAdminUser();

      // Update directly in DB
      await db.query("UPDATE settings SET value = '999' WHERE key = 'reward_1st'");

      // Refresh cache
      const res = await request(app)
        .post('/api/v1/settings/refresh')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Settings refreshed');

      // Verify cache is updated
      const configManager = require('../../services/configManager');
      expect(configManager.getNumber('reward_1st', 0)).toBe(999);
    });
  });
});
