const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../server');
const {
  createTestUser,
  createAdminUser,
  cleanDatabase,
  authHeader
} = require('../helpers');

// Create a minimal valid JPEG buffer (smallest valid JPEG: SOI + EOI markers)
function createTestJpegBuffer() {
  // Minimal valid JPEG: SOI marker (0xFFD8) + JFIF APP0 segment + EOI marker (0xFFD9)
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
  ]);
}

// Create a minimal valid PNG buffer
function createTestPngBuffer() {
  // Minimal PNG: signature + IHDR chunk + IEND chunk
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, ...
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // CRC, IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, // compressed data
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, // ...
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND
    0x44, 0xAE, 0x42, 0x60, 0x82                      // IEND CRC
  ]);
}

describe('Upload API', () => {
  // Store paths of test-uploaded files to clean up
  const uploadedFiles = [];

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    // Clean up any uploaded test files
    for (const filePath of uploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // =============================================
  // POST /api/v1/upload/image
  // =============================================
  describe('POST /api/v1/upload/image', () => {
    it('should upload a valid JPEG image as admin (201)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(admin.token))
        .attach('image', createTestJpegBuffer(), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('key');
      expect(res.body.content_type).toBe('image/jpeg');
      expect(res.body).toHaveProperty('size');

      // Track file for cleanup (local storage mode)
      if (res.body.key) {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        uploadedFiles.push(path.join(uploadsDir, res.body.key));
      }
    });

    it('should upload a valid PNG image as admin (201)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(admin.token))
        .attach('image', createTestPngBuffer(), {
          filename: 'test-image.png',
          contentType: 'image/png'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('key');
      expect(res.body.content_type).toBe('image/png');

      if (res.body.key) {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        uploadedFiles.push(path.join(uploadsDir, res.body.key));
      }
    });

    it('should reject upload for non-admin user (403)', async () => {
      const voter = await createTestUser({ role: 'voter' });

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(voter.token))
        .attach('image', createTestJpegBuffer(), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should reject upload without authentication (401)', async () => {
      const res = await request(app)
        .post('/api/v1/upload/image')
        .attach('image', createTestJpegBuffer(), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject request with no file attached (400)', async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(admin.token));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject non-image file type (400)', async () => {
      const admin = await createAdminUser();

      // Create a text file buffer
      const textBuffer = Buffer.from('This is a text file, not an image');

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(admin.token))
        .attach('image', textBuffer, {
          filename: 'test.txt',
          contentType: 'text/plain'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject non-allowed image format (400)', async () => {
      const admin = await createAdminUser();

      // Create a fake SVG buffer
      const svgBuffer = Buffer.from('<svg></svg>');

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(admin.token))
        .attach('image', svgBuffer, {
          filename: 'test.svg',
          contentType: 'image/svg+xml'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject upload by agent_owner (403)', async () => {
      const owner = await createTestUser({ role: 'agent_owner' });

      const res = await request(app)
        .post('/api/v1/upload/image')
        .set('Authorization', authHeader(owner.token))
        .attach('image', createTestJpegBuffer(), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });
});
