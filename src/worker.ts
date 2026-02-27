import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { NOTIFICATION_QUEUE, NotificationJobData } from './lib/queue';
import { REDIS_CONNECTION } from './lib/redis';
import prisma from './lib/prisma';

const FAILURE_RATE = 0.2;
const SIMULATED_LATENCY_MS = 200;

async function sendNotification(recipient: string): Promise<void> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  // Simulate random failures
  if (Math.random() < FAILURE_RATE) {
    throw new Error(`Failed to deliver notification to ${recipient}`);
  }
}

async function updateCampaignProgress(campaignId: string): Promise<void> {
  const pendingCount = await prisma.message.count({
    where: { campaignId, status: 'pending' },
  });

  const queuedCount = await prisma.message.count({
    where: { campaignId, status: 'queued' },
  });

  if (pendingCount === 0 && queuedCount === 0) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (campaign) {
      const status = campaign.failedCount > 0 ? 'completed_with_failures' : 'completed';
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status },
      });
      console.log(`Campaign ${campaignId} ${status} (sent: ${campaign.sentCount}, failed: ${campaign.failedCount})`);
    }
  }
}

const worker = new Worker<NotificationJobData>(
  NOTIFICATION_QUEUE,
  async (job: Job<NotificationJobData>) => {
    const { messageId, campaignId, recipient } = job.data;

    try {
      await sendNotification(recipient);

      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'sent',
          attempts: job.attemptsMade + 1,
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
          attempts: job.attemptsMade + 1,
          lastError: errorMessage,
        },
      });

      throw error; // Rethrow to let BullMQ handle retries
    }
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 10,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);

worker.on('completed', async (job: Job<NotificationJobData>) => {
  await updateCampaignProgress(job.data.campaignId);
});

worker.on('failed', async (job: Job<NotificationJobData> | undefined, error: Error) => {
  if (!job) return;

  const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 3);

  if (isLastAttempt) {
    await prisma.campaign.update({
      where: { id: job.data.campaignId },
      data: { failedCount: { increment: 1 } },
    });

    await updateCampaignProgress(job.data.campaignId);
    console.error(`Message ${job.data.messageId} permanently failed: ${error.message}`);
  }
});

worker.on('ready', () => {
  console.log('🔧 Notification worker is ready and listening for jobs');
});

worker.on('error', (error: Error) => {
  console.error('Worker error:', error);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('🚀 Notification worker started');
