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

import {
  sendNotification,
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

describe('sendNotification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve when Math.random returns above the failure threshold', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // above 0.2
    const promise = sendNotification('user@example.com');
    jest.advanceTimersByTime(200);
    await expect(promise).resolves.toBeUndefined();
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('should throw when Math.random returns below the failure threshold', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // below 0.2
    const promise = sendNotification('user@example.com');
    jest.advanceTimersByTime(200);
    await expect(promise).rejects.toThrow(
      'Failed to deliver notification to user@example.com'
    );
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('should throw when Math.random returns exactly 0', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const promise = sendNotification('test@test.com');
    jest.advanceTimersByTime(200);
    await expect(promise).rejects.toThrow();
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('should succeed when Math.random returns exactly the failure threshold', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.2); // === 0.2, not < 0.2
    const promise = sendNotification('test@test.com');
    jest.advanceTimersByTime(200);
    await expect(promise).resolves.toBeUndefined();
    jest.spyOn(Math, 'random').mockRestore();
  });
});

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
    jest.useFakeTimers();
    // Default: sendNotification succeeds
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
    jest.useRealTimers();
  });

  it('should update message to "sent" and increment sentCount on success', async () => {
    mockPrismaMessage.update.mockResolvedValue({});
    mockPrismaCampaign.update.mockResolvedValue({});

    const job = createMockJob();
    const promise = processNotificationJob(job);
    jest.advanceTimersByTime(200);
    await promise;

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
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // Force failure
    mockPrismaMessage.update.mockResolvedValue({});

    const job = createMockJob({ attemptsMade: 0, opts: { attempts: 3 } } as any);

    const promise = processNotificationJob(job);
    jest.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow(
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
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // Force failure
    mockPrismaMessage.update.mockResolvedValue({});

    const job = createMockJob({ attemptsMade: 2, opts: { attempts: 3 } } as any);

    const promise = processNotificationJob(job);
    jest.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow();

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
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    mockPrismaMessage.update.mockResolvedValue({});

    const job = createMockJob();
    const promise = processNotificationJob(job);
    jest.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow(Error);
  });
});
