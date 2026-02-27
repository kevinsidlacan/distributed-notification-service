import request from 'supertest';

// ─── Mock setup (must be before app import) ─────────────────────────────────

const mockAdminFindUnique = jest.fn();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    admin: {
      findUnique: mockAdminFindUnique,
    },
  },
}));

// Import the app AFTER mocks are set up
import { app } from '../index';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_HASH = '$2b$10$1Ae2Qs41sVa9Jv6WyIzql.vPa.hVCL7qyxhP9FPYxas2aQ4Zu0lD2'; // bcryptjs hash of "password"

const mockAdmin = {
  id: 'admin-1',
  email: 'admin@example.com',
  passwordHash: VALID_HASH,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should return 200 with a token on valid credentials', async () => {
      mockAdminFindUnique.mockResolvedValue(mockAdmin);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.admin).toMatchObject({
        id: 'admin-1',
        email: 'admin@example.com',
      });
    });

    it('should return 401 when email is not found', async () => {
      mockAdminFindUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'unknown@example.com', password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password.' });
    });

    it('should return 401 when password is incorrect', async () => {
      mockAdminFindUnique.mockResolvedValue(mockAdmin);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password.' });
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'password' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email and password are required.' });
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email and password are required.' });
    });

    it('should return 500 on an unexpected database error', async () => {
      mockAdminFindUnique.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'password' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error.' });
    });
  });

});
