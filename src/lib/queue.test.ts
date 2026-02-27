// Mock BullMQ before imports — jest.mock is hoisted above imports
const mockAddBulk = jest.fn().mockResolvedValue([]);

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      addBulk: mockAddBulk,
    })),
  };
});

// Mock redis connection so Queue constructor doesn't try to connect
jest.mock('./redis', () => ({
  REDIS_CONNECTION: { host: 'localhost', port: 6379 },
}));

import { enqueueNotifications } from './queue';

describe('enqueueNotifications', () => {
  beforeEach(() => {
    mockAddBulk.mockClear();
  });

  it('should create jobs with correct payload structure', async () => {
    const messages = [
      { id: 'msg-1', recipient: 'user1@example.com' },
      { id: 'msg-2', recipient: 'user2@example.com' },
    ];

    await enqueueNotifications('campaign-123', messages);

    expect(mockAddBulk).toHaveBeenCalledWith([
      {
        name: 'send-notification',
        data: {
          messageId: 'msg-1',
          campaignId: 'campaign-123',
          recipient: 'user1@example.com',
        },
      },
      {
        name: 'send-notification',
        data: {
          messageId: 'msg-2',
          campaignId: 'campaign-123',
          recipient: 'user2@example.com',
        },
      },
    ]);
  });

  it('should handle an empty messages array', async () => {
    await enqueueNotifications('campaign-123', []);
    expect(mockAddBulk).not.toHaveBeenCalled();
  });

  it('should batch jobs in groups of 500', async () => {
    const messages = Array.from({ length: 1200 }, (_, i) => ({
      id: `msg-${i}`,
      recipient: `user${i}@example.com`,
    }));

    await enqueueNotifications('campaign-123', messages);

    // 1200 messages = 3 batches: 500 + 500 + 200
    expect(mockAddBulk).toHaveBeenCalledTimes(3);
    expect(mockAddBulk.mock.calls[0][0]).toHaveLength(500);
    expect(mockAddBulk.mock.calls[1][0]).toHaveLength(500);
    expect(mockAddBulk.mock.calls[2][0]).toHaveLength(200);
  });

  it('should not batch when messages count is within limit', async () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      recipient: `user${i}@example.com`,
    }));

    await enqueueNotifications('campaign-123', messages);

    expect(mockAddBulk).toHaveBeenCalledTimes(1);
    expect(mockAddBulk.mock.calls[0][0]).toHaveLength(100);
  });

  it('should use "send-notification" as the job name for all jobs', async () => {
    const messages = [
      { id: 'msg-1', recipient: 'a@test.com' },
      { id: 'msg-2', recipient: 'b@test.com' },
    ];

    await enqueueNotifications('c-1', messages);

    const jobs = mockAddBulk.mock.calls[0][0];
    jobs.forEach((job: { name: string }) => {
      expect(job.name).toBe('send-notification');
    });
  });
});
