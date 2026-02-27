import { Queue } from 'bullmq';
import { REDIS_CONNECTION } from './redis';

export const NOTIFICATION_QUEUE = 'notifications';

export const notificationQueue = new Queue(NOTIFICATION_QUEUE, {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export interface NotificationJobData {
  messageId: string;
  campaignId: string;
  recipient: string;
}

export async function enqueueNotifications(
  campaignId: string,
  messages: { id: string; recipient: string }[]
): Promise<void> {
  const jobs = messages.map((msg) => ({
    name: 'send-notification',
    data: {
      messageId: msg.id,
      campaignId,
      recipient: msg.recipient,
    } as NotificationJobData,
  }));

  // BullMQ addBulk is optimized for adding many jobs at once
  const BULK_SIZE = 500;
  for (let i = 0; i < jobs.length; i += BULK_SIZE) {
    const batch = jobs.slice(i, i + BULK_SIZE);
    await notificationQueue.addBulk(batch);
  }
}
