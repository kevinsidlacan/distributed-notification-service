import { Job } from 'bullmq';
import { NotificationJobData } from '../lib/queue';

// Mock Prisma before importing workerFunctions
const mockPrismaMessage = {
  count: jest.fn(),
  update: jest.fn(),
};

const mockPrismaCampaign = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    message: mockPrismaMessage,
    campaign: mockPrismaCampaign,
  },
}));

// Mock BullMQ so the queue module doesn't try to connect to Redis
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    addBulk: jest.fn(),
  })),
  Worker: jest.fn(),
  Job: jest.fn(),
}));

jest.mock('../lib/redis', () => ({
  REDIS_CONNECTION: { host: 'localhost', port: 6379 },
}));

const mockSendEmail = jest.fn();
jest.mock('../services/email/EmailServiceFactory', () => ({
  EmailServiceFactory: {
    getProvider: jest.fn(() => ({
      sendEmail: mockSendEmail,
    })),
  },
}));

import {
  updateCampaignProgress,
  processNotificationJob,
} from './workerFunctions';

// Helper to create a fake BullMQ Job
function createMockJob(overrides: Partial<Job<NotificationJobData>> = {}): Job<NotificationJobData> {
  return {
    data: {
      messageId: 'msg-1',
      campaignId: 'campaign-1',
      recipient: 'user@example.com',
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job<NotificationJobData>;
}

// sendNotification tests removed as logic moved to MockEmailProvider
describe('updateCampaignProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set status to "completed" when no pending/queued messages and failedCount is 0', async () => {
    mockPrismaMessage.count.mockResolvedValue(0); // both pending and queued
    mockPrismaCampaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      failedCount: 0,
      sentCount: 100,
    });
    mockPrismaCampaign.update.mockResolvedValue({});

    await updateCampaignProgress('campaign-1');

    expect(mockPrismaCampaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'completed' },
    });
  });

  it('should set status to "completed_with_failures" when failedCount > 0', async () => {
    mockPrismaMessage.count.mockResolvedValue(0);
    mockPrismaCampaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      failedCount: 5,
      sentCount: 95,
    });
    mockPrismaCampaign.update.mockResolvedValue({});

    await updateCampaignProgress('campaign-1');

    expect(mockPrismaCampaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'completed_with_failures' },
    });
  });

  it('should NOT update status when pending messages remain', async () => {
    mockPrismaMessage.count
      .mockResolvedValueOnce(5)  // pending = 5
      .mockResolvedValueOnce(0); // queued = 0

    await updateCampaignProgress('campaign-1');

    expect(mockPrismaCampaign.findUnique).not.toHaveBeenCalled();
    expect(mockPrismaCampaign.update).not.toHaveBeenCalled();
  });

  it('should NOT update status when queued messages remain', async () => {
    mockPrismaMessage.count
      .mockResolvedValueOnce(0)  // pending = 0
      .mockResolvedValueOnce(3); // queued = 3

    await updateCampaignProgress('campaign-1');

    expect(mockPrismaCampaign.findUnique).not.toHaveBeenCalled();
    expect(mockPrismaCampaign.update).not.toHaveBeenCalled();
  });

  it('should not update if campaign is not found', async () => {
    mockPrismaMessage.count.mockResolvedValue(0);
    mockPrismaCampaign.findUnique.mockResolvedValue(null);

    await updateCampaignProgress('nonexistent');

    expect(mockPrismaCampaign.update).not.toHaveBeenCalled();
  });
});

describe('processNotificationJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
  });

  it('should update message to "sent" and increment sentCount on success', async () => {
    mockPrismaMessage.update.mockResolvedValue({});
    mockPrismaCampaign.update.mockResolvedValue({});
    mockPrismaCampaign.findUnique.mockResolvedValue({ name: 'Test Campaign' });

    const job = createMockJob();
    await processNotificationJob(job);

    expect(mockPrismaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: {
        status: 'sent',
        attempts: 1, // attemptsMade (0) + 1
      },
    });

    expect(mockPrismaCampaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { sentCount: { increment: 1 } },
    });
  });

  it('should update message to "queued" and rethrow on failure with retries remaining', async () => {
    mockSendEmail.mockRejectedValue(new Error('Failed to deliver notification'));
    mockPrismaMessage.update.mockResolvedValue({});
    mockPrismaCampaign.findUnique.mockResolvedValue({ name: 'Test Campaign' });

    const job = createMockJob({ attemptsMade: 0, opts: { attempts: 3 } } as any);

    await expect(processNotificationJob(job)).rejects.toThrow(
      'Failed to deliver notification'
    );

    expect(mockPrismaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: {
        status: 'queued', // 0 + 1 = 1 < 3, so retries remain
        attempts: 1,
        lastError: expect.stringContaining('Failed to deliver notification'),
      },
    });

    // Should NOT increment sentCount on failure
    expect(mockPrismaCampaign.update).not.toHaveBeenCalled();
  });

  it('should update message to "failed" on final attempt failure', async () => {
    mockSendEmail.mockRejectedValue(new Error('Failed'));
    mockPrismaMessage.update.mockResolvedValue({});
    mockPrismaCampaign.findUnique.mockResolvedValue({ name: 'Test Campaign' });

    const job = createMockJob({ attemptsMade: 2, opts: { attempts: 3 } } as any);

    await expect(processNotificationJob(job)).rejects.toThrow();

    expect(mockPrismaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: {
        status: 'failed', // 2 + 1 = 3 >= 3, so permanently failed
        attempts: 3,
        lastError: expect.any(String),
      },
    });
  });

  it('should rethrow the error to let BullMQ handle retries', async () => {
    mockSendEmail.mockRejectedValue(new Error('Random failure'));
    mockPrismaMessage.update.mockResolvedValue({});
    mockPrismaCampaign.findUnique.mockResolvedValue({ name: 'Test Campaign' });

    const job = createMockJob();

    await expect(processNotificationJob(job)).rejects.toThrow(Error);
  });
});
