import request from 'supertest';

// ----- Mock setup (before app import) -----

const mockTransaction = jest.fn();
const mockCampaignCreate = jest.fn();
const mockCampaignUpdate = jest.fn();
const mockCampaignFindUnique = jest.fn();
const mockCampaignFindMany = jest.fn();
const mockMessageCreateMany = jest.fn();
const mockMessageFindMany = jest.fn();
const mockMessageGroupBy = jest.fn();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
    campaign: {
      create: mockCampaignCreate,
      update: mockCampaignUpdate,
      findUnique: mockCampaignFindUnique,
      findMany: mockCampaignFindMany,
    },
    message: {
      createMany: mockMessageCreateMany,
      findMany: mockMessageFindMany,
      groupBy: mockMessageGroupBy,
    },
  },
}));

const mockEnqueueNotifications = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/queue', () => ({
  enqueueNotifications: mockEnqueueNotifications,
}));

// Import the app AFTER mocks are set up
import { app } from '../index';

describe('Campaign Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== POST /campaigns ====================

  describe('POST /campaigns', () => {
    it('should return 202 with campaign data on success', async () => {
      const fakeCampaign = {
        id: 'camp-1',
        name: 'Test Campaign',
        totalMessages: 3,
        status: 'pending',
      };

      const fakeMessages = [
        { id: 'msg-1', recipient: 'user1@example.com' },
        { id: 'msg-2', recipient: 'user2@example.com' },
        { id: 'msg-3', recipient: 'user3@example.com' },
      ];

      mockTransaction.mockImplementation(async (fn: Function) => {
        const tx = {
          campaign: { create: jest.fn().mockResolvedValue(fakeCampaign) },
          message: {
            createMany: jest.fn().mockResolvedValue({ count: 3 }),
            findMany: jest.fn().mockResolvedValue(fakeMessages),
          },
        };
        return fn(tx);
      });

      mockCampaignUpdate.mockResolvedValue({
        ...fakeCampaign,
        status: 'processing',
      });

      const res = await request(app)
        .post('/campaigns')
        .send({ name: 'Test Campaign', recipientCount: 3 });

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        campaignId: 'camp-1',
        name: 'Test Campaign',
        totalMessages: 3,
        status: 'processing',
        message: 'Campaign created and queued for processing.',
      });

      // Verify enqueue was called
      expect(mockEnqueueNotifications).toHaveBeenCalledWith('camp-1', fakeMessages);

      // Verify campaign status was updated to processing
      expect(mockCampaignUpdate).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: { status: 'processing' },
      });
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/campaigns')
        .send({ recipientCount: 10 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Campaign name is required.' });
    });

    it('should return 400 when recipientCount exceeds 100,000', async () => {
      const res = await request(app)
        .post('/campaigns')
        .send({ name: 'Big Campaign', recipientCount: 100001 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Maximum 100,000 recipients per campaign.',
      });
    });

    it('should default to 100 recipients when recipientCount is not provided', async () => {
      const fakeCampaign = {
        id: 'camp-2',
        name: 'Default Count',
        totalMessages: 100,
        status: 'pending',
      };

      mockTransaction.mockImplementation(async (fn: Function) => {
        const tx = {
          campaign: { create: jest.fn().mockResolvedValue(fakeCampaign) },
          message: {
            createMany: jest.fn().mockResolvedValue({ count: 100 }),
            findMany: jest.fn().mockResolvedValue(
              Array.from({ length: 100 }, (_, i) => ({
                id: `msg-${i}`,
                recipient: `user${i + 1}@example.com`,
              }))
            ),
          },
        };
        return fn(tx);
      });

      mockCampaignUpdate.mockResolvedValue({
        ...fakeCampaign,
        status: 'processing',
      });

      const res = await request(app)
        .post('/campaigns')
        .send({ name: 'Default Count' });

      expect(res.status).toBe(202);
      expect(res.body.totalMessages).toBe(100);
    });

    it('should return 500 on internal server error', async () => {
      mockTransaction.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app)
        .post('/campaigns')
        .send({ name: 'Broken Campaign' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error.' });
    });
  });

  // ==================== GET /campaigns/:id ====================

  describe('GET /campaigns/:id', () => {
    it('should return 200 with campaign data and progress', async () => {
      const fakeCampaign = {
        id: 'camp-1',
        name: 'Test',
        totalMessages: 100,
        sentCount: 90,
        failedCount: 10,
        status: 'completed_with_failures',
        _count: { messages: 100 },
      };

      mockCampaignFindUnique.mockResolvedValue(fakeCampaign);
      mockMessageGroupBy.mockResolvedValue([
        { status: 'sent', _count: { _all: 90 } },
        { status: 'failed', _count: { _all: 10 } },
      ]);

      const res = await request(app).get('/campaigns/camp-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'camp-1',
        name: 'Test',
        progress: {
          sent: 90,
          failed: 10,
        },
      });
    });

    it('should return 404 when campaign is not found', async () => {
      mockCampaignFindUnique.mockResolvedValue(null);

      const res = await request(app).get('/campaigns/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Campaign not found.' });
    });
  });

  // ==================== GET /campaigns ====================

  describe('GET /campaigns', () => {
    it('should return 200 with a list of campaigns', async () => {
      const fakeCampaigns = [
        { id: 'camp-1', name: 'First', status: 'completed' },
        { id: 'camp-2', name: 'Second', status: 'processing' },
      ];

      mockCampaignFindMany.mockResolvedValue(fakeCampaigns);

      const res = await request(app).get('/campaigns');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('First');
      expect(res.body[1].name).toBe('Second');
    });

    it('should return an empty array when no campaigns exist', async () => {
      mockCampaignFindMany.mockResolvedValue([]);

      const res = await request(app).get('/campaigns');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
